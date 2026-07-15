// Render the unified preview HTML page given the list of component names.
export function renderPreviewHtml(componentNames) {
  const sections = componentNames.map(name => `      <section data-component="${escapeAttr(name)}">
        <h2>${escapeHtml(name)}</h2>
        <div id="mount-${escapeAttr(name)}"></div>
      </section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Figma → React Preview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; background: #F9FAFB; color: #111827; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 4px 0; font-size: 20px; }
    p { margin: 0; color: #6B7280; font-size: 13px; }
    section { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-bottom: 16px; }
    section h2 { margin: 0 0 16px 0; font-size: 14px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <header>
    <h1>Figma → React Preview</h1>
    <p>All components rendered in one page. Open this file via a static server (e.g. <code>npx serve .</code> or <code>python -m http.server</code>).</p>
  </header>
  <main>
${sections}
  </main>
  <script type="module" src="./preview.js"></script>
</body>
</html>
`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
