import Papa from 'papaparse';

export type SpreadsheetRow = Record<string, unknown>;

export function exportCsv<T extends Record<string, unknown>>(rows: T[], fileName: string) {
  const csv = Papa.unparse(rows);
  downloadBlob(csv, `${fileName}.csv`, 'text/csv;charset=utf-8;');
}

export async function exportExcel<T extends Record<string, unknown>>(rows: T[], fileName: string, headers?: string[]) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data');
  const columns = headers ?? Object.keys(rows[0] ?? {});

  worksheet.addRow(columns);
  rows.forEach((row) => {
    worksheet.addRow(columns.map((column) => row[column] ?? ''));
  });
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as BlobPart, `${fileName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function importSpreadsheetRows(file: File): Promise<SpreadsheetRow[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = await file.text();
    const result = Papa.parse<SpreadsheetRow>(text, { header: true, skipEmptyLines: true });
    if (result.errors.length > 0) throw new Error(result.errors[0].message);
    return result.data;
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = cellValueToString(cell.value);
  });

  const rows: SpreadsheetRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item: SpreadsheetRow = {};
    let hasValue = false;

    headers.forEach((header, colNumber) => {
      if (!header) return;
      const value = cellValueToString(row.getCell(colNumber).value);
      item[header] = value;
      if (value) hasValue = true;
    });

    if (hasValue) rows.push(item);
  });

  return rows;
}

export function getSpreadsheetValue(row: SpreadsheetRow, aliases: string[]) {
  const wanted = aliases.map(normalizeHeader);
  const match = Object.entries(row).find(([key]) => wanted.includes(normalizeHeader(key)));
  return match ? String(match[1] ?? '').trim() : '';
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellValueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value).trim();

  const richValue = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
  if (richValue.text !== undefined) return String(richValue.text).trim();
  if (richValue.result !== undefined) return cellValueToString(richValue.result);
  if (Array.isArray(richValue.richText)) {
    return richValue.richText.map((part) => part.text ?? '').join('').trim();
  }

  return String(value).trim();
}
