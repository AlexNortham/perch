# Combat

## Damage types

There are two kinds of damage. **Talon** damage comes from guns and melee. **Song** damage comes from abilities and most item effects. Each bird has a Talon resist and a Song resist that reduce damage of that type; items and abilities can raise them, and shred effects lower them. Resists, amplification and status resist all have caps.

Damage is worked out in a fixed order: base damage, the gun's falloff, the beak-shot multiplier, outgoing bonuses, incoming amplification, resists, shields and finally health. Structures are special: see [[units/towers|Towers]].

{{combat-numbers}}

## Guns

Every gun is fully automatic: hold fire. Each shot has a base damage per pellet, a fire rate, a magazine and a spread. Guns either hit instantly (hitscan) or fire projectiles that travel and drop out at range.

{{guns-table}}

## Beak shots

A gun hit on a hero's **head** is a beak shot and deals extra damage, shown by a gold hit marker. Birds with small heads give you a smaller target. Some items add flat damage to beak shots, and some abilities can beak-shot too. Structures and fledglings cannot be beak-shot.

## Falloff

Damage is full up to a start distance and falls steadily to a floor at an end distance. Shotguns fall off fast; rifles reach far. Items such as Close Talons reward fighting close.

## Melee and parry

Tap the melee key for a quick light swing. Hold it for a heavy swing that winds up, lunges forward and knocks the target back. A heavy swing can be parried.

{{melee-table}}

### Parry

The parry key opens a short block window. If an enemy melee hit lands inside it, that enemy is stunned. Miss the timing and you are locked out briefly, and the parry then has a cooldown.

## Combat state

Dealing or taking hero damage, firing or casting puts you in combat. In combat you cannot sprint and some items behave differently. After a few quiet seconds you are out of combat again.

## Healing and regeneration

Every bird regenerates a little health at all times. Items add to this, and some trigger extra regeneration after a quiet period. Heal reduction statuses make every source weaker: see [[mechanics/statuses|Statuses]].
