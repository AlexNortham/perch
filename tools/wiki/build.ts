// npm run wiki [-- --images]
// Regenerates wiki/: every page from the game's data, item icons and map as SVG, and screenshots of the running game.
// Screenshots are named by a hash of what they show, so only images whose inputs changed are captured again.
// --images forces a full re-capture. --no-images skips capture (pages still build; missing images are reported).
import { resolve } from 'node:path';
import { capture } from './capture';
import { generate } from './generate';
import { ROOT } from './facts';

const OUT = resolve(ROOT, 'wiki');
const argv = new Set(process.argv.slice(2));
const started = performance.now();

// Pages first (this also registers the image plan), then screenshots, then pages again so the image list is final.
let result = generate(OUT);
if (!argv.has('--no-images')) {
  const shots = await capture(OUT, argv.has('--images'));
  console.log(`wiki: images captured ${shots.done}, reused ${shots.skipped}${shots.fallbacks.length ? `, fell back ${shots.fallbacks.length}` : ''}`);
  for (const f of shots.fallbacks) console.log(`  fallback: ${f}`);
  result = generate(OUT);
}
if (result.broken.length > 0) {
  console.error(`wiki: ${result.broken.length} broken link(s):\n  ${result.broken.join('\n  ')}`);
  process.exitCode = 1;
}
if (result.missingImages.length > 0) console.error(`wiki: ${result.missingImages.length} image(s) missing; run npm run wiki`);
console.log(`wiki: ${result.pages.length} pages, ${result.images.length} images, ${(result.bytes / 1048576).toFixed(1)} MB in ${((performance.now() - started) / 1000).toFixed(1)} s -> wiki/`);
