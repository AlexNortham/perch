# Stage 4 · Game Director (#2) · feel reference from gameplay videos · tag DIR

Read W5-common.md first. The user provided five full-match videos of the reference game so the studio can get the feel
of how PERCH should play:

- https://www.youtube.com/watch?v=HP8-yBieQK8
- https://www.youtube.com/watch?v=2M_Yf6EXdTs
- https://www.youtube.com/watch?v=N77LqE8zTfQ
- https://www.youtube.com/watch?v=IXU64ax4IAY
- https://www.youtube.com/watch?v=7zjBAwpUeBU

## How to look (frames, never downloads)
- Use Playwright with the installed Edge (`channel: 'msedge'`). Write any capture script in `out/` or your scratch area,
  never in `src/`. Open each video page, decline non-essential cookies on the consent dialog, skip ads where you can,
  and seek the `<video>` element (`currentTime`) to capture frames.
- **Don't download any video file** (no yt-dlp or the like) and don't commit any frame. Save frames only under
  `out/reference/<video>/` (git-ignored).
- Budget about 10–15 frames per video. Pick moments rather than uniform sampling, and look at each one yourself:
  - early laning (about 2–5 min), a team fight, the shop open, a zipline ride and boost;
  - the urn carry and delivery, the mid-boss, a base siege late in the match;
  - HUD close-ups;
  - for timing, a short burst one second apart through one fight and one movement sequence.

## What to write: `docs/reference/feel-reference.md` (new; you own it)
Write in your own words, with no copied text and no images in the repo. Cover:
1. **HUD and UI:** layout of every element, what is always on screen, what appears in context.
2. **Camera:** framing, shoulder offset, apparent field of view, how close the character sits.
3. **Combat readability:** how abilities, tracers, hits and effects read, colour use, team identification.
4. **Map:** density, lighting, verticality, interiors, how busy streets and the jungle look.
5. **Pacing**, estimated from the frame bursts: time to kill in typical duels, fight length, dash and zipline speed
   relative to body height, how long waves take to meet, structure fight lengths.
6. **Targets for PERCH:** concrete numbers or rules for the Stage 5 style guide (D-EP-042) and balancing (D-EP-043 and
   D-EP-045, including time-to-kill windows per archetype matchup), plus anything that looks wrong in PERCH's current
   GDD numbers.
7. **Stage 4 flags:** anything wave 5 should change now (HUD, camera, map density), listed separately and kept short.

Mechanics, layout and feel only (D-EP-002): PERCH copies no art, characters, names or UI assets.

## Done means
The reference document exists, with every frame you used looked at. STATUS entry `### Stage 4 · Feel reference ·
<date>`. Reply in at most 200 words with the top five takeaways and the Stage 4 flags.
