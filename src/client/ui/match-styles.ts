/** Stylesheet for the wave 4 match UI: top bar, minimap, feed, panels, shop, scoreboard, end screen. Classes are `pu-`. */
import {
  ALLY_CSS,
  ENEMY_CSS,
  HEALTH_CSS,
  PANEL_BG,
  SEEDS_CSS,
  TALON_CSS,
  TEAM_CSS,
  TEXT,
  TEXT_DIM,
} from './constants';

export const MATCH_STYLES = `
.pu-hero-detail{width:320px;height:372px;box-sizing:border-box;flex:none;overflow:auto;padding:12px 14px;background:${PANEL_BG};border-radius:6px;font-size:12px;line-height:1.35;text-shadow:none}
.pu-hero-detail h3{margin:0 0 4px;font-size:16px;color:${TEAM_CSS.dawn}}
.pu-hero-detail p{margin:2px 0}
.pu-hero-detail .gun{color:${TEXT_DIM}}
.pu-hero-detail .ab{margin-top:8px}
.pu-hero-detail ul{margin:2px 0 0;padding-left:16px;color:${TEXT_DIM}}
.pu-menu .pu-btnrow{flex-wrap:wrap;justify-content:center}
.pu-bigmap-box{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);pointer-events:none}
.pu-bigmap-box[hidden]{display:none}
.pu-bigmap{border:2px solid ${TEXT};border-radius:6px;pointer-events:auto}
.pu-world{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.pu-num{position:absolute;left:0;top:0;font-weight:800;text-shadow:0 1px 3px #000,0 0 2px #000;white-space:nowrap}
.pu-wping,.pu-dlabel{position:absolute;left:0;top:0;font-size:14px;font-weight:700;white-space:nowrap;text-shadow:0 1px 3px #000}
.pu-dlabel{padding:2px 8px;border-radius:4px;background:${PANEL_BG};color:${ALLY_CSS}}
.pu-dlabel.enemy{color:${ENEMY_CSS}}
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
.pu-wheel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;grid-template-columns:repeat(2,150px);gap:10px;padding:14px;background:${PANEL_BG};border-radius:10px;pointer-events:auto}
.pu-wheel-btn{font:inherit;font-size:16px;font-weight:700;padding:14px 8px;color:${TEXT};background:rgba(30,34,42,.95);border:3px solid;border-radius:8px;cursor:pointer}
.pu-wheel-btn:hover,.pu-wheel-btn:focus-visible{background:rgba(70,76,90,.95);outline:none}
.pu-verdict{margin:0;font-size:84px;letter-spacing:.12em}
.pu-end{gap:10px;overflow:auto}
.pu-endtable{width:min(1300px,92vw);background:${PANEL_BG};text-shadow:none}
.pu-graph{width:min(600px,80vw);height:100px;background:${PANEL_BG};border-radius:6px}
`;
