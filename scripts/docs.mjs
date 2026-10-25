import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import hljs from 'highlight.js';
import ts from 'typescript';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/developer-guide.md');
const source = await fs.readFile(sourcePath, 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
const headings = [...source.matchAll(/^#{1,6} (.+)$/gm)].map(match => ({ title: match[1], id: slug(match[1]) }));
if (new Set(headings.map(h => h.id)).size !== headings.length) throw new Error('Duplicate heading IDs');
async function check() {
  const actual = await projectFiles();
  const links = [];
  for (const relative of actual.filter(file => file.endsWith('.md'))) {
    const filename = path.join(root, relative);
    const markdown = await fs.readFile(filename, 'utf8');
    const ownHeadings = [...markdown.matchAll(/^#{1,6} (.+)$/gm)].map(match => slug(match[1]));
    const tokens = marked.lexer(markdown);
    const fileLinks = [];
    marked.walkTokens(tokens, token => { if (token.type === 'link' || token.type === 'image') fileLinks.push(token.href); });
    for (const href of fileLinks) {
      links.push(href);
      if (/^https?:\/\//.test(href)) { new URL(href); continue; }
      if (/^[a-z]+:/i.test(href)) throw new Error(`Unsupported link: ${href}`);
      const [file, anchor] = href.split('#');
      if (!file) { if (anchor && !ownHeadings.includes(decodeURIComponent(anchor))) throw new Error(`Missing anchor: ${relative} ${href}`); continue; }
      const resolved = path.resolve(path.dirname(filename), decodeURIComponent(file));
      if (!resolved.startsWith(root + path.sep)) throw new Error(`Link escapes repository: ${href}`);
      await fs.access(resolved);
      if (anchor) {
        if (!resolved.endsWith('.md')) throw new Error(`Unsupported file anchor: ${href}`);
        const target = await fs.readFile(resolved, 'utf8');
        if (![...target.matchAll(/^#{1,6} (.+)$/gm)].some(match => slug(match[1]) === decodeURIComponent(anchor))) throw new Error(`Missing file anchor: ${href}`);
      }
    }
  }
  for (const ref of source.matchAll(/<!-- code-ref:([^#\s]+)#([^\s]+) -->/g)) {
    const filename = path.resolve(root, ref[1]);
    if (!filename.startsWith(root + path.sep)) throw new Error('Invalid code reference');
    const code = await fs.readFile(filename, 'utf8');
    const ast = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
    let found = false;
    function visit(node) { if (node.name && ts.isIdentifier(node.name) && node.name.text === ref[2]) found = true; ts.forEachChild(node, visit); }
    visit(ast); if (!found) throw new Error(`Missing code symbol: ${ref[1]}#${ref[2]}`);
  }
  const tree = source.match(/<!-- project-tree -->\s*```text\n([\s\S]*?)```/);
  if (!tree || tree[1].trim() !== actual.join('\n')) throw new Error('Project tree is stale; update Markdown from the actual project files');
  console.log(`Documentation checks passed: ${links.length} links, ${[...source.matchAll(/<!-- code-ref:/g)].length} code references, ${actual.length} files`);
}
async function projectFiles(dir = root) {
  const excluded = new Set(['.git', 'node_modules', 'dist', '.DS_Store', 'coverage']);
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.endsWith('.tsbuildinfo')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await projectFiles(full));
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out.sort();
}
await check();
if (process.argv[2] === 'check') process.exit(0);
const renderer = new marked.Renderer();
renderer.heading = ({ text, depth }) => `<h${depth} id="${slug(text)}">${text}</h${depth}>`;
renderer.code = ({ text, lang }) => {
  if (lang === 'flow') {
    const nodes = text.split('\n').map(line => line.trim()).filter(Boolean);
    const height = nodes.length * 72 + 10;
    return `<svg class="flow-diagram" viewBox="0 0 720 ${height}" role="img" aria-label="${escape(nodes.join(' → '))}"><defs><marker id="arrow-${slug(nodes[0])}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="currentColor"/></marker></defs>${nodes.map((label, i) => `<rect x="20" y="${i * 72 + 5}" width="680" height="48" rx="10"/><text x="360" y="${i * 72 + 35}" text-anchor="middle">${escape(label)}</text>${i < nodes.length - 1 ? `<path class="arrow" d="M360 ${i * 72 + 53}V${i * 72 + 74}" marker-end="url(#arrow-${slug(nodes[0])})"/>` : ''}`).join('')}</svg>`;
  }
  return `<pre><code class="hljs language-${escape(lang || 'text')}">${lang && hljs.getLanguage(lang) ? hljs.highlight(text, { language: lang }).value : escape(text)}</code></pre>`;
};
renderer.link = ({ href, text }) => {
  let target = href;
  if (!href.startsWith('#') && !/^https?:/.test(href)) target = `https://github.com/RongRongRabbit/awsflowlab/blob/main/${path.relative(root, path.resolve(path.dirname(sourcePath), href)).split(path.sep).join('/')}`;
  return `<a href="${escape(target)}">${text}</a>`;
};
const content = marked.parse(source, { renderer });
const theme = await fs.readFile(path.join(root, 'node_modules/highlight.js/styles/github-dark.css'), 'utf8');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AWS FlowLab Developer Guide</title><style>
:root{color-scheme:dark;--bg:#0b1220;--panel:#142138;--text:#e8eefb;--line:#354865;--link:#85bfff}html[data-theme=light]{color-scheme:light;--bg:#f6f8fc;--panel:#fff;--text:#192a42;--line:#c8d4e4;--link:#155fba}*{box-sizing:border-box}body{margin:0;font:16px/1.8 system-ui,sans-serif;background:var(--bg);color:var(--text)}header{padding:16px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:16px}button{cursor:pointer;background:var(--panel);color:var(--text);border:1px solid var(--line);padding:8px 12px;border-radius:8px}.layout{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1400px;margin:auto}nav{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto;padding:22px}nav a{display:block;padding:5px;font-size:14px}main{padding:24px 36px;min-width:0}a{color:var(--link)}h2{border-top:1px solid var(--line);padding-top:25px;scroll-margin-top:20px}pre{overflow:auto;border:1px solid var(--line);border-radius:10px;padding:16px;background:#0d1117;color:#e6edf3}code{font-size:.9em}table{border-collapse:collapse;display:block;overflow:auto}th,td{padding:10px;border:1px solid var(--line)}.flow-diagram{width:100%;max-width:720px;color:var(--link)}.flow-diagram rect{fill:var(--panel);stroke:var(--line)}.flow-diagram text{fill:var(--text);font:15px system-ui,sans-serif}.arrow{stroke:currentColor;fill:none}blockquote{border-left:3px solid var(--link);margin-left:0;padding:8px 18px;background:var(--panel)}${theme}@media(max-width:800px){.layout{display:block}nav{position:static;max-height:none;display:flex;flex-wrap:wrap;gap:8px}main{padding:16px}header{flex-wrap:wrap}}
</style></head><body><header><strong>AWS FlowLab · Developer Guide</strong><div><a href="../">返回 App</a> <button id="theme" aria-label="切换深浅模式">切换深浅模式</button></div></header><div class="layout"><nav aria-label="章节导航">${headings.map(h => `<a href="#${h.id}">${escape(h.title)}</a>`).join('')}</nav><main>${content}</main></div><script>const button=document.getElementById('theme');let saved;try{saved=localStorage.getItem('flowlab-docs-theme')}catch{}document.documentElement.dataset.theme=saved||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');button.addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('flowlab-docs-theme',theme)}catch{}});</script></body></html>`;
const output = path.join(root, 'dist/developer-guide');
await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'index.html'), html);
console.log('Built dist/developer-guide/index.html');
