# W4 · Technical Artist, animation quality fix (#15) · tag ART

Read W4-common.md first; its working agreement applies. **This is a quality fix the user reported in play: guns float
next to the birds instead of being held.** It must be fixed for every playable bird before Stage 3 ships, and it must
not be able to come back (D-EP-035).

## You own
`src/client/render/models/**` and `src/client/render/rigs/**`, plus `tests/anim/**` for the new checks (act for QA in
that folder only). The sim's aim model is not yours. The gun's muzzle must end up where the hero's `BodyPlan` muzzle
offset says shots come from. If a bird's muzzle offset makes a believable hold impossible, put the exact change you need
under Interface requests; don't edit hero data.

## Fix
1. **Held weapons.** Each of the 12 playable birds (A1, A2, B1) and the generic placeholder bird hold their gun with
   explicit grip sockets: a main grip in one wingtip ("hand") or the talons, and a support grip on the other wing, in a
   style that suits the bird's silhouette and gun. The gun is parented to the rig, never to world space and never
   placed independently at the muzzle point. The wings move to the gun, not the gun to an empty spot.
2. **Every state keeps the hold.** Idle, run, sprint, jump, fall, land, dash, slide, mantle, climb, Updraft ride, aim,
   shoot (recoil travels through the wings), reload (an actual reload motion), light melee, charged heavy melee,
   parry, cast (a cast pose per ability slot where the kit implies one), hit react and death. In melee and cast poses
   the gun may be lowered or slung, but it stays attached to the bird.
3. **Grounding.** When grounded, feet stay planted on the ground, without sliding or floating. When airborne, legs
   tuck. No body part ever floats free of the rig.
4. The **muzzle flash and tracers** start at the held gun's muzzle, which must coincide with the sim's muzzle point
   within 3 cm in the aim pose.
5. Keep the head on its hitbox, the team-colour readability and the draw-call budget (lane 32 on low, 48 on medium,
   from QA's draw-budget e2e).

## Prove it
- `tests/anim/attachment.test.ts`: for every playable hero and every animation state, sampled at several times in
  the cycle:
  - the gun's grip sockets stay within 2 cm of the hand sockets;
  - the muzzle stays within 3 cm of the sim muzzle point in the aim pose;
  - grounded feet stay within 3 cm of the ground;
  - every mesh descends from the rig root.
- **Pose sheets:** one PNG per playable bird showing every state above, from three-quarter and side views
  (`out/anim/<hero>.png`). Look at all 12 with the Read tool and iterate until nothing floats, clips badly or reads
  wrong.
- `npm run check` passes all six steps. STATUS Log entry `### W4 · Animation quality fix · <date>` and D-ART
  decisions. Reply in at most 200 words: branch, last commit, the per-hero result, and anything you couldn't fix.
