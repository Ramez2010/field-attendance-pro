import Papa from 'papaparse';

export function exportCsv<T extends Record<string, unknown>>(rows: T[], fileName: string) {
  const csv = Papa.unparse(rows);
  downloadBlob(csv, `${fileName}.csv`, 'text/csv;charset=utf-8;');
}

export function exportExcel<T extends Record<string, unknown>>(rows: T[], fileName: string) {
  const headers = Object.keys(rows[0] ?? {});
  const headerCells = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(row[header] ?? ''))}</td>`).join('')}</tr>`)
    .join('');
  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"></head>
      <body><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body>
    </html>
  `;
  downloadBlob(workbook, `${fileName}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
