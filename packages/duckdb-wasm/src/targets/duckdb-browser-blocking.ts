export * from '../bindings';
export * from '../log';
export * from '../platform';
export * from '../status';
export { DEFAULT_RUNTIME } from '../bindings/runtime';
export { BROWSER_RUNTIME } from '../bindings/runtime_browser';

import { Logger } from '../log';
import { DuckDBRuntime, DuckDBBindings } from '../bindings';
import { DuckDBBundles, getPlatformFeatures } from '../platform';
import { DuckDB as DuckDBMVP } from '../bindings/bindings_browser_mvp';
import { DuckDB as DuckDBNext } from '../bindings/bindings_browser_eh';

export async function createDuckDB(
    bundles: DuckDBBundles,
    logger: Logger,
    runtime: DuckDBRuntime,
): Promise<DuckDBBindings> {
    const platform = await getPlatformFeatures();
    if (platform.wasmExceptions) {
        if (bundles.eh) {
            return new DuckDBNext(logger, runtime, bundles.eh!.mainModule);
        }
    }
    return new DuckDBMVP(logger, runtime, bundles.mvp.mainModule);
}
