/**
 * The Stage 4 HUD layout (feel gaps G01 to G10). Sizes are written for 1080p and scale with the window height through
 * `--u` (one 1080p pixel); text never drops below a readable minimum.
 */
import { ALLY_CSS, BARRIER_CSS, BEAK_CSS, ENEMY_CSS, HEALTH_CSS, MINIMAP_DIAMETER, MINIMAP_SIZE, PANEL_BG, SEEDS_CSS, SONG_CSS, STAMINA_CSS, TEXT, TEXT_DIM } from '../constants';

const u = (n: number): string => `calc(var(--u) * ${n})`;
/** Text: scaled with the window, but never below 10 px. */
const f = (n: number): string => `max(10px, ${u(n)})`;

export const HUD_STYLES = `
.pu-root{--u:calc(100vh / 1080)}
.pu-hud button{font:inherit;color:inherit}
.pu-hud [hidden]{display:none}
.pu-shop[hidden],.pu-wheel[hidden]{display:none}

/* Scoreboard bar (D-EP-041, G01) */
.pu-top{position:absolute;left:50%;top:${u(10)};transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:${u(6)};text-shadow:0 1px 3px #000}
.pu-top-row{display:flex;align-items:flex-start;gap:${u(14)}}
.pu-flock{display:flex;gap:${u(14)}}
.pu-flock[data-side=enemy]{flex-direction:row}
.pu-portrait{position:relative;width:${u(70)};display:flex;flex-direction:column;align-items:center;gap:${u(2)}}
.pu-portrait .frame{position:relative;width:${u(70)};height:${u(70)};border-radius:50%;border:${u(3)} solid var(--team);box-sizing:border-box;overflow:hidden;background:#111}
.pu-portrait.me .frame{box-shadow:0 0 0 ${u(2)} #fff}
.pu-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${u(30)};color:#1a1204;text-shadow:none}
.pu-portrait.dead .pu-face{filter:brightness(.28) grayscale(.6)}
.pu-portrait.unseen .pu-face{opacity:.35}
.pu-portrait.unseen .frame{opacity:.7}
.pu-portrait .frame b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${u(34)};font-weight:800;color:#ff5a4a;text-shadow:0 2px 4px #000}
.pu-portrait .hp{position:absolute;left:${u(-9)};top:${u(8)};width:${u(5)};height:${u(54)};background:rgba(255,255,255,.2);border-radius:3px;overflow:hidden}
.pu-portrait .hp i{position:absolute;left:0;right:0;bottom:0;height:100%;background:${HEALTH_CSS}}
.pu-portrait.crit .hp i{background:${ENEMY_CSS}}
.pu-portrait .seeds{font-size:${f(13)};font-weight:700;color:${SEEDS_CSS};font-variant-numeric:tabular-nums}
.pu-portrait .eye{position:absolute;right:${u(-3)};top:${u(2)};width:${u(14)};height:${u(8)};border:${u(2)} solid #fff;border-radius:50%;background:rgba(0,0,0,.6)}
.pu-portrait .eye::after{content:'';position:absolute;left:50%;top:50%;width:${u(4)};height:${u(4)};margin:${u(-2)} 0 0 ${u(-2)};border-radius:50%;background:#fff}
.pu-portrait .tag{position:absolute;left:50%;top:${u(54)};transform:translateX(-50%);padding:0 ${u(5)};border-radius:${u(6)};background:#c62828;font-size:${f(9)};font-style:normal;font-weight:800;letter-spacing:.06em}
.pu-portrait .streak{position:absolute;left:${u(-4)};top:${u(-4)};padding:0 ${u(5)};border-radius:${u(8)};background:${SEEDS_CSS};color:#1a1204;font-size:${f(11)};font-style:normal;font-weight:800;text-shadow:none}
.pu-portrait .tag:empty,.pu-portrait .streak:empty{display:none}
.pu-mid{display:flex;flex-direction:column;align-items:center;gap:${u(3)};width:${u(220)}}
.pu-mid .clock{font-size:${f(16)};font-weight:800;font-variant-numeric:tabular-nums;color:${TEXT}}
.pu-mid .pills{display:flex;gap:${u(10)}}
.pu-mid .pill{min-width:${u(96)};padding:${u(3)} ${u(8)};border-radius:${u(8)};background:var(--team);color:#1a1204;text-align:center;font-size:${f(20)};font-weight:800;font-variant-numeric:tabular-nums;text-shadow:none}
.pu-mid .lead{align-self:stretch;height:${u(16)};font-size:${f(13)};font-weight:800;color:${SEEDS_CSS}}
.pu-mid .lead[data-side=own]{text-align:left;padding-left:${u(12)}}
.pu-mid .lead[data-side=enemy]{text-align:right;padding-right:${u(12)}}
.pu-mid .window{font-size:${f(13)};color:${TEXT_DIM}}
.pu-strip{display:flex;align-items:center;gap:${u(12)};padding:${u(2)} ${u(10)};background:${PANEL_BG};border-radius:${u(6)};font-size:${f(12)}}
.pu-strip .patron{display:flex;align-items:center;gap:${u(6)}}
.pu-strip .patron .nm{font-weight:700}
.pu-strip .patron .bar{width:${u(90)};height:${u(7)};background:rgba(255,255,255,.16);border-radius:3px;overflow:hidden}
.pu-strip .patron .bar i{display:block;height:100%;width:100%;background:${HEALTH_CSS}}
.pu-strip .patron .ph{color:${TEXT_DIM}}
.pu-strip .lanes{display:flex;gap:${u(10)}}
.pu-strip .lane{color:${TEXT_DIM}}
.pu-strip .lane .nm{margin-right:${u(4)};font-weight:700;color:${TEXT}}
.pu-bars{display:flex;gap:${u(16)};justify-content:center}
.pu-bars .obj{display:flex;flex-direction:column;gap:${u(3)};width:${u(380)}}
.pu-bars .obj.wide{width:${u(600)}}
.pu-bars .obj .head{display:flex;align-items:center}
.pu-bars .obj .own .track i,.pu-bars .obj.own .track i{background:${ALLY_CSS}}
.pu-bars .obj .nm{font-size:${f(16)};font-weight:800;letter-spacing:.1em}
.pu-bars .obj .ward{margin-left:${u(8)};padding:0 ${u(5)};border:1px solid ${BEAK_CSS};border-radius:${u(4)};font-size:${f(11)};font-style:normal;color:${BEAK_CSS}}
.pu-bars .obj .track{height:${u(10)};background:rgba(255,255,255,.18);border-radius:${u(4)};overflow:hidden}
.pu-bars .obj .track i{display:block;height:100%;width:100%;background:${ENEMY_CSS}}
.pu-bars .obj.gated .nm{color:${BEAK_CSS}}

/* Kill feed (G08, G30) */
.pu-feed{position:absolute;left:${u(18)};top:20%;width:${u(380)};text-shadow:0 1px 3px #000}
.pu-feed-list{display:flex;flex-direction:column;gap:${u(3)}}
.pu-line{display:flex;align-items:center;gap:${u(6)};padding:${u(3)} ${u(8)};background:${PANEL_BG};border-radius:${u(4)};font-size:${f(14)}}
.pu-line.obj{border:1px solid ${SEEDS_CSS};color:${SEEDS_CSS}}
.pu-line.callout{border:1px solid ${ENEMY_CSS};color:#fff;font-weight:800;letter-spacing:.08em}
.pu-line.ping{color:${TEXT_DIM}}
.pu-mini{position:relative;flex:none;width:${u(22)};height:${u(22)};border-radius:50%;overflow:hidden}
.pu-mini .pu-face{font-size:${f(12)}}

/* Minimap (G06): a round window on the bottom right */
.pu-minimap{position:absolute;right:${u(18)};bottom:${u(46)};width:${u(MINIMAP_DIAMETER)};height:${u(MINIMAP_DIAMETER)};border-radius:50%;border:${u(3)} solid rgba(255,255,255,.4);box-sizing:border-box;overflow:hidden;background:rgba(12,14,18,.82);display:flex;align-items:center;justify-content:center;pointer-events:auto}
.pu-minimap-canvas{width:${u(MINIMAP_SIZE.width)};height:${u(MINIMAP_SIZE.height)}}
.pu-zone{position:absolute;right:${u(18)};bottom:${u(18)};width:${u(MINIMAP_DIAMETER)};text-align:center;font-size:${f(18)};font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-shadow:0 1px 3px #000}

/* Crosshair attachments (G07, G08, G10) */
.pu-ammo{position:absolute;left:0;top:${u(80)};transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;font-size:${f(16)};font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums;text-shadow:0 1px 3px #000}
.pu-ammo small{font-size:${f(12)};letter-spacing:.1em;color:${TEXT_DIM}}
.pu-ammo.rl small{color:${BEAK_CSS}}
.pu-ammo.low>span{color:#ff6a5a}
.pu-killbadge{position:absolute;left:${u(30)};top:${u(-150)};width:${u(140)};opacity:0;text-align:center;padding:${u(6)} 0;border-radius:${u(8)};background:rgba(198,40,40,.92);text-shadow:none;pointer-events:none}
.pu-killbadge b{display:block;font-size:${f(30)};letter-spacing:.12em}
.pu-killbadge small{display:block;font-size:${f(20)};font-weight:800;color:#ffe9a0}
.pu-seedspop{position:absolute;left:${u(22)};top:${u(-36)};opacity:0;font-size:${f(20)};font-weight:800;color:${SEEDS_CSS};text-shadow:0 1px 3px #000;pointer-events:none}
.pu-announce{position:absolute;left:50%;top:30%;transform:translateX(-50%);text-align:center;opacity:0;pointer-events:none;text-shadow:0 2px 6px #000}
.pu-announce b{display:block;font-size:${f(36)};letter-spacing:.14em}
.pu-announce small{display:block;font-size:${f(18)};color:${SEEDS_CSS}}
.pu-statusword{position:absolute;left:50%;bottom:${u(190)};transform:translateX(-50%);font-size:${f(36)};font-weight:800;letter-spacing:.14em;color:#ff6a5a;text-shadow:0 2px 6px #000}
.pu-uphint{position:absolute;left:50%;top:calc(50% + ${u(150)});transform:translateX(-50%);font-size:${f(16)};font-weight:700;color:${BEAK_CSS};text-shadow:0 1px 3px #000;white-space:nowrap}

/* Health gauge beside the bird (G03) */
.pu-gauge{position:absolute;left:22%;top:62%;width:${u(160)};height:${u(265)}}
.pu-gauge .shell{position:absolute;left:${u(10)};top:0;width:${u(56)};height:100%;transform:skewX(-8deg);border:${u(3)} solid rgba(255,255,255,.6);border-radius:${u(6)};background:rgba(12,14,18,.7);overflow:hidden}
.pu-gauge .chunk{position:absolute;left:0;right:0;bottom:0;height:100%;background:#e5484d}
.pu-gauge .stack{position:absolute;inset:0;display:flex;flex-direction:column-reverse}
.pu-gauge .stack>div{flex:none;height:0;width:100%}
.pu-gauge .hp{background:${HEALTH_CSS}}.pu-gauge .song{background:${SONG_CSS}}.pu-gauge .talon{background:#fff}.pu-gauge .barrier{background:${BARRIER_CSS}}
.pu-gauge .now{position:absolute;left:${u(80)};top:${u(90)};font-size:${f(40)};font-weight:800;line-height:1;font-variant-numeric:tabular-nums;text-shadow:0 2px 4px #000}
.pu-gauge .max{position:absolute;left:${u(82)};top:${u(136)};font-size:${f(18)};font-weight:700;color:${TEXT_DIM};text-shadow:0 1px 3px #000}
.pu-pips{position:absolute;left:${u(10)};bottom:${u(-28)};display:flex;gap:${u(5)}}
.pu-pip{position:relative;width:${u(16)};height:${u(16)};border-radius:50%;border:${u(2)} solid ${STAMINA_CSS};box-sizing:border-box;overflow:hidden}
.pu-pip i{position:absolute;inset:0;background:${STAMINA_CSS};transform-origin:left;transform:scaleX(0)}
.pu-wallet{position:absolute;left:22%;bottom:${u(24)};display:flex;align-items:baseline;gap:${u(14)};font-size:${f(18)};font-weight:700;text-shadow:0 1px 3px #000}
.pu-wallet .keep{color:${SEEDS_CSS}}
.pu-ap{color:${BEAK_CSS};display:none}
.pu-ap.on{display:inline;animation:pu-pulse 1s ease-in-out infinite}
.pu-seeds{color:${SEEDS_CSS}}
.pu-dead.on{display:flex}

/* Ability row, bottom centre (G04); hold the upgrade key to click an icon (D-EP-038) */
.pu-bottom{position:absolute;left:50%;bottom:${u(34)};transform:translateX(-50%);display:flex;align-items:flex-end;gap:${u(32)};pointer-events:none}
.pu-abil{display:flex;gap:${u(16)}}
.pu-hud.upgrading .pu-abil{pointer-events:auto}
.pu-slot{position:relative;width:${u(72)};display:flex;flex-direction:column;align-items:center;gap:${u(4)}}
.pu-slot .ico{position:relative;width:${u(72)};height:${u(72)};padding:0;border-radius:50%;border:${u(3)} solid rgba(255,255,255,.55);background:rgba(30,34,42,.92);overflow:hidden;cursor:default}
.pu-hud.upgrading .pu-slot .ico{cursor:pointer}
.pu-hud.upgrading .pu-slot .ico:hover,.pu-hud.upgrading .pu-slot .ico:focus-visible{border-color:#fff;outline:none}
.pu-slot.ult .ico{border-color:${SEEDS_CSS}}
.pu-slot.lock .ico{opacity:.45;border-style:dashed}
.pu-slot.up .ico{box-shadow:0 0 0 2px ${BEAK_CSS},0 0 12px ${BEAK_CSS};animation:pu-pulse 1s ease-in-out infinite}
.pu-slot .nm{position:absolute;left:${u(7)};right:${u(7)};top:50%;transform:translateY(-50%);font-size:${f(10)};line-height:1.1;text-align:center;color:${TEXT_DIM};overflow:hidden;max-height:${u(40)}}
.pu-slot .sweep{position:absolute;inset:0;background:rgba(0,0,0,.62);transform-origin:bottom;transform:scaleY(0)}
.pu-slot .cd{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${f(28)};font-weight:800;text-shadow:0 1px 3px #000}
.pu-slot .ch{position:absolute;right:${u(6)};top:${u(4)};font-size:${f(14)};font-weight:800;color:${BEAK_CSS}}
.pu-slot .lk{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:${f(10)};font-weight:700;letter-spacing:.08em}
.pu-slot.lock .nm{display:none}
.pu-slot.lock .lk{display:flex}
.pu-slot .key{font-size:${f(14)};font-weight:800;text-shadow:0 1px 3px #000}
.pu-slot .tiers{display:flex;gap:${u(3)}}
.pu-slot .tiers i{width:${u(14)};height:${u(5)};border-radius:1px;background:rgba(255,255,255,.28)}
.pu-slot .tiers i.on{background:${BEAK_CSS}}
.pu-card-tip{display:none;position:absolute;bottom:calc(100% + ${u(16)});left:50%;transform:translateX(-50%);width:340px;padding:10px 12px;background:rgba(12,14,18,.96);border:1px solid ${TEXT_DIM};border-radius:6px;font-size:13px;line-height:1.35;text-shadow:none;z-index:3}
.pu-hud.upgrading .pu-slot:hover .pu-card-tip,.pu-hud.upgrading .pu-slot:focus-within .pu-card-tip{display:block}
.pu-card-tip .hd{display:block;margin-bottom:4px;font-size:15px;color:${SEEDS_CSS}}
.pu-card-tip p{margin:0 0 6px}
.pu-card-tip ul{margin:0 0 6px;padding-left:16px}
.pu-card-tip li{color:${TEXT_DIM}}
.pu-card-tip li.done{color:${BEAK_CSS}}
.pu-card-tip li.next{color:${TEXT};font-weight:600}
.pu-card-tip .stat{color:${TEXT_DIM}}
.pu-card-tip .cost{margin:0;font-weight:700;color:${BEAK_CSS}}
.pu-acts{display:flex;gap:${u(8)}}
.pu-act{position:relative;width:${u(56)};height:${u(56)};border:1px solid rgba(255,255,255,.25);border-radius:${u(8)};background:rgba(30,34,42,.7);overflow:hidden;opacity:.55}
.pu-act.on{opacity:1}
.pu-act.rdy{border-color:#fff}
.pu-act .key{position:absolute;left:${u(4)};top:${u(2)};font-size:${f(12)};font-weight:800}
.pu-act .nm{position:absolute;left:${u(3)};right:${u(3)};bottom:${u(2)};font-size:${f(9)};color:${TEXT_DIM};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pu-act .cd{position:absolute;right:${u(4)};top:${u(2)};font-size:${f(14)};font-weight:800}

/* Melee hint: only when it applies (G09) */
.pu-melee{position:absolute;left:50%;top:calc(50% + ${u(130)});transform:translateX(-50%);padding:4px 10px;background:${PANEL_BG};border-radius:6px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px;text-shadow:0 1px 3px #000}
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

/* Practice Hub: dummies and Swap bird (D-EP-040) */
.pu-dummies{position:absolute;right:${u(18)};top:${u(210)};width:${u(250)};display:flex;flex-direction:column;gap:6px}
.pu-dummies .list{display:flex;flex-direction:column;gap:6px}
.pu-dummy{padding:6px 8px;background:${PANEL_BG};border-radius:6px;font-size:12px}
.pu-dummy .nm{display:block;font-weight:700}
.pu-dummy .bar{height:10px;margin:3px 0;background:rgba(255,255,255,.14);border-radius:3px;overflow:hidden}
.pu-dummy .bar i{display:block;height:100%;width:100%}
.pu-dummy .fb{color:${BEAK_CSS}}
.pu-dummies .pu-swap{pointer-events:auto;align-self:stretch;font-size:16px;padding:6px 16px}
.pu-dummies .note{color:${TEXT_DIM};text-align:center}
.pu-swap[hidden]{display:none}

/* The end screen's table (it shared the old Tab scoreboard's rules) */
.pu-endtable{width:min(1300px,92vw);border-collapse:collapse;font-size:13px}
.pu-endtable th{text-align:left;color:${TEXT_DIM};font-weight:600;padding:3px 6px}
.pu-endtable td{padding:3px 6px;border-top:1px solid rgba(255,255,255,.08)}
.pu-endtable tr.me td{background:rgba(255,255,255,.1);font-weight:700}
.pu-world .pu-dlabel{z-index:1}
`;
