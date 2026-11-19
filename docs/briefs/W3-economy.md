# Wave 3 — Economy & Items Engineer (#11), tag ECON

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own** `src/sim/economy/**`, `src/sim/items/**`, `src/sim/data/economy.ts` and `src/sim/data/items.ts`.
**Read as well:** GDD §8 (economy; especially seed pods, the instant share and denying), §5 (what can hit a pod);
INTERFACES.md §3 (the `progress` and `pickup` components), §5 (`entity.died`, `projectile.impact`, `pod.resolved`,
`seeds.gained`) and the economy rows of §9; Combat's wave 2 Log entry (pods are hittable); QA's test-first suite
`tests/rules/pods.test.ts`.

## Your job (wave 3 scope: seeds and seed pods)
1. **Seeds** on heroes: the `progress` component's Seeds and net worth; `seeds.gained` events with a reason.
2. **The last-hit share:** when a fledgling dies, the instant share per GDD §8.
3. **Seed pods:** spawned on fledgling death, rising, a ripe window, secured when shot by the right flock, denied when
   shot by the other flock as GDD §8 defines, withering if nobody shoots; ability hits don't count if the GDD says so
   (check W3-contract-followups.md for how `projectile.impact` now tells guns from abilities). `pod.resolved` events
   with the outcome and position, for the "secured" pop and "denied" crunch.
4. Telemetry: seeds per hero over time feed the existing collector (`seeds.gained`).

Levels, AP grants, Molts, bounties, flex slots and the shop are wave 4; don't start them.

## Prove it
- `PERCH_PENDING=1 npx vitest run tests/rules/pods.test.ts` passes in full (quote it). If an assertion contradicts the
  GDD, say which and why; don't work around it.
- Co-located tests for the share split, secure vs deny by flock, wither timing, and ability hits.
- A 35-minute headless run completes; report the seeds per hero at 10 and 35 minutes.
- `npm run check` passes.
