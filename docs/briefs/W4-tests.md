# W4 · QA test-first round · QA

Start after the W3.5 contract merge, before the wave implementers. Own tests/** and e2e/** and append the studio
logs. Follow W4-common.md, tests/README.md and W4-contract-followups.md.

- From GDD §§5–8, 15–16, write red behavioral suites against the real systems or public sandbox for Hawk target
  order, priority interrupt, Heron beam/stomp, Wardens, Shrine gates, Patron transition/attacks/weak point, Brood
  Ward, normal win and Home Roost. Exercise both teams, boundary cases and at least one real hit through Combat.
- Pin earnings vs spending, level thresholds, AP grants/spending/ultimate, Molts, kill/assist/comeback/team bounties,
  first and second Hawk/first Heron/first Shrine flex unlocks and capacity. Exercise buy/sell, visit boundaries,
  quick vs half refunds, component cost/slot/stat replacement, invalid trades and existing inventory.
- Gate **new unimplemented rules only** with PERCH_PENDING=1. Run them enabled and record a red assertion per group
  and why. Keep imports/typechecking valid in both modes. Use data/commands/events, avoiding mocks of the actual rule.
- Land always-on browser proof of a measured dash above walking speed, Play → hero card → actual lane, and a
  documented draw-call ceiling measured with a representative scene, quality, camera and tick count. Cover the W3
  Updraft and worst-tick follow-ups where the current baseline permits. A wall-clock test belongs in *.perf.test.ts.
- Run the default check, inspect evidence, commit the suite and report its red/green counts. The EP lands this on
  main before W4 role worktrees are created. Gate review will require M2 rules to be always on.

Add gated browser acceptance for Play versus Practice Hub, shooting the enemy dummy, healing the wounded ally
with a real support cast, repeating each exercise and returning to a fresh structure match. Test opening the
upgrade panel with its bound action, pointer release, all four descriptions on hover/focus, affordable and locked
upgrades, exactly one AP transaction per click, closing the panel and resuming aim/fire. Coordinate the distinct
Firefox control/stability repros with W4-preview-repro.md.
