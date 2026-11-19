/** Stylesheet for the wave 4 match UI: top bar, minimap, feed, panels, shop, scoreboard, end screen. Classes are `pu-`. */
import {
  ALLY_CSS,
  BEAK_CSS,
  ENEMY_CSS,
  HEALTH_CSS,
  PANEL_BG,
  SEEDS_CSS,
  STAMINA_CSS,
  TALON_CSS,
  TEAM_CSS,
  TEXT,
  TEXT_DIM,
} from './constants';

export const MATCH_STYLES = `
.pu-hero-detail{width:320px;max-height:64vh;overflow:auto;padding:12px 14px;background:${PANEL_BG};border-radius:6px;font-size:12px;line-height:1.35;text-shadow:none}
.pu-hero-detail h3{margin:0 0 4px;font-size:16px;color:${TEAM_CSS.dawn}}
.pu-hero-detail p{margin:2px 0}
.pu-hero-detail .gun{color:${TEXT_DIM}}
.pu-hero-detail .ab{margin-top:8px}
.pu-hero-detail ul{margin:2px 0 0;padding-left:16px;color:${TEXT_DIM}}
.pu-menu .pu-btnrow{flex-wrap:wrap;justify-content:center}
.pu-minimap{position:absolute;left:10px;top:10px;width:220px;height:254px;border:2px solid rgba(255,255,255,.35);border-radius:6px;pointer-events:auto}
.pu-bigmap-box{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);pointer-events:none}
.pu-bigmap-box[hidden]{display:none}
.pu-bigmap{border:2px solid ${TEXT};border-radius:6px;pointer-events:auto}
.pu-top{position:absolute;left:50%;top:8px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;width:640px;text-shadow:0 1px 3px #000}
.pu-top-main{display:flex;align-items:center;justify-content:space-between;width:100%;padding:4px 12px;background:${PANEL_BG};border-radius:6px}
.pu-top-side{display:flex;flex-direction:column;gap:1px;min-width:190px;font-size:13px}
.pu-top-side:last-child{text-align:right}
.pu-top-side .worth{color:var(--team)}
.pu-top-side .pips{font-size:11px;color:${TEXT_DIM};letter-spacing:.05em}
.pu-clock{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums}
.pu-obj{display:flex;gap:8px;width:100%}
.pu-patron{flex:1;padding:3px 8px;background:${PANEL_BG};border-radius:6px;border-bottom:3px solid var(--team);font-size:12px}
.pu-patron .nm{font-weight:700}
.pu-patron .bar,.pu-lane .bar{height:8px;margin:2px 0;background:rgba(255,255,255,.14);border-radius:3px;overflow:hidden}
.pu-patron .bar i,.pu-lane .bar i{display:block;height:100%;width:100%;background:var(--team,${HEALTH_CSS})}
.pu-lane .bar i{background:${ENEMY_CSS}}
.pu-patron .st{color:${TEXT_DIM}}
.pu-patron.gated .st,.pu-lane.gated .nm{color:${BEAK_CSS}}
.pu-lanes{display:flex;gap:6px;width:100%}
.pu-lane{flex:1;padding:2px 6px;background:${PANEL_BG};border-radius:4px;font-size:11px}
.pu-banners{font-size:14px;font-weight:700;color:${SEEDS_CSS}}
.pu-feed{position:absolute;right:12px;top:12px;width:300px;text-shadow:0 1px 3px #000}
.pu-feed-list{display:flex;flex-direction:column;gap:3px}
.pu-line{padding:3px 8px;background:${PANEL_BG};border-radius:4px;font-size:13px;text-align:right}
.pu-line.obj{border:1px solid ${SEEDS_CSS};color:${SEEDS_CSS}}
.pu-line.ping{color:${TEXT_DIM}}
.pu-feed-dead{margin-top:6px;font-size:12px;color:${TEXT_DIM};text-align:right}
.pu-world{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.pu-num{position:absolute;left:0;top:0;font-weight:800;text-shadow:0 1px 3px #000,0 0 2px #000;white-space:nowrap}
.pu-wping,.pu-dlabel{position:absolute;left:0;top:0;font-size:14px;font-weight:700;white-space:nowrap;text-shadow:0 1px 3px #000}
.pu-dlabel{padding:2px 8px;border-radius:4px;background:${PANEL_BG};color:${ALLY_CSS}}
.pu-dlabel.enemy{color:${ENEMY_CSS}}
.pu-dummies{position:absolute;left:10px;top:276px;width:220px;display:flex;flex-direction:column;gap:6px}
.pu-dummy{padding:6px 8px;background:${PANEL_BG};border-radius:6px;font-size:12px}
.pu-dummy .nm{display:block;font-weight:700}
.pu-dummy .bar{height:10px;margin:3px 0;background:rgba(255,255,255,.14);border-radius:3px;overflow:hidden}
.pu-dummy .bar i{display:block;height:100%;width:100%}
.pu-dummy .fb{color:${BEAK_CSS}}
.pu-acts{display:flex;gap:8px}
.pu-act{position:relative;flex:1;height:34px;border:1px solid rgba(255,255,255,.25);border-radius:4px;background:rgba(30,34,42,.7);overflow:hidden;opacity:.55}
.pu-act.on{opacity:1}
.pu-act.rdy{border-color:#fff}
.pu-act .key{position:absolute;left:4px;top:2px;font-size:12px;font-weight:800}
.pu-act .nm{position:absolute;left:4px;right:4px;bottom:2px;font-size:10px;color:${TEXT_DIM};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pu-act .cd{position:absolute;right:5px;top:3px;font-size:15px;font-weight:800}
.pu-pip i::after{content:'';position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(0,0,0,.45)}
.pu-melee{position:absolute;left:50%;top:60%;transform:translateX(-50%);padding:4px 10px;background:${PANEL_BG};border-radius:6px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px;text-shadow:0 1px 3px #000}
.pu-melee .key{padding:1px 8px;border:1px solid ${TEXT};border-radius:4px;font-weight:800}
.pu-melee .help{color:${TEXT};font-size:13px;font-weight:600}
.pu-melee .bar{width:120px;height:6px;background:rgba(255,255,255,.18);border-radius:3px;overflow:hidden}
.pu-melee .bar i{display:block;height:100%;width:0;background:${BEAK_CSS}}
.pu-melee .st{height:16px;font-size:14px;letter-spacing:.1em}
.pu-melee[data-mode=ready] .bar i{background:${ENEMY_CSS}}
.pu-melee[data-mode=ready] .st{color:${ENEMY_CSS}}
.pu-melee[data-mode=parry] .bar i{background:${ALLY_CSS}}
.pu-melee[data-mode=parry] .st{color:${ALLY_CSS}}
.pu-jumpcue{position:absolute;left:50%;top:54%;transform:translateX(-50%);padding:3px 12px;border:2px solid ${STAMINA_CSS};border-radius:14px;background:${PANEL_BG};color:${STAMINA_CSS};font-weight:800;font-size:14px;letter-spacing:.06em;animation:pu-pulse .5s ease-in-out infinite}
.pu-upg{position:absolute;left:250px;top:110px;width:440px;padding:14px 16px;background:rgba(12,14,18,.92);border:1px solid rgba(255,255,255,.25);border-radius:6px;pointer-events:auto;text-shadow:none}
.pu-upg[hidden],.pu-shop[hidden],.pu-score[hidden],.pu-wheel[hidden]{display:none}
.pu-upg-head{display:flex;align-items:center;gap:12px}
.pu-upg-head h3{margin:0;font-size:20px;flex:1}
.pu-upg-ap{font-weight:800;color:${BEAK_CSS}}
.pu-upg-hint{margin:6px 0 10px;font-size:12px;color:${TEXT_DIM}}
.pu-upg-rows{display:flex;flex-direction:column;gap:8px}
.pu-urow{position:relative;display:flex;gap:8px;align-items:stretch}
.pu-ucard{flex:1;display:flex;flex-direction:column;gap:3px;text-align:left;font:inherit;color:${TEXT};background:rgba(30,34,42,.9);border:1px solid rgba(255,255,255,.3);border-radius:5px;padding:6px 10px;cursor:pointer}
.pu-ucard .nm{font-size:15px}
.pu-ucard .key{font-size:11px;color:${TEXT_DIM}}
.pu-ucard .tiers{display:flex;gap:3px}
.pu-ucard .tiers i{width:14px;height:5px;border-radius:1px;background:rgba(255,255,255,.25)}
.pu-ucard .tiers i.on{background:${BEAK_CSS}}
.pu-ucard:hover,.pu-ucard:focus-visible,.pu-ubtn:focus-visible{border-color:${TEXT};outline:2px solid ${TEXT};outline-offset:1px}
.pu-ubtn{width:150px;display:flex;flex-direction:column;gap:2px;font:inherit;font-size:13px;font-weight:700;text-align:left;color:#1a1204;background:${BEAK_CSS};border:0;border-radius:5px;padding:6px 8px;cursor:pointer}
.pu-ubtn small{font-weight:600;font-size:11px}
.pu-ubtn.off{background:rgba(255,255,255,.12);color:${TEXT_DIM};cursor:not-allowed}
.pu-udesc{display:none;position:absolute;left:calc(100% + 14px);top:0;width:340px;padding:10px 12px;background:rgba(12,14,18,.96);border:1px solid ${TEXT_DIM};border-radius:6px;font-size:13px;line-height:1.35;z-index:3}
.pu-urow:hover .pu-udesc,.pu-urow:focus-within .pu-udesc{display:block}
.pu-udesc p{margin:0 0 6px}
.pu-udesc ul{margin:0 0 6px;padding-left:16px}
.pu-udesc li{color:${TEXT_DIM}}
.pu-udesc li.done{color:${BEAK_CSS}}
.pu-udesc li.next{color:${TEXT};font-weight:600}
.pu-udesc .stat{color:${TEXT_DIM};margin:0}
.pu-shop{position:absolute;inset:24px;display:flex;flex-direction:column;gap:10px;padding:16px 20px;background:rgba(12,14,18,.94);border:1px solid rgba(255,255,255,.25);border-radius:6px;pointer-events:auto;text-shadow:none}
.pu-shop-head{display:flex;align-items:center;gap:20px}
.pu-shop-head h2{margin:0;flex:1;font-size:26px}
.pu-shop-wallet{font-weight:700;color:${SEEDS_CSS}}
.pu-shop-banner{padding:6px 10px;border-radius:4px;background:rgba(79,207,106,.15);font-size:14px}
.pu-shop-banner.away{background:rgba(255,138,61,.18);color:${TALON_CSS}}
.pu-shop-body{display:flex;gap:20px;flex:1;min-height:0}
.pu-shop-cols{display:flex;gap:14px;flex:1}
.pu-shop-col{flex:1;display:flex;flex-direction:column;gap:6px;border-top:4px solid var(--cat)}
.pu-shop-col h3{margin:4px 0;color:var(--cat);font-size:18px}
.pu-item{position:relative;display:flex;flex-direction:column;gap:1px;text-align:left;font:inherit;color:${TEXT};background:rgba(30,34,42,.9);border:1px solid rgba(255,255,255,.25);border-left:5px solid var(--cat);border-radius:5px;padding:5px 10px;cursor:pointer}
.pu-item .tier{color:${TEXT_DIM};font-size:11px}
.pu-item .nm{font-size:14px}
.pu-item .price{font-weight:700;color:${SEEDS_CSS}}
.pu-item .price.poor{color:${ENEMY_CSS}}
.pu-item .tag{position:absolute;right:8px;top:6px;font-size:11px;font-style:normal;color:${HEALTH_CSS}}
.pu-item.owned{background:rgba(79,207,106,.14)}
.pu-item.off{opacity:.6}
.pu-item:hover,.pu-item:focus-visible{border-color:${TEXT};outline:none}
.pu-shop-side{width:340px;display:flex;flex-direction:column;gap:8px;overflow:auto}
.pu-shop-tip{min-height:120px;padding:8px 10px;background:rgba(30,34,42,.9);border-radius:5px;font-size:13px;line-height:1.35}
.pu-shop-tip p{margin:0 0 4px}
.pu-shop-tip .hd{font-weight:800;font-size:15px}
.pu-shop-side h3{margin:0;font-size:15px}
.pu-shop-slots{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}
.pu-shop-slots .slot{min-height:30px;padding:4px 6px;font-size:12px;border:1px solid rgba(255,255,255,.2);border-radius:4px;background:rgba(30,34,42,.7)}
.pu-shop-slots .slot small{display:block;color:${SEEDS_CSS}}
.pu-shop-slots .slot.flex{border-style:dashed}
.pu-shop-slots .slot.lock{opacity:.5;font-size:11px}
.pu-score{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1500px,94vw);padding:14px 18px;background:rgba(12,14,18,.92);border-radius:6px;text-shadow:none}
.pu-score-head{margin-bottom:8px;font-size:15px;color:${TEXT_DIM};text-align:center}
.pu-score-tables{display:flex;gap:18px}
.pu-score-team{flex:1;border-top:4px solid var(--team)}
.pu-score-team h3{margin:6px 0;font-size:18px;color:var(--team)}
.pu-score table,.pu-endtable{width:100%;border-collapse:collapse;font-size:13px}
.pu-score th,.pu-endtable th{text-align:left;color:${TEXT_DIM};font-weight:600;padding:3px 6px}
.pu-score td,.pu-endtable td{padding:3px 6px;border-top:1px solid rgba(255,255,255,.08)}
.pu-score td.items{font-size:11px;color:${TEXT_DIM};max-width:200px}
.pu-score tr.me td,.pu-endtable tr.me td{background:rgba(255,255,255,.1);font-weight:700}
.pu-score tr.dead{opacity:.55}
.pu-score .foot{margin:8px 0 0;font-size:12px;color:${TEXT_DIM}}
.pu-wheel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;grid-template-columns:repeat(2,150px);gap:10px;padding:14px;background:${PANEL_BG};border-radius:10px;pointer-events:auto}
.pu-wheel-btn{font:inherit;font-size:16px;font-weight:700;padding:14px 8px;color:${TEXT};background:rgba(30,34,42,.95);border:3px solid;border-radius:8px;cursor:pointer}
.pu-wheel-btn:hover,.pu-wheel-btn:focus-visible{background:rgba(70,76,90,.95);outline:none}
.pu-verdict{margin:0;font-size:84px;letter-spacing:.12em}
.pu-end{gap:10px;overflow:auto}
.pu-endtable{width:min(1300px,92vw);background:${PANEL_BG};text-shadow:none}
.pu-graph{width:min(600px,80vw);height:100px;background:${PANEL_BG};border-radius:6px}
`;
