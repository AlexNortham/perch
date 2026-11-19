# W4 · Objectives · OBJ

Own sim/world except world/map, plus sim/data/world.ts. Read W4-common.md, the contract follow-ups, QA's red
suites, GDD §§5.2, 5.11, 6–8, 15–16 and D-OBJ-001…004. Populate the actual structure match in both bases and all
lanes. Implement Hawk target priority and ramp, Heron gate/beam/stomp, paired Wardens, Shrine gates/pulse,
Brood Ward and late-game modifier, two-phase Patron, heart-feather state, attacks, Home Roost and exactly one
match result. Use real damage/events; honor the Combat and Economy seams. Ensure waves can breach the base and a
human can complete a siege using normal inputs. Coordinate tower footprint, the 12 m Updraft and art against GDD
map anchors; preserve usable clearance through each tower. Profile wave spawns and fix the W3 worst-tick spike.
Report warm spawn timings, overall tail and mean separately with scenario and seed. Exercise QA rules and deterministic replay.

Honor the hub/training-mode contract: the two stationary targets are available from the player menu, an opposing
dummy accepts normal damage and a friendly wounded dummy accepts normal support abilities and healing. Keep both
repeatable, with visible health, no match-ending or bounty side effects and no accidental behavior changes in a
structure match. Coordinate the Architect's bootstrap and Combat's existing team-targeting rules. Keep isolated
training logic separate from the hot path for lane waves.
