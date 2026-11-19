# Wave 3 — Technical Artist, Models & Animation (#15), tag ART

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own** `src/client/render/models/**` and `src/client/render/rigs/**`.
**Read as well:** GDD §9 (silhouette notes and body dimensions for shrike, albatross, kingfisher and lyrebird; skim the
other 20), §7 (fledglings), §14 (visual direction and procedural bird style); the `ModelKit` contract in
`src/client/app/contracts.ts`; `BodyPlan` in `src/sim/core/contracts/heroes.ts` and the hero data files;
`src/sim/core/contracts/view.ts` (the animation flags); Rendering's wave 2 Log entry in STATUS.md (how instancing plugs
in) and `src/client/render/palette.ts` (team colours).

## Your job
Procedural, low-poly, flat-shaded models built from primitives, no external assets, with code-driven rigs:
1. **Shrike, Albatross, Kingfisher, Lyrebird**: distinct silhouettes readable at 40 m, matching the GDD notes. Each
   model's dimensions come from that hero's `BodyPlan`: the head sits exactly on the head hitbox sphere, the height
   matches. Team colour accents (Dawn vs Dusk) from the palette.
2. **A generic placeholder bird** for the other 20 heroes, scaled to each one's `BodyPlan`, so every hero renders.
3. **Fledglings**, melee and ranged, instanced so ~150 of them cost only a handful of draw calls; per-instance
   animation by cheap means (vertex-free tricks such as bobbing and part offsets are fine).
4. **Animation** from the view flags and events: idle, run, sprint, jump/air, dash, slide, mantle, climb, Updraft ride,
   shoot (recoil), reload, cast, melee, death. Snappy and readable over subtle.
5. A debug option to draw hitboxes (head sphere and body capsule) over models, for QA.

Performance: one hero should cost no more than about 10 draw calls (merge static parts); 150 fledglings ≤ 10 draw calls
in total.

## Prove it
- Unit tests for the model kit: every one of the 24 hero ids gets a model; the head of each of your four models is
  within 2 cm of its hitbox centre; instancing capacity holds 200 fledglings.
- Screenshots you look at with the Read tool: each of your four heroes close up from front and side (`?scene=sandbox` or
  `?scene=lane&hero=<id>` with a suitable `--cam`, or `--param` options you read inside your own module); a fledgling
  wave; the hitbox overlay on a hero. Iterate until they look good and distinct.
- `npm run check` passes.

Extra for your report: draw calls per hero and for 150 fledglings.
