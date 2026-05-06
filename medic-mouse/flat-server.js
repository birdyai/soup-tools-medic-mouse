// Medic Mouse - Flat file server
// Serves every .html / .md file from this folder at the root path.
// e.g. http://localhost:8086/medic-mouse-test-dashboard.html
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8086;
const ROOT = __dirname;

// Static files at root (HTML, CSS, JS, JSON, etc.)
app.use(express.static(ROOT, { index: false, dotfiles: 'ignore', extensions: ['html'] }));

// Render markdown to a simple readable HTML
app.get(/\.md$/, (req, res, next) => {
  const rel = decodeURIComponent(req.path).replace(/^\/+/, '');
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return next();
  let md;
  try { md = fs.readFileSync(abs, 'utf8'); } catch (e) { return res.status(500).send(e.message); }
  const html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/```([\s\S]*?)```/g, (_m, c) => `<pre><code>${c}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>');
  res.send(`<!doctype html><meta charset="utf-8"><title>${path.basename(abs)}</title>
  <style>body{font:15px/1.55 -apple-system,sans-serif;max-width:780px;margin:40px auto;padding:0 20px}
  pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow:auto}
  code{background:#f4f4f4;padding:2px 5px;border-radius:3px}pre code{background:none;padding:0}
  a{color:#06f}</style><p><a href="/">← back</a></p><p>${html}</p>`);
});

// Index page listing all HTML/MD files
function listFiles() {
  const files = [];
  function walk(rel) {
    const abs = path.join(ROOT, rel);
    let stat;
    try { stat = fs.statSync(abs); } catch { return; }
    if (stat.isDirectory()) {
      if (rel.includes('node_modules') || rel.startsWith('.')) return;
      for (const c of fs.readdirSync(abs)) {
        if (c.startsWith('.')) continue;
        walk(path.join(rel, c));
      }
    } else if (/\.(html|md)$/i.test(rel)) {
      files.push({ rel, size: stat.size, mtime: stat.mtime });
    }
  }
  walk('');
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files;
}

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(2) + ' MB';
}

app.get('/', (_req, res) => {
  const files = listFiles();
  const rows = files.map(f => {
    const ext = f.rel.split('.').pop().toLowerCase();
    const url = '/' + f.rel.split(path.sep).join('/');
    return `<tr>
      <td><a href="${url}">${f.rel}</a></td>
      <td>${ext.toUpperCase()}</td>
      <td>${fmtSize(f.size)}</td>
      <td>${f.mtime.toISOString().slice(0,16).replace('T',' ')}</td>
    </tr>`;
  }).join('');
  res.send(`<!doctype html><meta charset="utf-8"><title>Medic Mouse — Files</title>
  <style>
    body{font:15px/1.5 -apple-system,sans-serif;max-width:1000px;margin:30px auto;padding:0 20px;color:#222;background:#fafafa}
    h1{margin:0 0 4px}
    .sub{color:#666;margin-bottom:20px}
    table{border-collapse:collapse;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee;font-size:14px}
    th{background:#f0f3f7;font-weight:600}
    tr:hover{background:#f8f9fb}
    a{color:#06f;text-decoration:none}
    a:hover{text-decoration:underline}
    code{background:#eef;padding:2px 6px;border-radius:3px;font-size:13px}
  </style>
  <h1>🐭 Medic Mouse</h1>
  <div class="sub">Serving <code>${ROOT}</code> on <code>localhost:${PORT}</code> — ${files.length} files</div>
  <table><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead><tbody>${rows}</tbody></table>`);
});

app.listen(PORT, () => {
  console.log(`Medic Mouse flat server: http://localhost:${PORT}`);
});
