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
  // Optional extras, safe for existing callers to ignore
  classDescription?: string;
  flavour?: string;
  personality?: { title: string; description: string };
  quirks?: string[];
  flaw?: string;
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
interface Text { label: string; callingTitle: string; verdictTag: string; reason: string }
interface Rule extends Text { id: string; class?: HeroClassId; fateTokens?: number; when: Cond | Cond[] }
interface Pick { top?: StatType; second?: StatType; low?: StatType; minTop?: number; class: HeroClassId; label?: string; callingTitle?: string; verdictTag?: string; reason?: string }
interface Override { top?: StatType; second?: StatType; low?: StatType; class?: HeroClassId; text: string }
interface Race { name: string; trait: string; nameStarts: string[]; nameEnds: string[] }
interface Tables {
  classes: Record<HeroClassId, { fateTokens: number; callingTitle?: string; description?: string; pitch: string }>;
  rules: Rule[];
  fallback: Text & { mode: 'picks' | 'candidates'; candidates: { class: HeroClassId; stats: StatType[] }[] };
  picks: { defaults: { label: string; verdictTag: string; reason: string }; rows: Pick[] };
  display: { titleFormat: string };
  races: { rows: Race[] };
  stats: Record<StatType, { name: string; highAdj: string; lowPhrase: string; lowTitle: string; quirk: string; flaw: string }>;
  personalities: { title: string; description: string }[];
  flavour: { strongMin: number; weakMax: number; overrides: Override[] };
}

const T = raw as unknown as Tables;
const STATS = Object.keys(T.stats) as StatType[]; // key order in the JSON is the tie-break order

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
  T.flavour.overrides.forEach((o, i) => {
    [o.top, o.second, o.low].forEach((s) => { if (s) stat(s, `flavour override ${i + 1}`); });
    if (o.class) cls(o.class, `flavour override ${i + 1}`);
  });
  if (!T.races.rows.length) bad('races needs at least one row');
  T.races.rows.forEach((r) => { if (!r.nameStarts.length || !r.nameEnds.length) bad(`race "${r.name}" needs nameStarts and nameEnds`); });
  if (T.personalities.length !== STATS.length + 1) {
    bad(`personalities needs ${STATS.length + 1} entries (0 to ${STATS.length} odd stats)`);
  }
}
validate();

// ---- engine ----
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m)); // unknown {tags} stay visible

function rank(s: CharacterStats) {
  const order = STATS.map((k, i) => ({ k, v: s[k], i })).sort((a, b) => b.v - a.v || a.i - b.i);
  return { order, top: order[0], second: order[1], low: order[order.length - 1],
           odd: order.filter((x) => x.v % 2).sort((a, b) => a.i - b.i) };
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

function describe(r: Rank, classId: HeroClassId) {
  const { top, second, low, odd } = r;
  const F = T.flavour;
  const weak = low.v <= F.weakMax;

  const keys = [['top', top.k], ['second', second.k], ['low', low.k], ['class', classId]] as const;
  let best: Override | undefined;
  let n = 0;
  for (const o of F.overrides) {
    const set = keys.filter(([f]) => o[f]);
    if (set.length > n && set.every(([f, val]) => o[f] === val)) { best = o; n = set.length; }
  }

  const strengths = [top, second].filter((x) => x.v >= F.strongMin).map((x) => T.stats[x.k].highAdj);
  const adj = weak ? T.stats[low.k].lowTitle : '';
  const art = /^[aeiou]/i.test(adj || classId) ? 'an' : 'a';
  const generated =
    `Your character is ${strengths.length ? strengths.join(' and ') : 'unremarkable'}` +
    `${weak ? `, but ${T.stats[low.k].lowPhrase}` : ', with no real weakness'}. ` +
    `They are ${art} ${adj ? adj + ' ' : ''}${classId}, ${T.classes[classId].pitch}.`;

  return {
    flavour: best?.text ?? generated,
    personality: T.personalities[odd.length],
    quirks: odd.slice(0, 3).map((x) => T.stats[x.k].quirk),
    flaw: weak ? T.stats[low.k].flaw : undefined,
  };
}

function build(classId: HeroClassId, text: Partial<Text>, s: CharacterStats, total: number, max: number, r: Rank, tokens?: number): DestinyDiagnosis {
  const cls = T.classes[classId];
  const fateTokens = tokens ?? cls.fateTokens;
  const v = {
    ...s, total, max, fateTokens,
    CLASS: classId.toUpperCase(), Class: classId.charAt(0).toUpperCase() + classId.slice(1),
    top: r.top.k, second: r.second.k, low: r.low.k, topValue: r.top.v, secondValue: r.second.v,
  };
  return {
    classId,
    label: fill(text.label ?? T.fallback.label, v),
    callingTitle: fill(text.callingTitle ?? cls.callingTitle ?? T.fallback.callingTitle, v),
    verdictTag: fill(text.verdictTag ?? T.fallback.verdictTag, v),
    reason: fill(text.reason ?? T.fallback.reason, v),
    fateTokenCount: fateTokens,
    classDescription: cls.description,
    ...describe(r, classId),
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
 * All rules and wording live in ../data/destiny.json.
 */
export function determineHeroClassFromStats(stats: CharacterStats): DestinyDiagnosis {
  const total = STATS.reduce((n, k) => n + stats[k], 0);
  const max = Math.max(...STATS.map((k) => stats[k]));
  const r = rank(stats);

  for (const rule of T.rules) {
    const sets = Array.isArray(rule.when) ? rule.when : [rule.when];
    if (sets.some((c) => holds(c, stats, total, max))) {
      // A rule with no class is a "tier": it supplies the label and text, and the class comes from picks.
      return build(rule.class ?? classFromPicks(r, stats).classId, rule, stats, total, max, r, rule.fateTokens);
    }
  }

  const { p, classId } = classFromPicks(r, stats);
  const text: Partial<Text> = p
    ? { label: p.label ?? T.picks.defaults.label, callingTitle: p.callingTitle,
        verdictTag: p.verdictTag ?? T.picks.defaults.verdictTag, reason: p.reason ?? T.picks.defaults.reason }
    : { callingTitle: T.fallback.callingTitle };
  return build(classId, text, stats, total, max, r);
}

/** Selects a race from the kept dice total using destiny.json row order. */
export function determineRace(keptDice: readonly number[]): RaceResult {
  const fate = keptDice.reduce((a, b) => a + b, 0);
  const index = fate % T.races.rows.length;
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

/** One call for the calling screen: label, title (race + class), reason, flavour and the rest. */
export function determineDestiny(stats: CharacterStats, keptDice: readonly number[]): Destiny {
  const diagnosis = determineHeroClassFromStats(stats);
  const race = determineRace(keptDice);
  return { ...diagnosis, race, title: formatTitle(diagnosis.classId, race.name) };
}