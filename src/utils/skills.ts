/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HeroSkill } from '../types/game';

export interface SkillUpgradeInfo {
  skillId: string;
  name: string;
  icon: string;
  rank: number;
  oldFormula?: string;
  newFormula?: string;
  upgradeSummary: string;
}

/**
 * Returns the upgraded skills configuration for a class at a given hero level
 */
export function getHeroSkillsForLevel(classId: string, level: number): HeroSkill[] {
  const lvl = Math.max(1, level);

  switch (classId) {
    case 'warrior':
      return [
        {
          id: 'cleave',
          name: 'Mighty Cleave',
          description: `Pour raw fury into a devastating strike (Rolls Weapon Damage + STR + ${lvl === 1 ? '1d8' : lvl === 2 ? '1d10' : lvl === 3 ? '2d8' : lvl === 4 ? '2d10' : '3d8'} bonus).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 2,
          type: 'attack',
          diceFormula: lvl === 1 ? '1d8+STR' : lvl === 2 ? '1d10+STR' : lvl === 3 ? '2d8+STR' : lvl === 4 ? '2d10+STR' : '3d8+STR',
          icon: 'Sword',
          level: lvl,
        },
        {
          id: 'shield_wall',
          name: 'Iron Guard',
          description: `Raise defense, gaining +${3 + lvl} AC and reducing all incoming damage by ${2 + lvl} for 2 turns.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'Shield',
          level: lvl,
        },
        {
          id: 'second_wind',
          name: 'Second Wind',
          description: `Draw upon inner reserves to instantly restore ${lvl === 1 ? '1d10+CON' : lvl === 2 ? '2d8+CON' : lvl === 3 ? '2d10+CON' : lvl === 4 ? '3d8+CON' : '3d10+CON'} Hit Points.`,
          manaCost: 4,
          energyCost: 4,
          cooldownTurns: 4,
          type: 'heal',
          diceFormula: lvl === 1 ? '1d10+CON' : lvl === 2 ? '2d8+CON' : lvl === 3 ? '2d10+CON' : lvl === 4 ? '3d8+CON' : '3d10+CON',
          icon: 'Heart',
          level: lvl,
        },
      ];

    case 'rogue':
      return [
        {
          id: 'sneak_attack',
          name: 'Backstab / Sneak Attack',
          description: `Strike vulnerable points with deadly precision (Rolls ${1 + lvl}d6+DEX bonus damage; double crit chance).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 2,
          type: 'attack',
          diceFormula: `${1 + lvl}d6+DEX`,
          icon: 'Target',
          level: lvl,
        },
        {
          id: 'smoke_bomb',
          name: 'Shadow Evasion',
          description: `Vanish into smoke, granting ${Math.min(95, 70 + lvl * 5)}% dodge chance against enemy attacks.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'Wind',
          level: lvl,
        },
        {
          id: 'poison_blade',
          name: 'Venom Coating',
          description: `Coat blade in deadly viper venom, dealing +${2 + lvl * 2} toxic damage per strike for 3 turns.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'FlaskRound',
          level: lvl,
        },
      ];

    case 'wizard':
      return [
        {
          id: 'magic_missile',
          name: 'Arcane Missiles',
          description: `Conjure ${2 + lvl} unerring darts of glowing magical force (Rolls ${2 + lvl}d4+INT damage, never misses).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 0,
          type: 'attack',
          diceFormula: `${2 + lvl}d4+INT`,
          icon: 'Sparkles',
          level: lvl,
        },
        {
          id: 'pyroblast',
          name: 'Flame Blast',
          description: `Hurl a roaring sphere of fire that scorches the enemy (Rolls ${1 + lvl}d8+INT fire damage).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 2,
          type: 'attack',
          diceFormula: `${1 + lvl}d8+INT`,
          icon: 'Flame',
          level: lvl,
        },
        {
          id: 'mana_shield',
          name: 'Arcane Barrier',
          description: `Surround yourself in a shimmering ward that absorbs up to ${12 + lvl * 8} damage.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'Shield',
          level: lvl,
        },
      ];

    case 'cleric':
      return [
        {
          id: 'smite',
          name: 'Radiant Smite',
          description: `Infuse weapon with blinding solar radiance (Rolls ${lvl === 1 ? '1d8+STR' : lvl === 2 ? '2d8+STR' : lvl === 3 ? '2d10+STR' : lvl === 4 ? '3d8+STR' : '3d10+STR'} + Holy damage).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 1,
          type: 'attack',
          diceFormula: lvl === 1 ? '1d8+STR' : lvl === 2 ? '2d8+STR' : lvl === 3 ? '2d10+STR' : lvl === 4 ? '3d8+STR' : '3d10+STR',
          icon: 'Sun',
          level: lvl,
        },
        {
          id: 'heal_prayer',
          name: 'Healing Light',
          description: `Invoke divine grace to restore ${1 + lvl}d8+CON Hit Points.`,
          manaCost: 4,
          energyCost: 4,
          cooldownTurns: 2,
          type: 'heal',
          diceFormula: `${1 + lvl}d8+CON`,
          icon: 'Heart',
          level: lvl,
        },
        {
          id: 'holy_blessing',
          name: 'Divine Favor',
          description: `Bless yourself, gaining +${2 + lvl} to all attack rolls and saving throws for 3 turns.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'Sparkles',
          level: lvl,
        },
      ];

    case 'paladin':
      return [
        {
          id: 'holy_strike',
          name: 'Crusader Strike',
          description: `A disciplined sword blow glowing with divine fury (Rolls ${lvl === 1 ? '1d10+STR' : lvl === 2 ? '2d8+STR' : lvl === 3 ? '2d10+STR' : lvl === 4 ? '3d8+STR' : '3d10+STR'} damage).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 1,
          type: 'attack',
          diceFormula: lvl === 1 ? '1d10+STR' : lvl === 2 ? '2d8+STR' : lvl === 3 ? '2d10+STR' : lvl === 4 ? '3d8+STR' : '3d10+STR',
          icon: 'Sword',
          level: lvl,
        },
        {
          id: 'lay_on_hands',
          name: 'Lay on Hands',
          description: `Channel sacred vitality to restore ${10 + lvl * 5} Hit Points.`,
          manaCost: 4,
          energyCost: 4,
          cooldownTurns: 3,
          type: 'heal',
          diceFormula: `${10 + lvl * 5}`,
          icon: 'Heart',
          level: lvl,
        },
        {
          id: 'bulwark',
          name: 'Aura of Protection',
          description: `Radiate a protective barrier reducing all incoming monster damage by ${4 + (lvl - 1) * 2} for 3 turns.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'ShieldCheck',
          level: lvl,
        },
      ];

    case 'ranger':
      return [
        {
          id: 'aimed_shot',
          name: 'Sniper Shot',
          description: `Target the creature's vital organs (Rolls ${lvl === 1 ? '1d10+DEX' : lvl === 2 ? '2d8+DEX' : lvl === 3 ? '2d10+DEX' : lvl === 4 ? '3d8+DEX' : '3d10+DEX'} damage).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 1,
          type: 'attack',
          diceFormula: lvl === 1 ? '1d10+DEX' : lvl === 2 ? '2d8+DEX' : lvl === 3 ? '2d10+DEX' : lvl === 4 ? '3d8+DEX' : '3d10+DEX',
          icon: 'Target',
          level: lvl,
        },
        {
          id: 'multishot',
          name: 'Volley of Arrows',
          description: `Loose a rapid barrage of piercing arrows (Rolls ${2 + lvl}d6+DEX damage).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 2,
          type: 'attack',
          diceFormula: `${2 + lvl}d6+DEX`,
          icon: 'Flame',
          level: lvl,
        },
        {
          id: 'survival_instinct',
          name: "Hunter's Focus",
          description: `Sharpen senses, increasing critical strike chance by +${10 + lvl * 5}% and defense (+${3 + lvl} AC) for 3 turns.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'Zap',
          level: lvl,
        },
      ];

    case 'hero':
      return [
        {
          id: 'valiant_strike',
          name: 'Valiant Strike',
          description: `Devastating martial sword blow empowered by heroics (Rolls ${lvl === 1 ? '1d10+STR' : lvl === 2 ? '2d8+STR' : lvl === 3 ? '2d10+STR' : lvl === 4 ? '3d8+STR' : '3d10+STR'} damage).`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 1,
          type: 'attack',
          diceFormula: lvl === 1 ? '1d10+STR' : lvl === 2 ? '2d8+STR' : lvl === 3 ? '2d10+STR' : lvl === 4 ? '3d8+STR' : '3d10+STR',
          icon: 'Sword',
          level: lvl,
        },
        {
          id: 'heroic_resolve',
          name: 'Heroic Resolve',
          description: `Steel heart and divine will, granting +${3 + lvl} AC and recovering ${lvl === 1 ? '1d8+CON' : lvl === 2 ? '2d6+CON' : lvl === 3 ? '2d8+CON' : '3d8+CON'} Hit Points.`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 3,
          type: 'heal',
          diceFormula: lvl === 1 ? '1d8+CON' : lvl === 2 ? '2d6+CON' : lvl === 3 ? '2d8+CON' : '3d8+CON',
          icon: 'Heart',
          level: lvl,
        },
        {
          id: 'inspiring_rally',
          name: 'Rallying Cry',
          description: `Sound a heroic war cry, granting +${2 + lvl} Attack Bonus and boosting critical chance for 3 turns.`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'Crown',
          level: lvl,
        },
      ];

    case 'jester':
      return [
        {
          id: 'mocking_rhyme',
          name: 'Mocking Rhyme',
          description: `Spew scathing satirical limericks that damage enemy morale (Rolls ${lvl === 1 ? '1d6+LCK' : lvl === 2 ? '1d8+LCK' : lvl === 3 ? '2d6+LCK' : '2d8+LCK'} damage).`,
          manaCost: 4,
          energyCost: 4,
          cooldownTurns: 1,
          type: 'attack',
          diceFormula: lvl === 1 ? '1d6+LCK' : lvl === 2 ? '1d8+LCK' : lvl === 3 ? '2d6+LCK' : '2d8+LCK',
          icon: 'Sparkles',
          level: lvl,
        },
        {
          id: 'pratfall',
          name: 'Tumble & Pratfall',
          description: `Clumsily slip on an invisible peel, dodging blows (${Math.min(95, 75 + lvl * 5)}% Evasion) and gaining +${2 + lvl} Luck for 2 turns.`,
          manaCost: 5,
          energyCost: 5,
          cooldownTurns: 3,
          type: 'buff',
          icon: 'Footprints',
          level: lvl,
        },
        {
          id: 'dumb_luck',
          name: 'Dumb Luck Strike',
          description: `Blindly swing your bells into the fray (Rolls unpredictable 1d20+${lvl - 1} chaotic damage!).`,
          manaCost: 6,
          energyCost: 6,
          cooldownTurns: 2,
          type: 'attack',
          diceFormula: lvl === 1 ? '1d20' : `1d20+${lvl - 1}`,
          icon: 'Dices',
          level: lvl,
        },
      ];

    default:
      return [];
  }
}

/**
 * Compares skills between currentLevel and newLevel to display upgrade highlights
 */
export function getSkillUpgradeList(classId: string, fromLevel: number, toLevel: number): SkillUpgradeInfo[] {
  const oldSkills = getHeroSkillsForLevel(classId, fromLevel);
  const newSkills = getHeroSkillsForLevel(classId, toLevel);

  return newSkills.map((newSkill, idx) => {
    const oldSkill = oldSkills[idx] || newSkill;
    let upgradeSummary = '';

    if (newSkill.type === 'attack') {
      upgradeSummary = `${oldSkill.diceFormula || 'Base'} ➔ ${newSkill.diceFormula} Damage`;
    } else if (newSkill.type === 'heal') {
      if (newSkill.id === 'lay_on_hands') {
        upgradeSummary = `${10 + fromLevel * 5} HP ➔ ${10 + toLevel * 5} HP Restored`;
      } else {
        upgradeSummary = `${oldSkill.diceFormula} ➔ ${newSkill.diceFormula} Healing`;
      }
    } else if (newSkill.type === 'buff') {
      if (newSkill.id === 'bulwark') {
        upgradeSummary = `-${4 + (fromLevel - 1) * 2} Dmg ➔ -${4 + (toLevel - 1) * 2} Dmg Reduction`;
      } else if (newSkill.id === 'shield_wall') {
        upgradeSummary = `+${3 + fromLevel} AC / -${2 + fromLevel} Dmg ➔ +${3 + toLevel} AC / -${2 + toLevel} Dmg`;
      } else if (newSkill.id === 'mana_shield') {
        upgradeSummary = `${12 + fromLevel * 8} HP ➔ ${12 + toLevel * 8} HP Barrier Absorption`;
      } else if (newSkill.id === 'holy_blessing') {
        upgradeSummary = `+${2 + fromLevel} Atk ➔ +${2 + toLevel} Attack Bonus`;
      } else if (newSkill.id === 'smoke_bomb') {
        upgradeSummary = `${Math.min(95, 70 + fromLevel * 5)}% ➔ ${Math.min(95, 70 + toLevel * 5)}% Evasion`;
      } else if (newSkill.id === 'poison_blade') {
        upgradeSummary = `+${2 + fromLevel * 2} ➔ +${2 + toLevel * 2} Toxic Damage`;
      } else if (newSkill.id === 'survival_instinct') {
        upgradeSummary = `+${10 + fromLevel * 5}% Crit ➔ +${10 + toLevel * 5}% Crit Chance`;
      } else {
        upgradeSummary = `Enhanced Potency (Rank ${toLevel})`;
      }
    }

    return {
      skillId: newSkill.id,
      name: newSkill.name,
      icon: newSkill.icon || 'Sparkles',
      rank: toLevel,
      oldFormula: oldSkill.diceFormula,
      newFormula: newSkill.diceFormula,
      upgradeSummary,
    };
  });
}
