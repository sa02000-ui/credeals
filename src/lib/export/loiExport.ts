/**
 * Structured LOI export, rendered to match the original LOI templates: a two-column TERM SHEET — the
 * bold term label on the left, the provision text on the right — under a date line + intro, followed
 * by the signature block and Exhibit A-1. Produces (a) a properly formatted, Word-openable .doc (a
 * borderless HTML table, embedded logo, 1in margins) and (b) a formatted PDF via jsPDF (logo, the same
 * left-label / right-body two-column layout, pagination). Plain text is also available for the preview.
 */

export interface LoiSection {
  heading: string;
  body: string;
}
export interface LoiDoc {
  /** data: URL of an uploaded logo (png/jpg) shown centered at the top */
  logoDataUrl?: string;
  dateLine: string;
  reLine: string;
  intro: string;
  sections: LoiSection[];
  signoff: string;
  signatureBlock: string;
  exhibit: { heading: string; intro: string; items: string[] };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Plain-text rendering (for the on-screen preview, the .txt download and Copy). */
export function loiToText(d: LoiDoc): string {
  const parts: string[] = [d.dateLine, '', d.reLine, '', d.intro, ''];
  for (const s of d.sections) parts.push(`${s.heading.toUpperCase()}`, s.body, '');
  parts.push(d.signoff, '', d.signatureBlock, '', d.exhibit.heading, d.exhibit.intro, ...d.exhibit.items.map((i) => `  • ${i}`));
  return parts.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const br = (s: string) => esc(s).replace(/\n/g, '<br/>');

/** Properly formatted, Word-openable .doc — a borderless two-column term sheet (matches the template). */
export function downloadLoiDoc(d: LoiDoc, filename: string) {
  const logo = d.logoDataUrl
    ? `<div style="text-align:center;margin-bottom:18pt;"><img src="${d.logoDataUrl}" style="max-height:96px;max-width:300px;"/></div>`
    : '';
  const rows = d.sections
    .map(
      (s) =>
        `<tr><td style="width:23%;vertical-align:top;padding:7pt 10pt 7pt 0;font-weight:bold;">${esc(s.heading)}</td><td style="vertical-align:top;padding:7pt 0;text-align:justify;">${br(s.body)}</td></tr>`,
    )
    .join('');
  const items = d.exhibit.items.map((i) => `<li style="margin:2pt 0;">${esc(i)}</li>`).join('');
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(filename)}</title>
<style>@page{margin:1in;} body{font-family:'Calibri','Segoe UI',sans-serif;font-size:11pt;line-height:1.35;color:#111;} p{margin:6pt 0;} table{width:100%;border-collapse:collapse;} td{border:none;}</style>
</head><body>${logo}<p>${esc(d.dateLine)}</p><p style="font-weight:bold;">${esc(d.reLine)}</p><p style="text-align:justify;">${br(d.intro)}</p>
<table>${rows}</table>
<p style="margin-top:16pt;">${br(d.signoff)}</p><p style="margin-top:10pt;">${br(d.signatureBlock)}</p>
<p style="margin-top:16pt;font-weight:bold;text-transform:uppercase;">${esc(d.exhibit.heading)}</p><p style="text-align:justify;">${br(d.exhibit.intro)}</p><ul>${items}</ul></body></html>`;
  triggerDownload(new Blob([html], { type: 'application/msword' }), filename.endsWith('.doc') ? filename : `${filename}.doc`);
}

/** Properly formatted PDF (jsPDF, dynamic import) — same two-column term-sheet layout. */
export async function downloadLoiPdf(d: LoiDoc, filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const maxW = pw - margin * 2;
  const labelW = 130;
  const gap = 14;
  const bodyX = margin + labelW + gap;
  const bodyW = maxW - labelW - gap;
  const LH = 13.5;
  let y = margin;
  const ensure = (h: number) => { if (y + h > ph - margin) { doc.addPage(); y = margin; } };

  if (d.logoDataUrl) {
    try {
      const fmt = d.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      const props = doc.getImageProperties(d.logoDataUrl);
      const scale = Math.min(220 / props.width, 64 / props.height, 1);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(d.logoDataUrl, fmt, (pw - w) / 2, y, w, h);
      y += h + 16;
    } catch {
      /* bad image → skip the logo, still render the doc */
    }
  }

  const para = (text: string, opts: { bold?: boolean; size?: number; gap?: number; indent?: number; width?: number } = {}) => {
    const { bold = false, size = 10.5, gap: g = 6, indent = 0, width = maxW - indent } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, width) as string[]) {
      ensure(LH);
      doc.text(line, margin + indent, y);
      y += LH;
    }
    y += g;
  };

  para(d.dateLine, { gap: 4 });
  para(d.reLine, { bold: true, gap: 8 });
  para(d.intro, { gap: 10 });

  // Two-column term rows
  for (const s of d.sections) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    const labelLines = doc.splitTextToSize(s.heading, labelW) as string[];
    doc.setFont('helvetica', 'normal');
    const bodyLines = doc.splitTextToSize(s.body, bodyW) as string[];
    const rowH = Math.max(labelLines.length, bodyLines.length) * LH;
    ensure(Math.min(rowH, LH * 2) + 6);
    const startY = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    labelLines.forEach((ln, i) => doc.text(ln, margin, startY + i * LH));
    doc.setFont('helvetica', 'normal');
    let by = startY;
    for (const ln of bodyLines) {
      if (by > ph - margin) { doc.addPage(); by = margin; }
      doc.text(ln, bodyX, by);
      by += LH;
    }
    y = Math.max(startY + labelLines.length * LH, by) + 8;
    // faint separator
    if (y < ph - margin) { doc.setDrawColor(225); doc.line(margin, y - 4, pw - margin, y - 4); }
  }

  y += 6;
  para(d.signoff, { gap: 10 });
  para(d.signatureBlock, { gap: 10 });
  para(d.exhibit.heading.toUpperCase(), { bold: true, gap: 2 });
  para(d.exhibit.intro, { gap: 4 });
  for (const it of d.exhibit.items) para(`•  ${it}`, { gap: 1, indent: 12 });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
