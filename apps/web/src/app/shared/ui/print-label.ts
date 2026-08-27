/**
 * Opens a print window with a simple label layout for an asset/employee/vehicle number.
 */
export function printLabel(opts: {
  number: string;
  title: string;
  subtitle?: string;
  meta?: Array<{ label: string; value: string }>;
}): void {
  const { number, title, subtitle, meta = [] } = opts;

  const metaRows = meta
    .map((m) => `<tr><td class="meta-label">${escapeHtml(m.label)}</td><td class="meta-value">${escapeHtml(m.value)}</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(number)} - ${escapeHtml(title)}</title>
<style>
  @page { size: 100mm 60mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #fff;
  }
  .label {
    width: 90mm;
    padding: 6mm 5mm;
    border: 2px solid #111;
    border-radius: 4px;
  }
  .label-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #111;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  .label-brand { font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
  .label-type { font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; }
  .label-number {
    font-size: 28px;
    font-weight: 800;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.04em;
    text-align: center;
    padding: 8px 0;
    border: 1px dashed #999;
    border-radius: 3px;
    margin: 6px 0;
  }
  .label-subtitle { font-size: 11px; color: #444; text-align: center; margin-bottom: 4px; }
  .label-meta { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .label-meta td { font-size: 10px; padding: 2px 0; }
  .meta-label { color: #888; font-weight: 600; width: 40%; }
  .meta-value { color: #222; font-weight: 500; }
  .label-footer {
    margin-top: 6px;
    padding-top: 4px;
    border-top: 1px solid #ddd;
    font-size: 8px;
    color: #aaa;
    text-align: center;
  }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
  <div class="label">
    <div class="label-header">
      <span class="label-brand">Viridian Warehouse</span>
      <span class="label-type">${escapeHtml(title)}</span>
    </div>
    <div class="label-number">${escapeHtml(number)}</div>
    ${subtitle ? `<div class="label-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    ${metaRows ? `<table class="label-meta">${metaRows}</table>` : ''}
    <div class="label-footer">Printed ${new Date().toLocaleString()}</div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=400,height=300');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
