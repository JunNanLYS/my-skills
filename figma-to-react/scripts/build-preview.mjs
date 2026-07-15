// Build the unified preview page: compile each dist/<Name>/<Name>.jsx via esbuild,
// emit dist-esm/<Name>/<Name>.js, then write preview/index.html + preview/preview.js.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import * as esbuild from 'esbuild';
import { renderPreviewHtml } from '../templates/preview.html.mjs';

export async function buildPreview({ workdir }) {
  const distDir = join(workdir, 'dist');
  const distEsmDir = join(workdir, 'dist-esm');
  const previewDir = join(workdir, 'preview');

  const entries = await readdir(distDir, { withFileTypes: true });
  const componentDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  if (componentDirs.length === 0) {
    throw new Error('No components found under ' + distDir);
  }

  await mkdir(distEsmDir, { recursive: true });
  await mkdir(previewDir, { recursive: true });

  // Compile each component JSX → ESM.
  for (const name of componentDirs) {
    const entry = join(distDir, name, `${name}.jsx`);
    const outDir = join(distEsmDir, name);
    await mkdir(outDir, { recursive: true });
    await esbuild.build({
      entryPoints: [entry],
      outfile: join(outDir, `${name}.js`),
      format: 'esm',
      jsx: 'automatic',
      bundle: true,
      loader: { '.js': 'jsx', '.jsx': 'jsx' },
      external: ['react', 'react-dom', 'react-dom/client'],
      logLevel: 'silent',
    });
  }

  // Write preview/index.html.
  await writeFile(join(previewDir, 'index.html'), renderPreviewHtml(componentDirs), 'utf8');

  // Write preview/preview.js — dynamic import of each compiled component, mount to its section.
  const importLines = componentDirs.map(n => `import ${n} from '../dist-esm/${n}/${n}.js';`).join('\n');
  const mapEntries = componentDirs.map(n => `  ${n}: document.getElementById('mount-${n}')`).join(',\n');
  const renderLines = componentDirs.map(n =>
    `  const mount = mounts.${n};\n  if (mount) createRoot(mount).render(React.createElement(${n}));`
  ).join('\n');

  const previewJs = `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n${importLines}\n\nconst mounts = {\n${mapEntries}\n};\n\n${renderLines}\n`;
  await writeFile(join(previewDir, 'preview.js'), previewJs, 'utf8');

  return { components: componentDirs, outputDir: previewDir };
}
