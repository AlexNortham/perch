/* PERCH wiki: theme toggle, client-side search over assets/search-index.js, mobile menu, click-to-enlarge images. */
(function () {
  var root = document.documentElement;
  document.querySelector('.theme-btn').addEventListener('click', function () {
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('perch-wiki-theme', next); } catch { /* storage blocked: the toggle still works for this page */ }
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
    var terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
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
