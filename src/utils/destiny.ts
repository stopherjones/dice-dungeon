/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterStats, HeroClassId, StatType } from '../types/game';
import raw from '../data/destiny.json';

export interface DestinyDiagnosis {
  classId: HeroClassId;
  label: string; // short snappy tag, e.g. "Highly skilled Champion"
  callingTitle: string;
  verdictTag: string;
  reason: string;
  fateTokenCount: number;
}

export interface RaceResult { name: string; trait: string; fate: number; index: number }

// ---- shape of destiny.json ----
interface Cond {
  totalMin?: number;
  totalMax?: number;
  maxStatMax?: number;
  highCount?: { value: number; count: number };
  statMin?: Partial<Record<StatType, number>>;
  dominates?: Partial<Record<StatType, StatType[]>>;
}
interface Text { label: string; callingTitle: string; verdictTag: string; reason: string; note?: string }
interface Rule extends Text { id: string; class?: HeroClassId; fateTokens?: number; when: Cond | Cond[] }
interface Pick { top?: StatType; second?: StatType; low?: StatType; minTop?: number; class: HeroClassId; label?: string; callingTitle?: string; verdictTag?: string; reason?: string; note?: string }
interface Race { name: string; trait: string; nameStarts: string[]; nameEnds: string[] }
interface RaceRule { race: string; top?: StatType; second?: StatType; low?: StatType; spreadMax?: number }
interface Tables {
  classes: Record<HeroClassId, { fateTokens: number; callingTitle?: string; pitch?: string }>;
  rules: Rule[];
  fallback: Text & { mode: 'picks' | 'candidates'; candidates: { class: HeroClassId; stats: StatType[] }[] };
  picks: { defaults: { label: string; verdictTag: string; reason: string }; rows: Pick[] };
  statWords: Record<StatType, [number, string][]>;
  phrases: { lowClause: { max: number; text: string } };
  display: { titleFormat: string };
  races: { mode?: 'dice' | 'stats'; default?: string; rules?: RaceRule[]; rows: Race[] };
}

const T = raw as unknown as Tables;
const STATS: StatType[] = ['STR', 'DEX', 'CON', 'INT', 'LCK'];

/** Fails loudly, with a useful message, if a hand edit of destiny.json breaks a reference. */
function validate(): void {
  const bad = (m: string): never => { throw new Error(`destiny.json: ${m}`); };
  const cls = (c: string, where: string) => { if (!T.classes[c as HeroClassId]) bad(`unknown class "${c}" in ${where}`); };
  const stat = (s: string, where: string) => { if (!STATS.includes(s as StatType)) bad(`unknown stat "${s}" in ${where}`); };
  T.rules.forEach((r) => {
    if (r.class) cls(r.class, `rule "${r.id}"`);
    (Array.isArray(r.when) ? r.when : [r.when]).forEach((c) => {
      Object.keys(c.statMin ?? {}).forEach((k) => stat(k, `rule "${r.id}"`));
      Object.entries(c.dominates ?? {}).forEach(([k, o]) => [k, ...(o ?? [])].forEach((s) => stat(s, `rule "${r.id}"`)));
    });
  });
  T.fallback.candidates.forEach((c) => { cls(c.class, 'fallback'); c.stats.forEach((s) => stat(s, 'fallback')); });
  T.picks.rows.forEach((p, i) => {
    cls(p.class, `picks row ${i + 1}`);
    [p.top, p.second, p.low].forEach((s) => { if (s) stat(s, `picks row ${i + 1}`); });
  });
  STATS.forEach((k) => { if (!T.statWords?.[k]?.length) bad(`statWords needs bands for ${k}`); });
  if (!T.phrases?.lowClause) bad('phrases.lowClause is missing');
  if (!T.races.rows.length) bad('races needs at least one row');
  T.races.rows.forEach((r) => { if (!r.nameStarts.length || !r.nameEnds.length) bad(`race "${r.name}" needs nameStarts and nameEnds`); });
  const raceNames = T.races.rows.map((r) => r.name);
  if (T.races.default && !raceNames.includes(T.races.default)) bad(`races.default "${T.races.default}" is not a race`);
  (T.races.rules ?? []).forEach((x, i) => {
    if (!raceNames.includes(x.race)) bad(`unknown race "${x.race}" in races.rules row ${i + 1}`);
    [x.top, x.second, x.low].forEach((s) => { if (s) stat(s, `races.rules row ${i + 1}`); });
  });
}
validate();

// ---- engine ----
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m)); // unknown {tags} stay visible

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Adjective for a stat value, from the statWords bands in destiny.json. */
function word(k: StatType, v: number): string {
  const bands = T.statWords[k];
  return (bands.find(([max]) => v <= max) ?? bands[bands.length - 1])[1];
}

/**
 * Highest, second highest and lowest stat. Ties for highest/second go to the earlier of
 * STR, DEX, CON, INT, LCK; ties for lowest also go to the earlier one.
 */
function rank(s: CharacterStats) {
  const order = STATS.map((k, i) => ({ k, v: s[k], i })).sort((a, b) => b.v - a.v || a.i - b.i);
  const low = order.slice(2).sort((a, b) => a.v - b.v || a.i - b.i)[0];
  return { top: order[0], second: order[1], low };
}
type Rank = ReturnType<typeof rank>;

function holds(c: Cond, s: CharacterStats, total: number, max: number): boolean {
  return (
    (c.totalMin === undefined || total >= c.totalMin) &&
    (c.totalMax === undefined || total <= c.totalMax) &&
    (c.maxStatMax === undefined || max <= c.maxStatMax) &&
    (!c.highCount || STATS.filter((k) => s[k] >= c.highCount!.value).length >= c.highCount.count) &&
    Object.entries(c.statMin ?? {}).every(([k, v]) => s[k as StatType] >= (v as number)) &&
    Object.entries(c.dominates ?? {}).every(([k, others]) => (others ?? []).every((o) => s[k as StatType] >= s[o]))
  );
}

/** Most specific matching row wins; ties go to the earlier row. */
function pickRow(r: Rank): Pick | undefined {
  const fields = ['top', 'second', 'low'] as const;
  const ctx = { top: r.top.k, second: r.second.k, low: r.low.k };
  let best: Pick | undefined;
  let n = -1;
  for (const p of T.picks.rows) {
    const set = fields.filter((f) => p[f]);
    if (set.length > n && set.every((f) => p[f] === ctx[f]) && r.top.v >= (p.minTop ?? 0)) { best = p; n = set.length; }
  }
  return best;
}

function build(classId: HeroClassId, text: Partial<Text>, s: CharacterStats, total: number, max: number, r: Rank, tokens?: number, raceName?: string): DestinyDiagnosis {
  const cls = T.classes[classId];
  const fateTokens = tokens ?? cls.fateTokens;

  const topAdj = word(r.top.k, r.top.v);
  const secondAdj = word(r.second.k, r.second.v);
  const lowAdj = word(r.low.k, r.low.v);
  const lc = T.phrases.lowClause;
  const lowClause = r.low.v <= lc.max ? fill(lc.text, { lowAdj }) : ''; // only when the weakness is real

  const v = {
    ...s, total, max, fateTokens,
    CLASS: classId.toUpperCase(), Class: cap(classId), class: classId,
    race: raceName ?? '',
    top: r.top.k, second: r.second.k, low: r.low.k, topValue: r.top.v, secondValue: r.second.v,
    topAdj, TopAdj: cap(topAdj), secondAdj, SecondAdj: cap(secondAdj), lowAdj, LowAdj: cap(lowAdj), lowClause,
  };

  // Main sentence, then the row's own note, or else the class pitch. A note of "" adds nothing.
  const extra = text.note !== undefined ? text.note : cls.pitch ?? '';
  const reason = [fill(text.reason ?? T.fallback.reason, v), fill(extra, v)]
    .filter(Boolean).join(' ').replace(/ {2,}/g, ' ');

  return {
    classId,
    label: fill(text.label ?? T.fallback.label, v),
    callingTitle: fill(text.callingTitle ?? cls.callingTitle ?? T.fallback.callingTitle, v),
    verdictTag: fill(text.verdictTag ?? T.fallback.verdictTag, v),
    reason,
    fateTokenCount: fateTokens,
  };
}

function candidateClass(stats: CharacterStats): HeroClassId {
  return T.fallback.candidates
    .map((c) => ({ id: c.class, score: Math.round(c.stats.reduce((n, k) => n + stats[k], 0) / c.stats.length) }))
    .sort((a, b) => b.score - a.score)[0].id;
}

/** Class for a roll no class-rule claimed: the picks table, else the old highest-score tie-break. */
function classFromPicks(r: Rank, stats: CharacterStats) {
  const p = T.fallback.mode === 'picks' ? pickRow(r) : undefined;
  return { p, classId: p?.class ?? candidateClass(stats) };
}

/**
 * Analyzes rolled attributes and assigns an adventurer class & loadout based on fate.
 * All rules and wording live in ../data/destiny.json. Pass the race name (from determineRace)
 * so the reason text can introduce it.
 */
export function determineHeroClassFromStats(stats: CharacterStats, raceName?: string): DestinyDiagnosis {
  const total = STATS.reduce((n, k) => n + stats[k], 0);
  const max = Math.max(...STATS.map((k) => stats[k]));
  const r = rank(stats);

  for (const rule of T.rules) {
    const sets = Array.isArray(rule.when) ? rule.when : [rule.when];
    if (sets.some((c) => holds(c, stats, total, max))) {
      // A rule with no class is a "tier": it supplies the label and text, and the class comes from picks.
      // Rules write their own full reason, so no class pitch is added unless the rule has a note.
      return build(rule.class ?? classFromPicks(r, stats).classId, { ...rule, note: rule.note ?? '' }, stats, total, max, r, rule.fateTokens, raceName);
    }
  }

  const { p, classId } = classFromPicks(r, stats);
  const text: Partial<Text> = p
    ? { label: p.label ?? T.picks.defaults.label, callingTitle: p.callingTitle,
        verdictTag: p.verdictTag ?? T.picks.defaults.verdictTag, reason: p.reason ?? T.picks.defaults.reason, note: p.note }
    : { callingTitle: T.fallback.callingTitle };
  return build(classId, text, stats, total, max, r, undefined, raceName);
}

/**
 * Race from the rolled stats (races.mode "stats"): rules with spreadMax (highest minus lowest stat)
 * are checked first, in order, so an even roll can be a Human before any low-stat rule applies.
 * Otherwise the most specific top/second/low rule wins, ties to the earlier rule, then races.default.
 */
function raceFromStats(r: Rank): string {
  const rules = T.races.rules ?? [];
  const spread = r.top.v - r.low.v;
  const even = rules.find((x) => x.spreadMax !== undefined && spread <= x.spreadMax);
  if (even) return even.race;

  const fields = ['top', 'second', 'low'] as const;
  const ctx = { top: r.top.k, second: r.second.k, low: r.low.k };
  let best: RaceRule | undefined;
  let n = -1;
  for (const x of rules) {
    if (x.spreadMax !== undefined) continue;
    const set = fields.filter((f) => x[f]);
    if (set.length > n && set.every((f) => x[f] === ctx[f])) { best = x; n = set.length; }
  }
  return best?.race ?? T.races.default ?? T.races.rows[0].name;
}

/**
 * Selects a race. In races.mode "stats" it uses the rolled stats (pass them as the second argument);
 * otherwise, or if stats are omitted, it falls back to the kept dice total modulo the number of rows.
 */
export function determineRace(keptDice: readonly number[], stats?: CharacterStats): RaceResult {
  const fate = keptDice.reduce((a, b) => a + b, 0);
  let index = fate % T.races.rows.length;
  if (T.races.mode === 'stats' && stats) {
    const name = raceFromStats(rank(stats));
    index = Math.max(0, T.races.rows.findIndex((x) => x.name === name));
  }
  const race = T.races.rows[index];
  return { name: race.name, trait: race.trait, fate, index };
}

/** Joins a random start and end syllable for the given race (pass a seeded rng to make it repeatable). */
export function suggestName(raceName: string, rng: () => number = Math.random): string {
  const race = T.races.rows.find((x) => x.name === raceName) ?? T.races.rows[0];
  const pick = (a: string[]) => a[Math.floor(rng() * a.length)];
  return pick(race.nameStarts) + pick(race.nameEnds);
}

/** Display title for a character, per display.titleFormat in destiny.json, e.g. "Human warrior". */
export function formatTitle(classId: HeroClassId, raceName?: string): string {
  const cap = classId.charAt(0).toUpperCase() + classId.slice(1);
  return raceName ? fill(T.display.titleFormat, { race: raceName, class: classId, Class: cap }) : cap;
}

export interface Destiny extends DestinyDiagnosis { race: RaceResult; title: string }

/** One call for the calling screen: label, title (race + class), trait and reason. */
export function determineDestiny(stats: CharacterStats, keptDice: readonly number[]): Destiny {
  const race = determineRace(keptDice, stats);
  const diagnosis = determineHeroClassFromStats(stats, race.name);
  return { ...diagnosis, race, title: formatTitle(diagnosis.classId, race.name) };
}