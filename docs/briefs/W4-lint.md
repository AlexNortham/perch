# W4 · QA · W3 lint follow-ups

Read W4-common.md, the W3 QA gate breakdown and W4-contract-followups.md. Audit the 117 W3 no-magic-numbers
warnings. Coordinate exclusive file ownership with other roles through the EP: the UI and Economy agents resolve
their own warnings. For the remaining warning files, act for the named owner during the assigned mechanical
pass. Move meaningful values into existing named constants, and classify actual test fixtures under the established
test-file convention. Preserve behavior and lint coverage. Record the counts per owner and exact remaining
files before the merge, then verify the integrated count at the gate. Never globally suppress a rule or change
gameplay to silence a warning. Work on tests/e2e only for uncovered W3 QA follow-ups.
