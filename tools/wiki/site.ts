// Page chrome, stylesheet and client script for the wiki. Self-contained: no CDNs, no external fonts, works from file://.
import { esc } from './lib';

export interface NavItem { title: string; path: string; children?: NavItem[] }
export interface Crumb { title: string; path: string }

/** Relative URL from page `from` to page or asset `to` (both site-root paths, e.g. "heroes/owl.html"). */
export function rel(from: string, to: string): string {
  const a = from.split('/').slice(0, -1);
  const b = to.split('/');
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/') || to;
}

export function layout(opts: {
  path: string; title: string; description: string; nav: NavItem[]; crumbs: Crumb[]; body: string; stage: number; date: string;
}): string {
  const { path, title } = opts;
  const link = (t: string) => rel(path, t);
  const navHtml = opts.nav.map((n) => {
    const open = path === n.path || path.startsWith(n.path.replace(/index\.html$/, '')) && n.path.endsWith('index.html') && n.path !== 'index.html';
    const kids = (n.children ?? []).map((c) => `<li${c.path === path ? ' class="here"' : ''}><a href="${link(c.path)}">${esc(c.title)}</a></li>`).join('');
    return `<li class="${path === n.path ? 'here' : ''}"><a href="${link(n.path)}">${esc(n.title)}</a>` +
      (kids ? `<details${open ? ' open' : ''}><summary>more</summary><ul>${kids}</ul></details>` : '') + '</li>';
  }).join('');
  const crumbs = opts.crumbs.map((c) => `<a href="${link(c.path)}">${esc(c.title)}</a>`).join(' <span aria-hidden="true">›</span> ');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · PERCH Wiki</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${link('assets/wiki.css')}">
<script>try{var t=localStorage.getItem('perch-wiki-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<header class="top">
  <button class="menu-btn" aria-label="Toggle menu" aria-expanded="false">☰</button>
  <a class="brand" href="${link('index.html')}"><span class="logo" aria-hidden="true"></span>PERCH <small>Wiki</small></a>
  <form class="search" role="search" onsubmit="return false"><input id="q" type="search" placeholder="Search heroes, items, mechanics…" aria-label="Search the wiki" autocomplete="off"><ul id="results" hidden></ul></form>
  <button class="theme-btn" aria-label="Switch light or dark theme">◐</button>
</header>
<div class="shell">
  <nav class="side" aria-label="Wiki sections"><ul>${navHtml}</ul></nav>
  <main>
    ${crumbs ? `<p class="crumbs">${crumbs}</p>` : ''}
    <article>${opts.body}</article>
    <footer>Last regenerated ${esc(opts.date)} · Stage ${opts.stage} (M${opts.stage - 1}). Generated from the game's own data by <code>npm run wiki</code>.</footer>
  </main>
</div>
<div id="lightbox" hidden><img alt=""><p></p></div>
<script src="${link('assets/search-index.js')}"></script>
<script>window.WIKI_ROOT=${JSON.stringify(rel(path, 'index.html').replace(/index\.html$/, ''))};</script>
<script src="${link('assets/wiki.js')}"></script>
</body>
</html>
`;
}

export const CSS = `/* PERCH wiki. Palette follows GDD section 14: Dawn amber, Dusk violet-blue, warm stone, moss. */
:root{--bg:#f6f1e6;--panel:#fffdf7;--panel2:#efe7d6;--ink:#2a2620;--muted:#6d6558;--line:#d9cfb8;--link:#1d5fb8;--dawn:#f5a623;--dawn-l:#ffd27a;--dawn-d:#a86a0c;--dusk:#6b6bff;--dusk-l:#b0b0ff;--dusk-d:#3a3aa8;--moss:#5f7f4a;--bad:#b3392b;--good:#2f7d4a;--shadow:0 1px 3px rgba(40,30,10,.15)}
:root[data-theme=dark]{--bg:#14161b;--panel:#1d2027;--panel2:#262a33;--ink:#ece7dc;--muted:#a39b8a;--line:#383d49;--link:#8db8ff;--dawn:#f5a623;--dawn-l:#ffd27a;--dawn-d:#c98411;--dusk:#8a8aff;--dusk-l:#b0b0ff;--dusk-d:#6b6bff;--moss:#8fb178;--bad:#ff7b6b;--good:#7ed49b;--shadow:0 1px 3px rgba(0,0,0,.5)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#14161b;--panel:#1d2027;--panel2:#262a33;--ink:#ece7dc;--muted:#a39b8a;--line:#383d49;--link:#8db8ff;--dusk:#8a8aff;--dawn-d:#c98411;--dusk-d:#6b6bff;--moss:#8fb178;--bad:#ff7b6b;--good:#7ed49b;--shadow:0 1px 3px rgba(0,0,0,.5)}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--link)}
code{background:var(--panel2);padding:.05em .35em;border-radius:4px;font-size:.92em}
img{max-width:100%;height:auto}
kbd{background:var(--panel2);border:1px solid var(--line);border-bottom-width:3px;border-radius:5px;padding:.05em .4em;font:inherit;font-size:.9em;white-space:nowrap}
.top{position:sticky;top:0;z-index:20;display:flex;gap:.75rem;align-items:center;padding:.5rem 1rem;background:linear-gradient(90deg,var(--dawn-d),#3b3a5a 55%,var(--dusk-d));color:#fff;box-shadow:var(--shadow)}
.brand{color:#fff;text-decoration:none;font-weight:800;letter-spacing:.08em;font-size:1.25rem;display:flex;align-items:center;gap:.5rem;white-space:nowrap}
.brand small{font-weight:500;letter-spacing:.02em;opacity:.85}
.logo{width:1.4rem;height:1.4rem;background:var(--dawn-l);clip-path:polygon(50% 0,100% 40%,78% 100%,50% 72%,22% 100%,0 40%);display:inline-block}
.search{flex:1;position:relative;max-width:34rem;margin-left:auto}
.search input{width:100%;padding:.45rem .75rem;border-radius:999px;border:0;font:inherit;background:rgba(255,255,255,.92);color:#222}
#results{position:absolute;left:0;right:0;top:110%;background:var(--panel);color:var(--ink);list-style:none;margin:0;padding:.25rem;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);max-height:70vh;overflow:auto}
#results li a{display:block;padding:.4rem .6rem;border-radius:6px;text-decoration:none;color:inherit}
#results li a:hover,#results li.on a{background:var(--panel2)}
#results small{color:var(--muted);display:block}
.theme-btn,.menu-btn{background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:8px;font-size:1.1rem;padding:.3rem .6rem;cursor:pointer}
.menu-btn{display:none}
.shell{display:grid;grid-template-columns:15.5rem minmax(0,1fr);max-width:84rem;margin:0 auto}
.side{padding:1rem .75rem;border-right:1px solid var(--line);position:sticky;top:3.4rem;align-self:start;max-height:calc(100vh - 3.4rem);overflow:auto;font-size:.95rem}
.side ul{list-style:none;margin:0;padding:0}
.side li a{display:block;padding:.28rem .6rem;border-radius:6px;text-decoration:none;color:var(--ink)}
.side li a:hover{background:var(--panel2)}
.side li.here>a{background:var(--dawn);color:#1b1303;font-weight:600}
.side details{margin:0 0 .3rem .6rem}
.side summary{cursor:pointer;color:var(--muted);font-size:.8rem;padding:.1rem .4rem}
.side details ul{border-left:2px solid var(--line);margin-left:.4rem}
main{padding:1rem 1.5rem 3rem;min-width:0}
.crumbs{font-size:.85rem;color:var(--muted);margin:.2rem 0 .8rem}
h1{font-size:2rem;margin:.2rem 0 .6rem;padding-bottom:.3rem;border-bottom:3px solid var(--dawn)}
h2{margin-top:2rem;padding-bottom:.2rem;border-bottom:1px solid var(--line)}
h3{margin-top:1.4rem}
.lead{font-size:1.1rem;color:var(--muted)}
.table-wrap{overflow-x:auto;margin:.8rem 0}
table{border-collapse:collapse;width:100%;background:var(--panel);box-shadow:var(--shadow)}
th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:left;vertical-align:top}
th{background:var(--panel2);font-size:.9rem;white-space:nowrap}
tbody tr:nth-child(even){background:color-mix(in srgb,var(--panel2) 35%,transparent)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.infobox{float:right;width:21rem;max-width:100%;margin:0 0 1rem 1.25rem;background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--dawn);border-radius:8px;box-shadow:var(--shadow);overflow:hidden}
.infobox h3{margin:0;padding:.5rem .8rem;background:var(--panel2);font-size:1.1rem}
.infobox figure{margin:0}
.infobox img{display:block;width:100%}
.infobox .pair{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.infobox dl{margin:0;padding:.5rem .8rem;display:grid;grid-template-columns:auto 1fr;gap:.2rem .8rem;font-size:.9rem}
.infobox dt{color:var(--muted)}
.infobox dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
figure.shot{margin:1rem 0;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;box-shadow:var(--shadow)}
figure.shot img{display:block;width:100%;cursor:zoom-in}
figcaption{padding:.4rem .8rem;font-size:.85rem;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:1rem}
.gallery figure.shot{margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:.9rem;margin:1rem 0}
.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:var(--shadow);transition:transform .12s}
.card:hover{transform:translateY(-2px);border-color:var(--dawn)}
.card img,.card svg{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.card .meta{padding:.4rem .6rem}
.card strong{display:block}
.card small{color:var(--muted)}
.card.soon{opacity:.85}
.badge{display:inline-block;border-radius:999px;padding:.05rem .6rem;font-size:.78rem;font-weight:700;vertical-align:middle}
.badge.live{background:var(--good);color:#fff}
.badge.soon{background:var(--dawn);color:#1b1303}
.badge.stage{background:var(--panel2);color:var(--ink);border:1px solid var(--line)}
.ability{display:grid;grid-template-columns:minmax(0,15rem) 1fr;gap:1rem;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--dusk);border-radius:8px;padding:.8rem;margin:1rem 0;box-shadow:var(--shadow);clear:both}
.ability.ult{border-left-color:var(--dawn)}
.ability img{width:100%;border-radius:6px;display:block;cursor:zoom-in}
.ability h4{margin:0 0 .2rem;font-size:1.15rem}
.ability .stats{display:flex;flex-wrap:wrap;gap:.35rem;margin:.4rem 0}
.chip{background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:.05rem .5rem;font-size:.82rem}
.tiers{margin:.5rem 0 0;padding:0;list-style:none}
.tiers li{display:grid;grid-template-columns:5.2rem 1fr;gap:.5rem;padding:.25rem 0;border-top:1px dashed var(--line)}
.tiers b{font-size:.8rem;color:var(--dusk-d)}
.planned{border-left-color:var(--muted);opacity:.95}
.note{background:var(--panel2);border-left:4px solid var(--dawn);padding:.6rem .9rem;border-radius:6px;margin:1rem 0}
.item{display:grid;grid-template-columns:4.2rem 1fr;gap:.9rem;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:.7rem;margin:.8rem 0;box-shadow:var(--shadow)}
.item img{width:4rem;height:4rem}
.item h4{margin:0}
.tier-1{border-left:5px solid #9aa3ad}.tier-2{border-left:5px solid #4fb36b}.tier-3{border-left:5px solid #4a8dff}.tier-4{border-left:5px solid #f5a623}
.dawn{color:var(--dawn-d)}.dusk{color:var(--dusk-d)}
.mapbox{background:#1d2027;border-radius:8px;padding:.5rem;overflow:auto}
.mapbox img,.mapbox svg{display:block;max-width:100%;height:auto;margin:auto}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
#lightbox{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;cursor:zoom-out}
#lightbox[hidden]{display:none}
#lightbox img{max-width:96vw;max-height:84vh}
#lightbox p{color:#ddd;margin:.6rem 0 0}
@media (max-width:52rem){
  .shell{grid-template-columns:1fr}
  .side{display:none;position:fixed;inset:3.4rem 0 0 0;max-height:none;background:var(--bg);z-index:15;border:0}
  body.menu-open .side{display:block}
  .menu-btn{display:block}
  .brand small{display:none}
  .infobox{float:none;width:100%;margin:0 0 1rem}
  .ability{grid-template-columns:1fr}
  main{padding:1rem}
}
`;

export const JS = `/* PERCH wiki: theme toggle, client-side search over assets/search-index.js, mobile menu, click-to-enlarge images. */
(function () {
  var root = document.documentElement;
  document.querySelector('.theme-btn').addEventListener('click', function () {
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('perch-wiki-theme', next); } catch (e) { /* storage blocked: the toggle still works for this page */ }
  });
  var btn = document.querySelector('.menu-btn');
  btn.addEventListener('click', function () {
    var open = document.body.classList.toggle('menu-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  var input = document.getElementById('q');
  var list = document.getElementById('results');
  var index = window.WIKI_INDEX || [];
  var base = window.WIKI_ROOT || '';
  function run() {
    var terms = input.value.toLowerCase().split(/\\s+/).filter(Boolean);
    list.innerHTML = '';
    if (!terms.length) { list.hidden = true; return; }
    var hits = index.map(function (p) {
      var title = p.t.toLowerCase();
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        if (title.indexOf(term) === 0) score += 12;
        else if (title.indexOf(term) >= 0) score += 8;
        else if (p.k.indexOf(term) >= 0) score += 3;
        else if (p.x.indexOf(term) >= 0) score += 1;
        else return null;
      }
      return { p: p, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 12);
    hits.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = base + h.p.u;
      a.textContent = h.p.t;
      var s = document.createElement('small');
      s.textContent = h.p.s;
      a.appendChild(s);
      li.appendChild(a);
      list.appendChild(li);
    });
    if (!hits.length) { var li = document.createElement('li'); li.textContent = 'No pages found.'; li.style.padding = '.5rem'; list.appendChild(li); }
    list.hidden = false;
  }
  input.addEventListener('input', run);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; run(); }
    if (e.key === 'Enter') { var a = list.querySelector('a'); if (a) location.href = a.href; }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) list.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });
  var box = document.getElementById('lightbox');
  document.addEventListener('click', function (e) {
    var img = e.target.closest('figure.shot img, .ability img');
    if (img) {
      box.querySelector('img').src = img.src;
      box.querySelector('img').alt = img.alt;
      box.querySelector('p').textContent = img.alt;
      box.hidden = false;
    } else if (!box.hidden) box.hidden = true;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.hidden = true; });
})();
`;
