# W4 · UI/HUD · UI

Own client/ui. Read W4-common.md, the contract follow-ups and GDD §§12, 16. Implement each M2 HUD element against
live views, including levels/AP and upgrades, current Seeds, inventory/active slots, objective health and gates,
vision-filtered north-up minimap (east at left), big map, pings in world/map/feed, scoreboard, kill feed, damage
numbers and actual victory/defeat. Build the Magpie's Hoard with all three categories and four tiers, working
transactions/components/refunds, zone feedback and read-only browsing away from a stall. Derive catalogue and
input labels from public boundaries. Keep the 24-card picker, Options and its rebinding/volume persist-and-apply
flow. Migrate imports and fix this owner's warnings. Inspect menu, match, shop, scoreboard and result at 1080p;
check labels, keyboard/pointer interaction, readable overlays and dismissed panels. Give evidence paths.

The player reported failed mouse rebinding and indistinct heavy melee. Fix Options capture for supported primary,
middle, secondary and side buttons through down/up/auxiliary navigation; keep conflict swaps and saved profiles.
Make tap-versus-hold clear on the actual melee binding and show heavy charge, parry and the dash-jump window
using the agreed live data. Verify both side buttons operate their rebound actions in play.

Add a clearly visible Practice Hub menu choice and hero picker. In the hub identify the damage and healing
dummies and show their live health and feedback. The upgrade control opens a non-pausing, cursor-free panel in
the hub and live match. The player can browse all four abilities, hover or focus to see each real description,
current tier and next upgrade, and click a valid upgrade. Show cost/unspent AP and a reason when locked or maxed.
Provide a discoverable close action and restore playing input cleanly. Preserve rebound keyboard shortcuts.

Use accessible names that also let QA exercise the real controls: an Ability Upgrades dialog, descriptions linked
to their ability, Upgrade <ability> buttons with the unavailable reason, and Enemy dummy / Ally dummy health
progress bars exposing current and maximum HP. Keep tooltips discoverable with keyboard focus.
