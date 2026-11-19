# M2 · Production assistant · EP support

Read W4-common.md. Assist the EP and Architect during W3.5 with a **read-only** inventory of the existing design
and Stage 2 source. The Architect decides interfaces; the QA test-first round starts after W3.5.

1. Compare GDD §§9.5–9.12 and the 16 items in D-EP-026 with the current interfaces and the W3.5 brief. Send the
   Architect a compact list of cross-owner requirements that might otherwise be missed before contracts freeze.
   Cite the existing contract or file and mark anything already implemented.
2. Compare the W3 QA lint counts with the actual lint output. For UI, Economy and the remaining mechanical pass,
   name the files so the EP can assign each file to a single owner.
3. Identify the public inputs and existing read-only observations suitable for demonstrating a hand-playable
   siege, and the exact GDD spawn, shop and first-target positions. Send this small checklist to the EP.

Use your assigned worktree, install its own dependencies and run the current six-step check. All source and
tests stay read-only. Append only your dated production-support entry to the STATUS Log. Commit it locally and
report per W4-common.md. The EP handles merges, the release guide and sign-off.
