/**
 * Client-side document export. Word is produced as a Word-compatible HTML document (.doc) — zero
 * dependency, opens cleanly in Microsoft Word / Google Docs. PDF uses jsPDF (dynamic import so it
 * stays out of the main bundle). Both take plain text (e.g., the generated LOI) and download a file.
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download `text` as a Word-openable .doc (HTML under the hood). */
export function downloadDoc(text: string, filename: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${filename}</title>
<style>@page{margin:1in;} body{font-family:'Calibri',sans-serif;font-size:11pt;line-height:1.4;white-space:pre-wrap;}</style>
</head><body>${escaped}</body></html>`;
  triggerDownload(new Blob([html], { type: 'application/msword' }), filename.endsWith('.doc') ? filename : `${filename}.doc`);
}

/** Download `text` as a real PDF (jsPDF), paginated at letter size. */
export async function downloadPdf(text: string, filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54; // 0.75in
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const lineHeight = 14;

  // wrap each source line independently so blank lines and structure survive
  const wrapped: string[] = [];
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') {
      wrapped.push('');
      continue;
    }
    for (const piece of doc.splitTextToSize(raw, maxWidth) as string[]) wrapped.push(piece);
  }

  let y = margin;
  for (const line of wrapped) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    if (line) doc.text(line, margin, y);
    y += lineHeight;
  }
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
