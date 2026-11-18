/**
 * Match telemetry: what `sim.telemetry()` returns and the headless CLI writes as JSON for Balance & Data.
 * Collected by core from events and from Progress; no system writes it directly. Bump `version` on any change.
 */
import type { Controller, HeroId, ItemId, PlayerTeam, Team } from './base';
import type { MapId } from './map';

export interface HeroTelemetry {
  /** Roster slot (SimConfig.roster index). */
  readonly slot: number;
  readonly heroId: HeroId;
  readonly team: PlayerTeam;
  readonly controller: Controller;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  /** Non-hero kills credited to this hero. */
  readonly lastHits: number;
  readonly denies: number;
  readonly podsSecured: number;
  readonly damageToHeroes: number;
  readonly damageToStructures: number;
  readonly damageTaken: number;
  readonly healing: number;
  /** Gun hits on heroes, and how many were beak shots (beak-shot % on the end screen). */
  readonly gunHits: number;
  readonly beakShots: number;
  readonly level: number;
  readonly netWorth: number;
  /** Net worth sampled every `sampleSeconds`, from t = 0. */
  readonly netWorthCurve: readonly number[];
  readonly itemsBought: readonly { readonly s: number; readonly item: ItemId }[];
  readonly itemsSold: readonly { readonly s: number; readonly item: ItemId }[];
}

/** One objective moment: a structure, Roc or Nest falling, a Patron phase, an Egg or Ember or rune event. */
export interface ObjectiveTelemetry {
  /** Seconds from match start. */
  readonly s: number;
  /** StructureType or 'roc' for deaths, 'patronPhase2', or an ObjectiveAction. */
  readonly what: string;
  /** The team that lost the structure, or the team that scored the objective. */
  readonly team: Team;
  /** Hero credited, if any. */
  readonly hero: HeroId | null;
}

export interface MatchTelemetry {
  readonly version: 1;
  readonly seed: number;
  readonly map: MapId;
  readonly ticks: number;
  readonly seconds: number;
  /** null if the run stopped before a Patron fell. */
  readonly winner: PlayerTeam | null;
  readonly sampleSeconds: number;
  /** One per roster slot, in roster order: the hero picks. */
  readonly heroes: readonly HeroTelemetry[];
  readonly teams: {
    readonly [T in PlayerTeam]: { readonly kills: number; readonly netWorthCurve: readonly number[] };
  };
  readonly objectives: readonly ObjectiveTelemetry[];
}
