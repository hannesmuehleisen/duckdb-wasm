import * as duckdb from '@duckdb/duckdb-wasm';
import * as shell from '../crate/pkg';
import { HistoryStore } from './utils/history_store';
import { isSafari } from './platform';
import { pickFiles } from './utils/files';
import { InstantiationProgress } from '@duckdb/duckdb-wasm/dist/types/src/bindings';

const hasWebGL = (): boolean => {
    if (isSafari) {
        return false;
    }
    const canvas = document.createElement('canvas') as any;
    const supports = 'probablySupportsContext' in canvas ? 'probablySupportsContext' : 'supportsContext';
    if (supports in canvas) {
        return canvas[supports]('webgl2');
    }
    return 'WebGL2RenderingContext' in window;
};

class ShellRuntime {
    database: duckdb.AsyncDuckDB | null;
    history: HistoryStore;
    resizeHandler: (_event: UIEvent) => void;

    constructor(protected container: HTMLDivElement) {
        this.database = null;
        this.history = new HistoryStore();
        this.resizeHandler = (_event: UIEvent) => {
            const rect = container.getBoundingClientRect();
            shell.resize(rect.width, rect.height);
        };
    }

    public async pickFiles(this: ShellRuntime): Promise<number> {
        if (this.database == null) {
            console.warn('database is not initialized');
            return 0;
        }
        return await pickFiles(this.database!);
    }
    public async downloadFile(this: ShellRuntime, name: string, buffer: Uint8Array): Promise<void> {
        const blob = new Blob([buffer]);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = name;
        link.click();
    }
    public async readClipboardText(this: ShellRuntime): Promise<string> {
        return await navigator.clipboard.readText();
    }
    public async writeClipboardText(this: ShellRuntime, value: string) {
        return await navigator.clipboard.writeText(value);
    }
    public async pushInputToHistory(this: ShellRuntime, value: string) {
        this.history.push(value);
    }
}

interface ShellProps {
    shellModule: RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
    container: HTMLDivElement;
    resolveDatabase: (p: duckdb.InstantiationProgressHandler) => Promise<duckdb.AsyncDuckDB>;
}

function formatBytes(value: number): string {
    const [multiple, k, suffix] = [1000, 'k', 'B'];
    const exp = (Math.log(value) / Math.log(multiple)) | 0;
    const size = Number((value / Math.pow(multiple, exp)).toFixed(2));
    return `${size} ${exp ? `${k}MGTPEZY`[exp - 1] + suffix : `byte${size !== 1 ? 's' : ''}`}`;
}

export async function embed(props: ShellProps) {
    // Initialize the shell
    await shell.default(props.shellModule);

    // Embed into container
    const runtime = new ShellRuntime(props.container);
    shell.embed(props.container!, runtime, {
        backgroundColor: '#333',
        withWebGL: hasWebGL(),
    });
    props.container.onresize = runtime.resizeHandler;

    const TERM_BOLD = '\x1b[1m';
    const TERM_NORMAL = '\x1b[m';
    const TERM_CLEAR = '\x1b[2K\r';

    // Progress handler
    const progressHandler = (progress: InstantiationProgress) => {
        if (progress.bytesTotal > 0) {
            const blocks = Math.floor((progress.bytesLoaded / progress.bytesTotal) * 10.0);
            const bar = `${'#'.repeat(blocks)}${'-'.repeat(10 - blocks)}`;
            shell.write(`${TERM_CLEAR}${TERM_BOLD}[ RUN ]${TERM_NORMAL} Loading ${bar}`);
        } else {
            shell.write(`${TERM_CLEAR}${TERM_BOLD}[ RUN ]${TERM_NORMAL} Loading ${formatBytes(progress.bytesLoaded)}`);
        }
    };

    // Attach to the database
    shell.writeln(`${TERM_BOLD}[ RUN ]${TERM_NORMAL} Instantiating DuckDB`);
    runtime.database = await props.resolveDatabase(progressHandler);
    shell.writeln(`${TERM_CLEAR}${TERM_BOLD}[ OK  ]${TERM_NORMAL} Instantiating DuckDB`);

    // Additional steps
    const step = async (label: string, work: () => Promise<void>) => {
        shell.writeln(`${TERM_BOLD}[ RUN ]${TERM_NORMAL} ${label}`);
        await work();
        shell.writeln(`${TERM_BOLD}[ OK  ]${TERM_NORMAL} ${label}`);
    };
    await step('Loading Shell History', async () => {
        await runtime.history.open();
        const [hist, histCursor] = await runtime.history.load();
        shell.loadHistory(hist, histCursor);
    });
    await step('Attaching Shell', async () => {
        shell.configureDatabase(runtime.database);
    });
}
