import * as arrow from 'apache-arrow';

export interface Column {
    name: string;
    values: any[];
}

export function compareTable(table: arrow.Table, expected: Column[]): void {
    // Check column count
    const colCount = expected.length;
    expect(table.numCols).toEqual(colCount);
    if (colCount == 0) return;

    // Check columns
    const rowCount = expected[0].values.length;
    for (let i = 0; i < colCount; ++i) {
        expect(expected[i].values.length).toEqual(rowCount);
        expect(table.getColumnAt(i)?.length).toEqual(rowCount);
        expect(table.getColumnAt(i)?.name).toEqual(expected[i].name);
    }

    // Compare the actual values
    for (let i = 0; i < colCount; ++i) {
        const col = table.getColumnAt(i)!;
        const have = [];
        for (let j = 0; j < rowCount; ++j) {
            have.push(col.get(j));
        }
        expect(have).toEqual(expected[i].values);
    }
}
