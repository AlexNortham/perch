# W4 test-first · QA browser coverage

Read W4-common.md, W4-tests.md and W4-contract-followups.md. During the test-first round the rules QA owns
tests/**. You own the W4 browser coverage under e2e/**, excluding preview-regressions.spec.ts and preview-diagnostics.mjs.
Start from the contract round. Make the measured dash versus walk, menu-to-card-to-lane and representative
draw-call checks always on. Check the W3 Updraft browser proof. Use representative busy scenes, deterministic
timing where possible, and a justified ceiling tight enough to catch a material regression.

Add behavioral acceptance for ordinary menu → Practice Hub, damage/healing and repeated trials using a support
hero; the pointer-free description and clickable upgrade panel, normal match progression and clean session
return. Gate genuinely unimplemented M2 features with PERCH_PENDING=1 until integration. Capture a named
failing assertion and reason per group. Prove existing behavior in the default six-step check. Keep repeats,
read-only observations, controls and locator choices robust to real simulation timing. Commit coherent pieces
and return a report of at most 200 words. The EP lands these tests before game implementation starts.
