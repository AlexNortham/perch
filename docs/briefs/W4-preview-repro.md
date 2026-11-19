# W4 · QA reproduction of the player's M1 preview reports

Read W4-common.md. The player reports the tab sometimes closes while running, mouse buttons cannot be bound to
melee and parry, and heavy melee appears absent. Investigate the actual M1 production preview and send findings
to the EP and W3.5 Architect as soon as reproducible. This role starts independently on the Stage 2 baseline.
The player confirmed **Firefox on the version on GitHub main (6df745e)**, running, dashing and jumping; no
other chord was established. Use your own production preview, port and isolated Firefox profile first. Keep Edge
as the existing Playwright baseline. If necessary install matching Playwright Firefox for the diagnostic run
and state the exact version/engine and headless limits. Keep the user's browser windows untouched.

- Distinguish native browser close shortcuts (particularly forward + crouch, or forward + dash + crouch),
  back/forward mouse navigation, JS exceptions, WebGL context loss, browser/process crashes, and resource growth.
  Use a sustained input and movement run with a busy lane. Record run length, UI route, keys, browser, whether
  the page closed/crashed/navigated and the limits of headless simulation of browser chrome. Read the binding and
  input handling source. Test the user's exact sequence when known. Preserve diagnostics for the fixing owner.
- Exercise Options capture and actual held/released input for standard and side mouse buttons. Test rebinding
  melee and parry, persistence, pointer lock, conflict swaps, an empty swing, a charged lunge and parry feedback.
  Distinguish a missing mechanic from a missing action route or missing player feedback.
- Own only reproduction/regression files under tests/** and e2e/** dedicated to this report. New red behavior
  can be gated with PERCH_PENDING=1 until the fix lands. Keep existing suites green. Independently verifiable
  tests should cover new safe default bindings, player action and sustained preview liveness after the fix.
  Communicate a concrete normal-control player route and named observations. Append your studio Log and commit.
