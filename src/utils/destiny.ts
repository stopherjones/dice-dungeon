/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterStats, HeroClassId } from '../types/game';

export interface DestinyDiagnosis {
  classId: HeroClassId;
  callingTitle: string;
  verdictTag: string;
  reason: string;
  fateTokenCount: number;
}

/**
 * Analyzes rolled attributes and assigns an adventurer class & loadout based on fate
 */
export function determineHeroClassFromStats(stats: CharacterStats): DestinyDiagnosis {
  const { STR, DEX, CON, INT, LCK } = stats;
  const totalScore = STR + DEX + CON + INT + LCK;

  // 1. HERO / CHAMPION: Exceptional stats across the board
  // (Total sum >= 67, or 3+ attributes at 15+)
  const highStatCount = [STR, DEX, CON, INT, LCK].filter((v) => v >= 15).length;
  if (totalScore >= 67 || highStatCount >= 3) {
    return {
      classId: 'hero',
      callingTitle: 'Paragon Champion of Destiny',
      verdictTag: 'EXCEPTIONAL TALENT ACROSS THE BOARD',
      reason: `Blessed with an extraordinary total attribute sum of ${totalScore} and high proficiency in both mind, body, and fortune. You are a legendary hero chosen for greatness!`,
      fateTokenCount: 1,
    };
  }

  // 2. JESTER / FOOL: Wholly weak or mediocre rolls
  // (Total sum <= 53, or no single attribute exceeds 12)
  const maxStat = Math.max(STR, DEX, CON, INT, LCK);
  if (totalScore <= 53 || maxStat <= 12) {
    return {
      classId: 'jester',
      callingTitle: 'The Dungeon Jester (The Fool)',
      verdictTag: 'WHOLLY WEAK ROLLS (PITY OF THE GODS)',
      reason: `With not a single attribute breaking past ${maxStat} (Total: ${totalScore}), every respectable guild shut their doors. You don the bells and motley—armed with sheer audacity, 4 Fate Rerolls, and ridiculous luck!`,
      fateTokenCount: 4,
    };
  }

  // 3. PREDOMINANTLY STRONG (STR >= 14 and dominant) -> Warrior
  if (STR >= 14 && STR >= DEX && STR >= INT && STR >= LCK) {
    return {
      classId: 'warrior',
      callingTitle: 'Veteran Warrior of the Vanguard',
      verdictTag: 'PREDOMINANT PHYSICAL MIGHT',
      reason: `Crushing physical power (${STR} Strength) and martial grit make heavy blades second nature. The front lines call your name.`,
      fateTokenCount: 1,
    };
  }

  // 4. PREDOMINANTLY INTELLECTUAL (INT >= 14 and dominant) -> Wizard
  if (INT >= 14 && INT >= STR && INT >= DEX) {
    return {
      classId: 'wizard',
      callingTitle: 'Arcane Scholar & Elementalist',
      verdictTag: 'PEAK ARCANE INTELLECT',
      reason: `With an intellectual depth of ${INT}, you manipulate the mystic weave effortlessly. Spellstaff and ancient grimoires answer your command.`,
      fateTokenCount: 1,
    };
  }

  // 5. AGILE / HUNTING / STEALTH (DEX >= 14 or LCK >= 14)
  if (DEX >= 14 || LCK >= 14) {
    // If STR and CON are also solid, Ranger fits best
    if (STR >= 12 && CON >= 12 && DEX >= 13) {
      return {
        classId: 'ranger',
        callingTitle: 'Wilderness Ranger & Tracker',
        verdictTag: 'BALANCED AGILITY & SURVIVAL',
        reason: `A deadly pairing of ${DEX} Dexterity with rugged endurance (${CON} CON) marks you as an apex wilderness scout and archer.`,
        fateTokenCount: 1,
      };
    }
    return {
      classId: 'rogue',
      callingTitle: 'Shadowblade Rogue & Infiltrator',
      verdictTag: 'HIGH AGILITY & SLEIGHT OF HAND',
      reason: `Lightning reflexes (${DEX} DEX) and sharp fortune (${LCK} Luck) grant you mastery over traps, shadows, and lethal backstabs.`,
      fateTokenCount: 2,
    };
  }

  // 6. HIGH CONSTITUTION / HOLY DEVOTION (CON >= 13)
  if (CON >= 13) {
    if (STR >= 13) {
      return {
        classId: 'paladin',
        callingTitle: 'Holy Crusader Paladin',
        verdictTag: 'DEVOUT STALWART DEFENSE',
        reason: `Blessed with iron stamina (${CON} CON) and disciplined strength (${STR} STR), you bear consecrated plate as an anointed knight.`,
        fateTokenCount: 1,
      };
    }
    return {
      classId: 'cleric',
      callingTitle: 'Cleric of the Sacred Dawn',
      verdictTag: 'SACRED RESILIENCE & RADIANCE',
      reason: `Your stalwart constitution (${CON} CON) and spiritual poise make you an unyielding conduit for holy smites and restorative prayers.`,
      fateTokenCount: 1,
    };
  }

  // 7. BALANCED TIE-BREAKER FALLBACK
  const scores: { id: HeroClassId; score: number }[] = [
    { id: 'warrior', score: STR },
    { id: 'rogue', score: DEX },
    { id: 'wizard', score: INT },
    { id: 'cleric', score: CON },
    { id: 'ranger', score: Math.round((DEX + STR) / 2) },
  ];
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  return {
    classId: best.id,
    callingTitle: `${best.id.toUpperCase()} CALLING`,
    verdictTag: 'BALANCED ADVENTURER',
    reason: `${best.id.charAt(0).toUpperCase()}${best.id.slice(1)} by fate.`,
    fateTokenCount: best.id === 'rogue' ? 2 : 1,
  };
}
