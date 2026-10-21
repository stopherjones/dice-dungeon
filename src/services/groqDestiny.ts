/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterStats, HeroClassId, StatType } from '../types/game';
import { Destiny, formatTitle } from '../utils/destiny';
import destinyData from '../data/destiny.json';

export const GROQ_WORKER_URL = 'https://groq-proxy.chrisjones59.workers.dev/chat/completions';
export const GROQ_MODEL = 'openai/gpt-oss-120b';

const VALID_CLASSES: HeroClassId[] = [
  'warrior',
  'paladin',
  'rogue',
  'ranger',
  'wizard',
  'cleric',
  'hero',
  'jester',
];

const VALID_RACES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Gnome',
  'Half-Orc',
  'Tiefling',
  'Dragonborn',
];

interface GroqDestinyPayload {
  race?: string;
  classId?: string;
  label?: string;
  callingTitle?: string;
  verdictTag?: string;
  reason?: string;
}

/**
 * Calls the user's Cloudflare Worker proxy running openai/gpt-oss-120b to analyze rolled stats,
 * assign a fitting Race and Class, and craft immersive narrative reasoning.
 * Returns null if the request fails, times out, or returns invalid data, allowing seamless fallback.
 */
export async function generateGroqDestiny(
  stats: CharacterStats,
  keptDice: readonly number[],
  timeoutMs = 6000
): Promise<(Destiny & { source: 'groq' }) | null> {
  const statList: StatType[] = ['STR', 'DEX', 'CON', 'INT', 'LCK'];
  const total = statList.reduce((sum, s) => sum + (stats[s] || 0), 0);
  const sorted = [...statList].sort((a, b) => stats[b] - stats[a]);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const systemPrompt = `You are the Oracle of Destiny for an old-school tabletop dungeon crawler.
You analyze an adventurer's 5 rolled attributes (rolled via 4d6 drop lowest):
- STR: Physical power, melee weapons, encumbrance
- DEX: Agility, stealth, locks, reflex, ranged attacks
- CON: Health, stamina, resilience, poison resistance
- INT: Arcane knowledge, spellcasting, lore
- LCK: Fortune, critical hits, rerolls, serendipity

Your task:
Assign the single most appropriate Race and Class based on the character's strengths, weaknesses, or comedic flaws, and craft a flavorful 2-3 sentence quote explaining their calling.

AVAILABLE RACES (Select exactly one):
- Human: Adaptable and ambitious.
- Elf: Long-lived and keen-eyed. Needs little sleep (favors high DEX or INT).
- Dwarf: Stout and stubborn. Reads stone like a book (favors high CON or STR).
- Halfling: Small, lucky and hard to rattle (favors high DEX or LCK).
- Gnome: Curious and inventive. Hums while working (favors high INT or DEX).
- Half-Orc: Fierce and enduring. Refuses to stay down (favors high STR or CON).
- Tiefling: Marked by an infernal past. Unnerves crowds (favors high INT, DEX, or LCK).
- Dragonborn: Scaled and proud. Carries ancestral fire (favors high STR or CON).

AVAILABLE CLASSES (Select exactly one, use exact lowercase classId):
- warrior: Vanguard melee master (high STR, CON).
- paladin: Holy crusader and protector (high STR, CON, or INT).
- rogue: Shadowblade infiltrator, thief (high DEX, LCK).
- ranger: Wilderness tracker and archer (high DEX, STR, or CON).
- wizard: Esoteric arcane scholar (high INT).
- cleric: Sacred dawn healer and battle-priest (balanced CON, STR, INT).
- hero: Legendary paragon (reserved for exceptional rolls across the board, total >= 65).
- jester: The Fool of Fate. Assigned when rolls are low, wildly skewed, tragic, or comedic (e.g. high DEX but 6 CON, or no stat above 14). Relies on audacity, 4 Fate Rerolls, and ridiculous luck.

OUTPUT REQUIREMENTS:
Respond ONLY with a valid JSON object with the following fields:
{
  "race": "One of the 8 valid races",
  "classId": "One of the 8 valid lowercase classIds",
  "label": "Short punchy badge title, e.g. FORTUNE'S FOOL or SHADOWBLADE",
  "callingTitle": "Full calling title, e.g. Elf Jester or Shadowblade Infiltrator",
  "verdictTag": "2-3 word archetype verdict, e.g. Acolyte of Wit or Nimble Trickster",
  "reason": "2 to 3 sentences in an engaging RPG voice explaining why their rolls, strengths, or glaring weaknesses led them to this calling. Reference specific stat numbers or totals if relevant."
}`;

  const userPrompt = `Adventurer rolled stats:
- STR: ${stats.STR}
- DEX: ${stats.DEX}
- CON: ${stats.CON}
- INT: ${stats.INT}
- LCK: ${stats.LCK}
Summary: Total ${total}, Highest: ${highest} (${stats[highest]}), Lowest: ${lowest} (${stats[lowest]}).

Determine their canonical Race, Class, and narrative calling reason.`;

  try {
    const res = await fetch(GROQ_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`Groq Proxy returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    // Clean potential markdown wrappers if model enclosed in ```json
    const cleanedJson = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed: GroqDestinyPayload = JSON.parse(cleanedJson);

    // Validate classId
    const candidateClassId = (parsed.classId || '').toLowerCase().trim() as HeroClassId;
    if (!VALID_CLASSES.includes(candidateClassId)) {
      console.warn(`Groq suggested non-canonical class: ${parsed.classId}`);
      return null;
    }

    // Validate race
    const candidateRace = (parsed.race || '').trim();
    const matchedRace = destinyData.races.rows.find(
      (r) => r.name.toLowerCase() === candidateRace.toLowerCase()
    );
    if (!matchedRace) {
      console.warn(`Groq suggested non-canonical race: ${parsed.race}`);
      return null;
    }

    const raceIndex = destinyData.races.rows.findIndex((r) => r.name === matchedRace.name);
    const keptFate = keptDice.reduce((a, b) => a + b, 0);

    // Class fate tokens follow official game rules (e.g. Jester gets 4, Rogue gets 2, etc.)
    const clsConfig = (destinyData.classes as Record<string, { fateTokens: number }>)[candidateClassId];
    const fateTokenCount = clsConfig?.fateTokens ?? 1;

    const label = parsed.label?.trim() || `${matchedRace.name} ${candidateClassId.toUpperCase()}`;
    const callingTitle = parsed.callingTitle?.trim() || formatTitle(candidateClassId, matchedRace.name);
    const verdictTag = parsed.verdictTag?.trim() || label;
    const reason = parsed.reason?.trim() || 'Fate has revealed your destiny among the dark corridors.';

    return {
      classId: candidateClassId,
      label,
      callingTitle,
      verdictTag,
      reason,
      fateTokenCount,
      race: {
        name: matchedRace.name,
        trait: matchedRace.trait,
        fate: keptFate,
        index: raceIndex >= 0 ? raceIndex : 0,
      },
      title: formatTitle(candidateClassId, matchedRace.name),
      source: 'groq',
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.warn('Groq Destiny assignment failed or timed out, activating fallback:', err);
    return null;
  }
}
