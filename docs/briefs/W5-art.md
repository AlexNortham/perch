# Wave 5b · Technical Artist (#15) · eight birds at the new bar · tag ART

Read W5-common.md, then **docs/art/style-guide.md**, which is the bar (D-EP-047), and the reference frames it names in
`C:\Users\AlexNortham\Documents\game\out\reference\` (read-only). You own `src/client/render/models/**`,
`src/client/render/rigs/**` and `tests/anim/**`.

Build **Peacock, Vulture, Swift, Hummingbird, Cassowary, Toucan, Woodpecker and Nightjar** to the style guide, at
production quality:
- smooth sculpted bodies (lathe, extrude and subdivided forms, not stacked primitives);
- layered feathers and each species' signature features (Peacock's train, Vulture's ruff, Toucan's bill,
  Hummingbird's iridescence and so on);
- proper eyes, beaks, feet and talons;
- gear carrying the flock colour;
- a distinct gun per archetype in bird-world materials, taking at most 4 % of the screen.

Read sizes from each bird's `BodyPlan` at runtime, and keep the head on its hitbox and the muzzle on the sim's muzzle
point.

Every animation state meets the animation bar (D-EP-035): guns held, feet planted, nothing floating. Add each bird's
own cast poses where its kit implies them.

Use the Rendering engineer's shared material library and level-of-detail framework, which land in parallel. Start from
their published API; if it hasn't landed yet, write against the API they describe and switch over when it lands. Say
in your report which you did. Stay within the style guide's per-bird triangle and draw-call budget.

Prove it:
- the attachment tests pass for all 20 playable birds;
- you have looked at a pose sheet per new bird, a 10 m / 40 m / 80 m readability line-up, and a side-by-side against
  the reference frames the style guide names for characters;
- you have scored each bird against the style guide's checklist in your STATUS entry.

`npm run check` must pass all six steps.
