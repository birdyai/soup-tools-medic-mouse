// Medic Mouse - Unified File Browser
// Serves every HTML/MD asset from both medic-mouse trees behind one port.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4500;

// Source roots (mounted under /a and /b so filenames don't collide)
const ROOTS = {
  '/a': '/Users/markjarvis/.openclaw/workspace/medic-mouse',
  '/b': '/Users/markjarvis/workspace/medic-mouse',
  '/specs': '/Users/markjarvis/.openclaw/workspace', // for top-level medic-mouse-*.md files
};

// Static mounts
for (const [mount, root] of Object.entries(ROOTS)) {
  app.use(mount, express.static(root, { index: false, dotfiles: 'ignore' }));
}

// Render markdown files to a basic HTML wrapper so they're readable in browser
function renderMarkdown(absPath) {
  const md = fs.readFileSync(absPath, 'utf8');
  // Very minimal MD -> HTML (headings, code, bullets); keep deps free.
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/```([\s\S]*?)```/g, (_m, code) => `<pre><code>${code}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${path.basename(absPath)}</title>
  <style>body{font:15px/1.55 -apple-system,sans-serif;max-width:780px;margin:40px auto;padding:0 20px;color:#222}
  h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:6px}
  pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow:auto}
  code{background:#f4f4f4;padding:2px 5px;border-radius:3px;font-size:13px}
  pre code{background:none;padding:0}
  a{color:#06f}
  </style></head><body><p><a href="/">← back to index</a></p><p>${html}</p></body></html>`;
}

// Markdown handler (intercept .md before static would 200 with raw text)
app.get(/\.md$/, (req, res, next) => {
  // Find which root the path corresponds to
  const url = decodeURIComponent(req.path);
  for (const [mount, root] of Object.entries(ROOTS)) {
    if (url.startsWith(mount + '/')) {
      const rel = url.slice(mount.length);
      const abs = path.join(root, rel);
      if (fs.existsSync(abs)) {
        try { return res.send(renderMarkdown(abs)); }
        catch (e) { return res.status(500).send('Failed: ' + e.message); }
      }
    }
  }
  return next();
});

// Build the master index
function listFiles() {
  const groups = [];

  function walk(rootMount, rootDir, label) {
    const entries = [];
    function visit(rel) {
      const abs = path.join(rootDir, rel);
      let stat; try { stat = fs.statSync(abs); } catch { return; }
      if (stat.isDirectory()) {
        if (rel.includes('node_modules')) return;
        for (const child of fs.readdirSync(abs)) {
          if (child.startsWith('.')) continue;
          visit(path.join(rel, child));
        }
      } else {
        if (/\.(html|md)$/i.test(rel)) {
          entries.push({
            url: rootMount + '/' + rel.split(path.sep).join('/'),
            rel,
            size: stat.size,
            mtime: stat.mtime,
          });
        }
      }
    }
    visit('');
    entries.sort((a, b) => a.rel.localeCompare(b.rel));
    groups.push({ label, mount: rootMount, root: rootDir, entries });
  }

  walk('/a', ROOTS['/a'], '~/.openclaw/workspace/medic-mouse (canonical)');
  walk('/b', ROOTS['/b'], '~/workspace/medic-mouse (working/active)');

  // Just the top-level medic-mouse-*.md spec docs from /specs
  const specs = [];
  for (const f of fs.readdirSync(ROOTS['/specs'])) {
    if (/^medic-mouse.*\.md$/i.test(f)) {
      const abs = path.join(ROOTS['/specs'], f);
      const stat = fs.statSync(abs);
      specs.push({
        url: '/specs/' + f,
        rel: f,
        size: stat.size,
        mtime: stat.mtime,
      });
    }
  }
  specs.sort((a, b) => a.rel.localeCompare(b.rel));
  groups.push({ label: 'Top-level spec docs (~/.openclaw/workspace)', mount: '/specs', root: ROOTS['/specs'], entries: specs });

  return groups;
}

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(2) + ' MB';
}

app.get('/', (_req, res) => {
  const groups = listFiles();
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Medic Mouse — File Index</title>
  <style>
    body{font:15px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;max-width:1000px;margin:30px auto;padding:0 20px;color:#222;background:#fafafa}
    h1{margin:0 0 6px}
    .sub{color:#666;margin-bottom:24px}
    h2{margin-top:32px;border-bottom:2px solid #06f;padding-bottom:6px;color:#06f}
    .root{color:#888;font-family:monospace;font-size:12px;margin-bottom:8px}
    table{border-collapse:collapse;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee;font-size:14px}
    th{background:#f0f3f7;color:#444;font-weight:600}
    tr:hover{background:#f8f9fb}
    a{color:#06f;text-decoration:none}
    a:hover{text-decoration:underline}
    .ext-html{color:#0a8}
    .ext-md{color:#a06}
    code{background:#f0f0f0;padding:2px 5px;border-radius:3px;font-size:12px}
    .empty{color:#999;font-style:italic;padding:12px}
  </style></head><body>
  <h1>🐭 Medic Mouse — File Index</h1>
  <div class="sub">All HTML pages and markdown docs across both Medic Mouse folders. Click a row to open it. Updated: ${new Date().toLocaleString()}</div>`;

  for (const g of groups) {
    html += `<h2>${g.label}</h2><div class="root">${g.root}</div>`;
    if (!g.entries.length) {
      html += '<div class="empty">no files</div>';
      continue;
    }
    html += '<table><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead><tbody>';
    for (const e of g.entries) {
      const ext = e.rel.split('.').pop().toLowerCase();
      html += `<tr>
        <td><a href="${e.url}">${e.rel}</a></td>
        <td class="ext-${ext}">${ext.toUpperCase()}</td>
        <td>${fmtSize(e.size)}</td>
        <td>${e.mtime.toISOString().slice(0,16).replace('T',' ')}</td>
      </tr>`;
    }
    html += '</tbody></table>';
  }

  html += '</body></html>';
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Medic Mouse index server running on http://localhost:${PORT}`);
});
