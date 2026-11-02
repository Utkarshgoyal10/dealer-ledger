import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const fileName = (report, ext) =>
  `${report.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${ext}`;

export async function sendExcel(res, report) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  ws.addRow([report.title]).font = { bold: true, size: 14 };
  if (report.subtitle) ws.addRow([report.subtitle]);
  ws.addRow([]);
  const header = ws.addRow(report.columns.map((c) => c.label));
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  });
  for (const r of report.rows) ws.addRow(report.columns.map((c) => r[c.key] ?? ''));
  if (report.totals) ws.addRow(report.columns.map((c) => report.totals[c.key] ?? '')).font = { bold: true };

  report.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.type === 'text' ? 22 : 15;
    if (c.type === 'money') col.numFmt = '#,##0.00';
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName(report, 'xlsx')}"`);
  await wb.xlsx.write(res);
  res.end();
}

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function sendPdf(res, report) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName(report, 'pdf')}"`);
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(14).text(report.title);
  if (report.subtitle) doc.font('Helvetica').fontSize(9).fillColor('#555').text(`${report.subtitle}  •  Amounts in Rs.`);
  doc.fillColor('#000').moveDown(0.6);

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const weights = report.columns.map((c) => (c.type === 'text' ? 2 : 1.2));
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / sum) * width);
  const rowH = 16;

  const drawRow = (cells, { bold = false, fill } = {}) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawRow(report.columns.map((c) => c.label), { bold: true, fill: '#E5E7EB' });
    }
    const y = doc.y;
    if (fill) doc.rect(left, y, width, rowH).fill(fill).fillColor('#000');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    let x = left;
    report.columns.forEach((c, i) => {
      const v = cells[i];
      const text = c.type === 'money' && typeof v === 'number' ? fmtMoney(v) : String(v ?? '');
      doc.text(text, x + 3, y + 4, { width: widths[i] - 6, height: rowH - 4, ellipsis: true, lineBreak: false, align: c.type === 'text' ? 'left' : 'right' });
      x += widths[i];
    });
    doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.x = left;
    doc.y = y + rowH;
  };

  drawRow(report.columns.map((c) => c.label), { bold: true, fill: '#E5E7EB' });
  for (const r of report.rows) drawRow(report.columns.map((c) => r[c.key]));
  if (report.totals) drawRow(report.columns.map((c) => report.totals[c.key] ?? ''), { bold: true, fill: '#F3F4F6' });
  if (!report.rows.length) doc.moveDown().font('Helvetica').fontSize(9).text('No data for this period.');

  doc.end();
}
