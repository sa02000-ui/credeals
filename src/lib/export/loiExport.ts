/**
 * Structured LOI export. The LOI is modeled as a logo + heading + titled sections + signature block
 * + exhibit, then rendered to (a) a properly formatted, Word-openable .doc (rich HTML — bold section
 * headings, paragraphs, an embedded logo, real margins) and (b) a formatted PDF via jsPDF (logo at
 * top, bold headings, wrapped justified body, pagination). Also renders to plain text for the
 * on-screen preview / copy. No heavy dependencies: Word uses HTML, PDF uses the already-bundled jsPDF.
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
  for (const s of d.sections) parts.push(s.heading, s.body, '');
  parts.push(d.signoff, '', d.signatureBlock, '', d.exhibit.heading, d.exhibit.intro, ...d.exhibit.items.map((i) => `  • ${i}`));
  return parts.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const br = (s: string) => esc(s).replace(/\n/g, '<br/>');

/** Properly formatted, Word-openable .doc (rich HTML). */
export function downloadLoiDoc(d: LoiDoc, filename: string) {
  const logo = d.logoDataUrl
    ? `<div style="text-align:center;margin-bottom:18pt;"><img src="${d.logoDataUrl}" style="max-height:96px;max-width:300px;"/></div>`
    : '';
  const sections = d.sections
    .map((s) => `<p style="margin:12pt 0 2pt;font-weight:bold;text-transform:uppercase;letter-spacing:.3pt;">${esc(s.heading)}</p><p style="margin:0 0 8pt;text-align:justify;">${br(s.body)}</p>`)
    .join('');
  const items = d.exhibit.items.map((i) => `<li style="margin:2pt 0;">${esc(i)}</li>`).join('');
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(filename)}</title>
<style>@page{margin:1in;} body{font-family:'Calibri','Segoe UI',sans-serif;font-size:11pt;line-height:1.4;color:#111;} p{margin:6pt 0;}</style>
</head><body>${logo}<p>${esc(d.dateLine)}</p><p style="font-weight:bold;">${esc(d.reLine)}</p><p style="text-align:justify;">${br(d.intro)}</p>${sections}<p style="margin-top:14pt;">${br(d.signoff)}</p><p style="margin-top:10pt;">${br(d.signatureBlock)}</p><p style="margin-top:14pt;font-weight:bold;text-transform:uppercase;">${esc(d.exhibit.heading)}</p><p style="text-align:justify;">${br(d.exhibit.intro)}</p><ul>${items}</ul></body></html>`;
  triggerDownload(new Blob([html], { type: 'application/msword' }), filename.endsWith('.doc') ? filename : `${filename}.doc`);
}

/** Properly formatted PDF (jsPDF, dynamic import). */
export async function downloadLoiPdf(d: LoiDoc, filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const maxW = pw - margin * 2;
  let y = margin;
  const ensure = (h: number) => { if (y + h > ph - margin) { doc.addPage(); y = margin; } };

  if (d.logoDataUrl) {
    try {
      const fmt = d.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      const props = doc.getImageProperties(d.logoDataUrl);
      const maxH = 64;
      const maxWi = 220;
      const scale = Math.min(maxWi / props.width, maxH / props.height, 1);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(d.logoDataUrl, fmt, (pw - w) / 2, y, w, h);
      y += h + 16;
    } catch {
      /* bad image → skip the logo, still render the doc */
    }
  }

  const para = (text: string, opts: { bold?: boolean; size?: number; gap?: number; indent?: number } = {}) => {
    const { bold = false, size = 10.5, gap = 6, indent = 0 } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, maxW - indent) as string[]) {
      ensure(14);
      doc.text(line, margin + indent, y);
      y += 14;
    }
    y += gap;
  };

  para(d.dateLine, { gap: 4 });
  para(d.reLine, { bold: true, gap: 8 });
  para(d.intro, { gap: 8 });
  for (const s of d.sections) {
    para(s.heading.toUpperCase(), { bold: true, gap: 1 });
    para(s.body, { gap: 6 });
  }
  y += 4;
  para(d.signoff, { gap: 8 });
  para(d.signatureBlock, { gap: 8 });
  para(d.exhibit.heading.toUpperCase(), { bold: true, gap: 1 });
  para(d.exhibit.intro, { gap: 4 });
  for (const it of d.exhibit.items) para(`•  ${it}`, { gap: 1, indent: 12 });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
