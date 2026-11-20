// Pointer-lock route per browser (D-UI-006): hold a key to free the cursor, release it and see whether the lock comes back by itself.
// Run: node tools/pointer-lock-probe.mjs  (Edge through its channel, Firefox from Playwright; Chrome if installed).
import http from 'node:http';
import { chromium, firefox } from '@playwright/test';
const html = `<!doctype html><body style="margin:0"><div id=s style="width:100vw;height:100vh;background:#223"></div><script>
const s=document.getElementById('s');window.log=[];
document.addEventListener('pointerlockchange',()=>log.push('change:'+(document.pointerLockElement?'locked':'free')));
document.addEventListener('pointerlockerror',()=>log.push('error'));
s.addEventListener('mousedown',()=>s.requestPointerLock());
document.addEventListener('keydown',e=>{if(e.code==='AltLeft'&&!e.repeat){e.preventDefault();document.exitPointerLock();}});
document.addEventListener('keyup',e=>{if(e.code==='AltLeft'){e.preventDefault();try{const p=s.requestPointerLock();if(p&&p.catch)p.catch(x=>log.push('rej:'+x.name));}catch(x){log.push('throw')}}});
</script>`;
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(html); }).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const targets = [
  ['edge', () => chromium.launch({ channel: 'msedge' })],
  ['chrome', () => chromium.launch({ channel: 'chrome' })],
  ['firefox', () => firefox.launch()],
];
for (const [name, launch] of targets) {
  for (const holdMs of [300, 7000]) {
    let b;
    try { b = await launch(); } catch (e) { console.log(name, 'launch failed', String(e).slice(0, 100)); break; }
    const p = await b.newPage({ viewport: { width: 800, height: 600 } });
    await p.goto(url);
    await p.mouse.click(400, 300);
    await p.waitForTimeout(200);
    const locked1 = await p.evaluate(() => !!document.pointerLockElement);
    await p.keyboard.down('Alt');
    await p.waitForTimeout(holdMs);
    const freeDuring = await p.evaluate(() => !document.pointerLockElement);
    await p.keyboard.up('Alt');
    await p.waitForTimeout(300);
    const relocked = await p.evaluate(() => !!document.pointerLockElement);
    console.log(name, b.version(), 'hold', holdMs, JSON.stringify({ locked1, freeDuring, relocked, log: await p.evaluate(() => log) }));
    await b.close();
  }
}
srv.close();
