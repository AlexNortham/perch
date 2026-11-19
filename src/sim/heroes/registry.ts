/**
 * Every hero module by id (D-EP-011, D-EP-015). Owner: Technical Architect. Adding a hero is an ADR plus one line
 * here; hero engineers own the modules it points to.
 */
import type { HeroId, HeroModule } from '../core/contracts';
import { shrike } from './shrike';
import { albatross } from './albatross';
import { kingfisher } from './kingfisher';
import { lyrebird } from './lyrebird';
import { hornbill } from './hornbill';
import { flamingo } from './flamingo';
import { penguin } from './penguin';
import { puffin } from './puffin';
import { peacock } from './peacock';
import { vulture } from './vulture';
import { swift } from './swift';
import { hummingbird } from './hummingbird';
import { owl } from './owl';
import { pelican } from './pelican';
import { secretarybird } from './secretarybird';
import { starling } from './starling';
import { cassowary } from './cassowary';
import { toucan } from './toucan';
import { woodpecker } from './woodpecker';
import { nightjar } from './nightjar';
import { frigatebird } from './frigatebird';
import { cockatoo } from './cockatoo';
import { swan } from './swan';
import { kiwi } from './kiwi';

export const HEROES: Readonly<Record<HeroId, HeroModule>> = {
  shrike,
  albatross,
  kingfisher,
  lyrebird,
  hornbill,
  flamingo,
  penguin,
  puffin,
  peacock,
  vulture,
  swift,
  hummingbird,
  owl,
  pelican,
  secretarybird,
  starling,
  cassowary,
  toucan,
  woodpecker,
  nightjar,
  frigatebird,
  cockatoo,
  swan,
  kiwi,
};

/** Characteristic body colours for the four original Stage 2 models. New kits publish HeroDef.swatch. */
const ORIGINAL_SWATCHES: Partial<Record<HeroId, number>> = {
  shrike: 0x8a8d94, albatross: 0xf2efe6, kingfisher: 0x1f8fff, lyrebird: 0x6f4f36,
};
const UNFINISHED_SWATCH = 0x898982;

export function heroSwatch(id: HeroId): number {
  return HEROES[id].def.swatch ?? ORIGINAL_SWATCHES[id] ?? UNFINISHED_SWATCH;
}
