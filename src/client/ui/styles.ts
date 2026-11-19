/** The UI stylesheet, injected once. Classes are prefixed `pu-`. Values come from constants.ts. */
import {
  BARRIER_CSS,
  BEAK_CSS,
  HEALTH_CSS,
  PANEL_BG,
  SEEDS_CSS,
  SONG_CSS,
  STAMINA_CSS,
  TALON_CSS,
  TEAM_CSS,
  TEXT,
  TEXT_DIM,
} from './constants';


export const STYLES = `
.pu-root{position:absolute;inset:0;pointer-events:none;font-family:system-ui,'Segoe UI',sans-serif;color:${TEXT};user-select:none}
.pu-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;pointer-events:auto;text-shadow:0 1px 4px rgba(0,0,0,.85)}
.pu-menu{background:radial-gradient(ellipse 34% 30% at 50% 50%,rgba(12,14,18,.74) 45%,rgba(12,14,18,.06))}
.pu-select,.pu-pause{background:rgba(12,14,18,.82)}
.pu-title{margin:0;font-size:96px;letter-spacing:.3em;padding-left:.3em;font-weight:800;color:${TEAM_CSS.dawn}}
.pu-sub{margin:0;font-size:20px;color:${TEXT_DIM};letter-spacing:.04em}
.pu-h2{margin:0;font-size:34px;letter-spacing:.06em}
.pu-btn{font:inherit;font-size:22px;padding:10px 40px;border:2px solid ${TEXT};border-radius:6px;background:${PANEL_BG};color:${TEXT};cursor:pointer;text-shadow:none}
.pu-btn:hover,.pu-btn:focus-visible{background:${TEAM_CSS.dawn};color:#1a1204;border-color:${TEAM_CSS.dawn};outline:none}
.pu-btn.pu-quiet{font-size:16px;padding:6px 24px;border-color:${TEXT_DIM}}
.pu-grid{display:grid;grid-template-columns:repeat(8,150px);gap:10px}
.pu-card{position:relative;display:flex;flex-direction:column;gap:3px;height:92px;padding:10px 10px 8px 16px;text-align:left;font:inherit;color:${TEXT};background:${PANEL_BG};border:1px solid rgba(255,255,255,.18);border-radius:6px;cursor:pointer;overflow:hidden;text-shadow:none}
.pu-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:7px;background:var(--sw)}
.pu-card b{font-size:18px}
.pu-card span{font-size:13px;color:${TEXT_DIM}}
.pu-card em{margin-top:auto;font-style:normal;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${TEAM_CSS.dawn}}
.pu-card:hover:not(:disabled),.pu-card:focus-visible{border-color:${TEXT};background:rgba(40,44,52,.9);outline:none}
.pu-card:disabled{cursor:not-allowed;opacity:.5}
.pu-card:disabled em{color:${TEXT_DIM}}
.pu-hud{position:absolute;inset:0}
.pu-cross{position:absolute;left:50%;top:50%;width:0;height:0}
.pu-cross i{position:absolute;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.7)}
.pu-cross i:nth-child(1){left:-1px;top:-14px;width:2px;height:8px}
.pu-cross i:nth-child(2){left:-1px;top:6px;width:2px;height:8px}
.pu-cross i:nth-child(3){left:-14px;top:-1px;width:8px;height:2px}
.pu-cross i:nth-child(4){left:6px;top:-1px;width:8px;height:2px}
.pu-cross i:nth-child(5){left:-1px;top:-1px;width:2px;height:2px}
.pu-hit{position:absolute;left:-16px;top:-16px;width:32px;height:32px;opacity:0}
.pu-hit::before,.pu-hit::after{content:'';position:absolute;left:14px;top:-2px;width:4px;height:36px;background:var(--c,#fff);box-shadow:0 0 0 1px rgba(0,0,0,.6);border-radius:2px;-webkit-mask:linear-gradient(#000 0 30%,transparent 30% 70%,#000 70%);mask:linear-gradient(#000 0 30%,transparent 30% 70%,#000 70%)}
.pu-hit::before{transform:rotate(45deg)}
.pu-hit::after{transform:rotate(-45deg)}
.pu-banner{position:absolute;left:50%;top:62%;transform:translateX(-50%);font-size:34px;font-weight:800;letter-spacing:.14em;opacity:0;text-shadow:0 2px 6px rgba(0,0,0,.9)}
.pu-dead{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(80,10,10,.28);text-shadow:0 2px 6px rgba(0,0,0,.9)}
.pu-dead small{font-size:22px;letter-spacing:.1em;color:${TEXT_DIM}}
.pu-dead b{font-size:96px;line-height:1}
.pu-cluster{position:absolute;left:28px;bottom:28px;width:460px;display:flex;flex-direction:column;gap:8px;padding:12px 14px;background:${PANEL_BG};border-radius:6px}
.pu-bar{position:relative;height:22px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden;display:flex}
.pu-bar>div{height:100%;flex:none;width:0}
.pu-bar span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;text-shadow:0 1px 2px #000}
.pu-hp{background:${HEALTH_CSS}}.pu-talon{background:${TALON_CSS}}.pu-song{background:${SONG_CSS}}.pu-barrier{background:${BARRIER_CSS}}
.pu-row{display:flex;align-items:center;gap:14px;font-size:16px}
.pu-pips{display:flex;gap:5px}
.pu-pip{width:16px;height:16px;border-radius:50%;border:2px solid ${STAMINA_CSS};overflow:hidden;position:relative}
.pu-pip i{position:absolute;inset:0;background:${STAMINA_CSS};transform-origin:left;transform:scaleX(0)}
.pu-ap{font-weight:700;color:${BEAK_CSS};display:none}
.pu-ap.on{display:block;animation:pu-pulse 1s ease-in-out infinite}
.pu-seeds{margin-left:auto;font-weight:700;color:${SEEDS_CSS}}
.pu-abil{display:flex;align-items:flex-end;gap:8px}
.pu-slot{position:relative;width:72px;height:72px;border:2px solid rgba(255,255,255,.55);border-radius:6px;background:rgba(30,34,42,.9);overflow:hidden}
.pu-slot.ult{border-color:${SEEDS_CSS}}
.pu-slot.lock{opacity:.45;border-style:dashed}
.pu-slot.rdy{border-color:#fff}
.pu-slot.up{box-shadow:0 0 0 2px ${BEAK_CSS},0 0 12px ${BEAK_CSS};animation:pu-pulse 1s ease-in-out infinite}
.pu-slot .nm{position:absolute;left:3px;right:3px;bottom:12px;font-size:11px;line-height:1.1;text-align:center;color:${TEXT_DIM};overflow:hidden;max-height:25px}
.pu-slot .key{position:absolute;left:4px;top:3px;font-size:13px;font-weight:700}
.pu-slot .sweep{position:absolute;inset:0;background:rgba(0,0,0,.62);transform-origin:bottom;transform:scaleY(0)}
.pu-slot .cd{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;text-shadow:0 1px 3px #000}
.pu-slot .ch{position:absolute;right:4px;top:3px;font-size:14px;font-weight:800;color:${BEAK_CSS}}
.pu-slot .lk{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:12px;font-weight:700;letter-spacing:.08em}
.pu-slot.lock .nm{display:none}
.pu-slot.lock .lk{display:flex}
.pu-slot .tiers{position:absolute;left:0;right:0;bottom:3px;display:flex;justify-content:center;gap:3px}
.pu-slot .tiers i{width:10px;height:4px;border-radius:1px;background:rgba(255,255,255,.25)}
.pu-slot .tiers i.on{background:${BEAK_CSS}}
.pu-ammo{margin-left:auto;white-space:nowrap;text-align:right;font-size:34px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.pu-ammo small{display:block;font-size:13px;font-weight:700;letter-spacing:.1em;color:${TEXT_DIM};margin-top:4px;height:15px}
.pu-ammo.rl small{color:${BEAK_CSS}}
.pu-ammo.low{color:#ff6a5a}
@keyframes pu-pulse{50%{opacity:.6}}
`;

export const OPTIONS_STYLES = `
.pu-opts{display:flex;gap:36px;align-items:flex-start;max-height:74vh;padding:20px 26px;background:${PANEL_BG};border-radius:6px;text-shadow:none}
.pu-col{display:flex;flex-direction:column;gap:8px;width:440px}
.pu-opts .pu-col:first-child{max-height:calc(74vh - 40px);overflow-y:auto;padding-right:10px}
.pu-h3{margin:8px 0 2px;font-size:18px;letter-spacing:.06em;color:${TEAM_CSS.dawn}}
.pu-h3:first-child{margin-top:0}
.pu-binds{display:flex;flex-direction:column;gap:4px}
.pu-bind{display:flex;align-items:center;gap:8px}
.pu-bind-name{flex:1;font-size:15px}
.pu-key{min-width:130px;font:inherit;font-size:14px;font-weight:600;padding:5px 10px;border:1px solid rgba(255,255,255,.35);border-radius:4px;background:rgba(255,255,255,.08);color:${TEXT};cursor:pointer}
.pu-key:hover,.pu-key:focus-visible{border-color:${TEXT};outline:none}
.pu-key.cap{border-color:${BEAK_CSS};color:${BEAK_CSS};animation:pu-pulse 1s ease-in-out infinite}
.pu-reset{font:inherit;font-size:12px;padding:4px 8px;border:1px solid rgba(255,255,255,.25);border-radius:4px;background:none;color:${TEXT_DIM};cursor:pointer}
.pu-reset:disabled{opacity:.25;cursor:default}
.pu-status{min-height:40px;position:sticky;top:0;background:rgba(12,14,18,.95);font-size:14px;color:${TEXT_DIM}}
.pu-status.swap{color:${BEAK_CSS}}
.pu-opt{display:flex;align-items:center;gap:12px;font-size:15px}
.pu-opt-name{width:150px}
.pu-opt input[type=range]{flex:1;accent-color:${TEAM_CSS.dawn}}
.pu-val{width:52px;text-align:right;font-variant-numeric:tabular-nums}
.pu-seg{display:flex;gap:6px}
.pu-seg .pu-btn{padding:5px 14px;font-size:14px}
.pu-btnrow{display:flex;gap:16px}
.pu-btn.on{background:${TEAM_CSS.dawn};color:#1a1204;border-color:${TEAM_CSS.dawn}}
`;
