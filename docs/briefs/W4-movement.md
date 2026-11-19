# W4 · Character Controller, Camera & Input and Combat · Movement and melee

Read W4-common.md, W4-contract-followups.md, QA's M1 reproduction and the user's linked movement guide. Act for
these path owners in separate commits. All three owners' accepted W3.5 follow-ups belong in this assignment.
UI/HUD handles its own Options capture and visual feedback; the Architect supplies public data and shared settings.
Rendering and Technical Art show animations; Audio supplies the sound. Coordinate through the EP.

- Fix the proven preview-close path at its owner. The standard layout must allow running, crouching, sliding,
  dashing and using items in a normal Edge tab with no browser close/navigation chord. Preserve unrelated
  custom bindings and test existing saved defaults. Verify ordinary and side mouse buttons for tap, hold, release
  and parry under pointer lock. Use QA's evidence on additional causes of tab or renderer loss.
- Implement ground/air traversal from the user reference. Cover directional dash, one stamina air jump and
  one air dash per airtime, wall jumps with a free first push and a half-pip/fatigue cost for repeats, a
  double-tap crouch down-dash for half a pip, and a timed ground dash-jump for a second pip. Show the timing
  window through the view for HUD feedback. Preserve deliberate inputs, input buffering and horizontal momentum
  through slides, slopes, dash landings and mantle-to-slide transitions. Sprint drops on aim/combat and builds
  again after the reference's delay. Test stamina/collision edges, state reset and actual distances.
- Check wall/ledge approach from different directions, heavy-melee-to-wall-jump chaining, normal casts during
  a dash, Updraft mounts/boosts, Chimneys and Vines. Make a traversal route with several linked moves demonstrable
  from the menu. Keep PERCH's original map and bird kits. Implement held melee as a distinct charged lunge with
  observable windup, hit and recovery. Show parry success/whiff and compare a normal light tap. Route pose,
  cue and input requests to the relevant owners.
- Follow the director's numbers where the reference leaves implementation latitude. Link from internal design
  and briefs only. Source: [movement reference](https://deadlock.wiki/Movement).
- Prove the reports with real browser inputs plus deterministic controller/combat tests. Supply screenshots or
  a small frame sequence for movement, heavy melee and parry and a sustained preview replay. Run six-step check.

Trace gun aim from the muzzle to the screen centre on an open distant sightline, particularly Albatross. Verify
level and shallow-angle shots, both shoulders, crouch and camera pull-in. Actual shots follow straight lines to
the chosen aim point with the gun's specified spread about that point. Adjacent or rear scenery must not attract
shots. Check real muzzle obstruction separately. Give Rendering the authoritative shot paths for hits and misses.
