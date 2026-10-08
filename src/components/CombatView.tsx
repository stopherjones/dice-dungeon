/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Skull,
  Shield,
  Sword,
  Sparkles,
  Heart,
  Wand2,
  Dices,
  Flame,
  ArrowRight,
  RefreshCw,
  Zap,
  Package,
  Award,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Footprints,
  Check,
  Trophy,
  Wind,
} from 'lucide-react';
import {
  CombatLogEntry,
  CombatState,
  GameItem,
  HeroCharacter,
  HeroSkill,
  Monster,
  StatType,
  StatusEffect,
} from '../types/game';
import { ITEMS_DATABASE } from '../data/items';
import { getWeaponAcReduction, canHeroUseItem } from '../utils/inventory';
import { DiceVisualizer } from './DiceVisualizer';
import { rollDice, getStatModifier, parseAndRollFormula, RollResult } from '../utils/dice';
import { sounds } from '../utils/audio';

interface CombatViewProps {
  hero: HeroCharacter;
  combat: CombatState;
  onUpdateHero: (hero: HeroCharacter) => void;
  onUpdateCombat: (combat: CombatState | null) => void;
  onCombatVictory: (monster: Monster, reward: { xp: number; gold: number; items: GameItem[] }) => void;
  onCombatFlee: () => void;
}

type CombatStep =
  | 'HERO_CHOICE'
  | 'HERO_ATTACK_ROLLING'
  | 'HERO_ATTACK_RESULT'
  | 'HERO_DAMAGE_ROLLING'
  | 'HERO_DAMAGE_RESULT'
  | 'HERO_NON_DAMAGE_RESULT'
  | 'ENEMY_ROLLING'
  | 'ENEMY_RESULT'
  | 'FLEE_RESULT'
  | 'VICTORY_SCREEN';

export const CombatView: React.FC<CombatViewProps> = ({
  hero,
  combat,
  onUpdateHero,
  onUpdateCombat,
  onCombatVictory,
  onCombatFlee,
}) => {
  const [combatStep, setCombatStep] = useState<CombatStep>('HERO_CHOICE');
  const [currentRoll, setCurrentRoll] = useState<RollResult | null>(null);
  const [damageRoll, setDamageRoll] = useState<RollResult | null>(null);
  const [pendingAttack, setPendingAttack] = useState<{
    type: 'weapon' | 'spell';
    name: string;
    atkRoll: RollResult;
    isHit: boolean;
    isCrit: boolean;
    isFumble: boolean;
    damageFormula: string;
    damageBonus: number;
    skill?: HeroSkill;
  } | null>(null);

  const [actionSummary, setActionSummary] = useState<{
    title: string;
    details: string;
    damage?: number;
    isHit?: boolean;
    isCrit?: boolean;
    isFumble?: boolean;
    type: 'hero' | 'monster' | 'flee';
  } | null>(null);

  const actionZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure viewport / container focus returns to the top on every combat step, roll result, and turn transition
    if (actionZoneRef.current) {
      const scrollParent = actionZoneRef.current.closest('.overflow-y-auto');
      if (scrollParent) {
        scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [
    combatStep,
    combat.turnNumber,
    combat.isHeroTurn,
    combat.monster.hp,
    hero.currentHp,
    actionSummary,
  ]);

  const monster = combat.monster;
  const monsterHpPercent = Math.max(0, Math.min(100, (monster.hp / monster.maxHp) * 100));
  const heroHpPercent = Math.max(0, Math.min(100, (hero.currentHp / hero.maxHp) * 100));

  // Active hero stats including gear
  const heroStats = { ...hero.stats };
  let heroAc = 10 + getStatModifier(heroStats.DEX);
  (Object.values(hero.equipment) as (GameItem | undefined)[]).forEach((item) => {
    if (!item) return;
    if (item.armorBonus) heroAc += item.armorBonus;
    if (item.statBonuses) {
      if (item.statBonuses.STR) heroStats.STR += item.statBonuses.STR;
      if (item.statBonuses.DEX) heroStats.DEX += item.statBonuses.DEX;
      if (item.statBonuses.CON) heroStats.CON += item.statBonuses.CON;
      if (item.statBonuses.INT) heroStats.INT += item.statBonuses.INT;
      if (item.statBonuses.LCK) heroStats.LCK += item.statBonuses.LCK;
    }
  });

  // Include active status effects / buffs in hero AC (e.g. Iron Guard +4 AC, Hunter's Focus +4 AC)
  if (hero.activeEffects && hero.activeEffects.length > 0) {
    hero.activeEffects.forEach((eff) => {
      if (eff.armorModifier) heroAc += eff.armorModifier;
    });
  }

  if (combat.heroDefending || combat.heroCatchingBreath) {
    heroAc += 4; // Block stance / Catch Breath guard
  }

  // Active attack modifier from buffs (e.g. +3 Divine Favor)
  const buffAttackBonus = (hero.activeEffects || []).reduce((sum, eff) => sum + (eff.attackModifier || 0), 0);
  const buffCritBonus = (hero.activeEffects || []).reduce((sum, eff) => sum + (eff.critModifier || 0), 0);

  const strMod = getStatModifier(heroStats.STR);
  const dexMod = getStatModifier(heroStats.DEX);
  const conMod = getStatModifier(heroStats.CON);
  const intMod = getStatModifier(heroStats.INT);
  const lckMod = getStatModifier(heroStats.LCK);
  
  const fleeStatKey: StatType = dexMod >= lckMod ? 'DEX' : 'LCK';
  const fleeMod = Math.max(dexMod, lckMod);

  const primaryWeapon = hero.equipment.weapon;
  const isFinesseOrRanged = Boolean(
    primaryWeapon &&
      (primaryWeapon.name.toLowerCase().includes('bow') ||
        primaryWeapon.name.toLowerCase().includes('dagger') ||
        primaryWeapon.name.toLowerCase().includes('stiletto') ||
        primaryWeapon.name.toLowerCase().includes('rapier') ||
        primaryWeapon.name.toLowerCase().includes('dart') ||
        primaryWeapon.name.toLowerCase().includes('sling') ||
        primaryWeapon.name.toLowerCase().includes('crossbow'))
  );
  const weaponStatKey: StatType = isFinesseOrRanged && dexMod >= strMod ? 'DEX' : 'STR';
  const weaponStatMod = weaponStatKey === 'DEX' ? dexMod : strMod;
  const weaponItemBonus = primaryWeapon?.bonusDamage || 0;
  const weaponFormula = primaryWeapon?.damageDice || '1d4';
  const weaponBonus = weaponItemBonus + weaponStatMod;
  const totalWeaponAtkMod = weaponStatMod + weaponItemBonus + buffAttackBonus;
  const weaponStatBreakdown = `${weaponStatMod >= 0 ? `+${weaponStatMod}` : weaponStatMod} ${weaponStatKey}${weaponItemBonus ? ` +${weaponItemBonus} Wpn` : ''}${buffAttackBonus ? ` +${buffAttackBonus} Buff` : ''}`;
  const weaponAcReduction = primaryWeapon ? getWeaponAcReduction(primaryWeapon, hero.level) : 0;
  const effectiveMonsterAc = Math.max(1, monster.armorClass - weaponAcReduction);
  const acReductionBreakdown = weaponAcReduction > 0 ? ` (Base AC ${monster.armorClass} - ${weaponAcReduction} Sunder)` : '';

  // Dynamic Defensive Guard & Counter-Attack Profile based on Hero Class & Equipment
  const getGuardProfile = () => {
    const hasShield = Boolean(hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus);
    const shieldName = hero.equipment.shield?.name || hero.equipment.offhand?.name || 'Shield';
    const weaponName = primaryWeapon?.name || 'Weapon';
    const weaponDice = primaryWeapon?.damageDice || '1d8';
    const shieldAbsorb = 3 + (hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus || 0);

    switch (hero.classId) {
      case 'warrior':
        return {
          actionName: hasShield ? 'Shield Guard & Riposte' : 'Iron Guard & Counter-Strike',
          actionSubtitle: `+4 AC, Absorbs ${shieldAbsorb} Dmg & Ripostes`,
          counterName: hasShield ? 'Shield Bash Riposte' : 'Heavy Blade Riposte',
          counterDescription: hasShield
            ? `Absorb the blow with ${shieldName} and execute a retaliatory ${weaponName} riposte strike!`
            : `Parry the attack with ${weaponName} and deliver a crushing counter-strike!`,
          counterFormula: weaponDice,
          counterBonus: strMod + weaponItemBonus,
          counterStatKey: 'STR' as StatType,
          sound: 'hit' as const,
        };
      case 'rogue':
        return {
          actionName: 'Shadow Parry & Riposte',
          actionSubtitle: `+4 AC, Absorbs 3 Dmg & Finesse Riposte`,
          counterName: 'Shadowfang Riposte',
          counterDescription: `Sidestep the enemy blow and plunge ${weaponName} into exposed vitals with lethal precision!`,
          counterFormula: primaryWeapon?.damageDice || '1d6',
          counterBonus: dexMod + weaponItemBonus,
          counterStatKey: 'DEX' as StatType,
          sound: 'hit' as const,
        };
      case 'wizard':
        return {
          actionName: 'Arcane Ward & Shockwave',
          actionSubtitle: `+4 AC, Absorbs 3 Dmg & Kinetic Burst`,
          counterName: 'Arcane Ward Shockwave',
          counterDescription: `Runic barrier deflects the strike and unleashes a retaliatory burst of raw arcane kinetic force!`,
          counterFormula: '1d6',
          counterBonus: intMod,
          counterStatKey: 'INT' as StatType,
          sound: 'fire' as const,
        };
      case 'cleric':
        return {
          actionName: 'Sacred Bulwark & Retribution',
          actionSubtitle: `+4 AC, Absorbs ${shieldAbsorb} Dmg & Divine Retribution`,
          counterName: 'Radiant Retribution Strike',
          counterDescription: `Consecrated bulwark rebounds holy fire upon the attacker and counters with ${weaponName}!`,
          counterFormula: weaponDice,
          counterBonus: Math.max(conMod, strMod) + weaponItemBonus,
          counterStatKey: (conMod >= strMod ? 'CON' : 'STR') as StatType,
          sound: 'fire' as const,
        };
      case 'paladin':
        return {
          actionName: 'Righteous Bastion & Sunblade Riposte',
          actionSubtitle: `+4 AC, Absorbs ${shieldAbsorb} Dmg & Consecrated Riposte`,
          counterName: 'Sunblade Retaliation Riposte',
          counterDescription: `Lock shields against the blow and cleave the enemy with consecrated sunblade fury!`,
          counterFormula: weaponDice,
          counterBonus: strMod + weaponItemBonus,
          counterStatKey: 'STR' as StatType,
          sound: 'hit' as const,
        };
      case 'ranger':
      default:
        return {
          actionName: 'Skirmish Deflection & Snap Shot',
          actionSubtitle: `+4 AC, Absorbs 3 Dmg & Point-Blank Shot`,
          counterName: 'Point-Blank Snap Counter',
          counterDescription: `Deflect incoming attack and instantly loose a point-blank retaliatory strike!`,
          counterFormula: weaponDice,
          counterBonus: dexMod + weaponItemBonus,
          counterStatKey: 'DEX' as StatType,
          sound: 'hit' as const,
        };
    }
  };

  const guardProfile = getGuardProfile();

  // Helper to compute deep breakdown for any skill
  const getSkillDetails = (skill: HeroSkill) => {
    let statKey: StatType = 'STR';
    if (skill.diceFormula?.includes('STR')) statKey = 'STR';
    else if (skill.diceFormula?.includes('DEX')) statKey = 'DEX';
    else if (skill.diceFormula?.includes('INT')) statKey = 'INT';
    else if (skill.diceFormula?.includes('CON')) statKey = 'CON';
    else if (skill.diceFormula?.includes('LCK')) statKey = 'LCK';
    else if (['aimed_shot', 'multishot', 'sneak_attack', 'smoke_bomb', 'poison_blade', 'survival_instinct'].includes(skill.id)) statKey = 'DEX';
    else if (['cleave', 'smite', 'holy_strike', 'shield_wall', 'bulwark', 'holy_blessing'].includes(skill.id)) statKey = 'STR';
    else if (['magic_missile', 'pyroblast', 'mana_shield'].includes(skill.id)) statKey = 'INT';
    else if (['heal_prayer', 'second_wind', 'lay_on_hands'].includes(skill.id)) statKey = 'CON';
    else if (hero.classId === 'wizard') statKey = 'INT';
    else if (hero.classId === 'ranger' || hero.classId === 'rogue') statKey = 'DEX';
    else if (hero.classId === 'cleric') statKey = 'CON';

    const statMod = getStatModifier(heroStats[statKey]);

    let extraAccuracy = 0;
    let extraAccuracyLabel = '';
    let isAutoHit = false;

    if (skill.id === 'aimed_shot') {
      extraAccuracy = 2;
      extraAccuracyLabel = '+2 Aim';
    } else if (skill.id === 'sneak_attack') {
      extraAccuracy = 1;
      extraAccuracyLabel = '+1 Stealth';
    } else if (skill.id === 'magic_missile') {
      isAutoHit = true;
    }

    const totalAtkMod = statMod + extraAccuracy + buffAttackBonus;

    // Parse base dice from formula
    const match = skill.diceFormula?.match(/^(\d+d\d+)/i);
    const baseDice = match ? match[1] : (skill.diceFormula || '1d8');

    let damageBonus = statMod;
    let damageBreakdown = `${statMod >= 0 ? `+${statMod}` : statMod} ${statKey}`;

    if (skill.id === 'cleave' || skill.id === 'holy_strike') {
      damageBonus = statMod + weaponItemBonus;
      damageBreakdown = `${statMod >= 0 ? `+${statMod}` : statMod} ${statKey}${weaponItemBonus ? ` +${weaponItemBonus} Wpn` : ''}`;
    } else if (skill.id === 'smite') {
      damageBonus = statMod + weaponItemBonus;
      damageBreakdown = `${statMod >= 0 ? `+${statMod}` : statMod} ${statKey}${weaponItemBonus ? ` +${weaponItemBonus} Wpn` : ''} +1d6 Holy`;
    }

    let rollSubtitle = '';
    let boxLabel = 'Damage';
    let boxText = '';

    if (skill.type === 'heal') {
      boxLabel = 'Healing';
      if (skill.id === 'lay_on_hands') {
        rollSubtitle = `Heals Flat +15 HP (Sacred Vitality) • Target Self`;
        boxText = `Flat +15 HP • Restores Hit Points (Max ${hero.maxHp} HP)`;
      } else {
        rollSubtitle = `Heals: ${baseDice} ${statMod >= 0 ? `+ ${statMod}` : statMod} (${statMod >= 0 ? `+${statMod}` : statMod} ${statKey}) • Target Self`;
        boxText = `${baseDice} ${statMod >= 0 ? `+ ${statMod}` : statMod} (${statMod >= 0 ? `+${statMod}` : statMod} ${statKey}) • Restores Hit Points (Max ${hero.maxHp} HP)`;
      }
    } else if (skill.type === 'buff') {
      boxLabel = 'Effect';
      if (skill.id === 'survival_instinct') {
        rollSubtitle = `Defensive Ward (+4 AC & +15% Crit)`;
        boxText = `+4 AC & +15% Critical Strike Chance for 3 turns • Sharpens senses`;
      } else if (skill.id === 'shield_wall') {
        rollSubtitle = `Defensive Ward (+4 AC & 3 Dmg Absorb)`;
        boxText = `+4 AC & absorbs 3 incoming monster damage for 2 turns • Iron guard`;
      } else if (skill.id === 'smoke_bomb') {
        rollSubtitle = `Smoke Screen (+75% Evasion Chance)`;
        boxText = `75% Dodge evasion chance against monster's next attack • Tactical smoke`;
      } else if (skill.id === 'poison_blade') {
        rollSubtitle = `Viper Venom (+1d6 Poison DoT)`;
        boxText = `Weapon attacks coat foe in venom dealing 1d6 poison damage per turn`;
      } else if (skill.id === 'mana_shield') {
        rollSubtitle = `Mana Barrier (Absorbs 20 Dmg)`;
        boxText = `Mystic barrier absorbs up to 20 incoming damage before depleting`;
      } else if (skill.id === 'holy_blessing') {
        rollSubtitle = `Divine Favor (+3 Atk & Saves)`;
        boxText = `+3 bonus to all d20 attack rolls and saving throws for 3 turns`;
      } else if (skill.id === 'bulwark') {
        rollSubtitle = `Aura Barrier (-4 All Incoming Dmg)`;
        boxText = `Radiates holy aura reducing all incoming damage by 4 for 3 turns`;
      } else {
        rollSubtitle = `Defensive Ward (+4 AC)`;
        boxText = skill.description;
      }
    } else {
      boxLabel = 'Damage';
      if (isAutoHit) {
        rollSubtitle = `Guaranteed Hit (${statMod >= 0 ? `+${statMod}` : statMod} ${statKey} Force) vs AC ${effectiveMonsterAc}${acReductionBreakdown}`;
      } else {
        const modBreakdown = `${statMod >= 0 ? `+${statMod}` : statMod} ${statKey}${extraAccuracyLabel ? ` ${extraAccuracyLabel}` : ''}`;
        rollSubtitle = `Roll: 1d20 ${totalAtkMod >= 0 ? `+ ${totalAtkMod}` : totalAtkMod} (${modBreakdown}) vs AC ${effectiveMonsterAc}${acReductionBreakdown}`;
      }

      let flavor = 'Special Attack';
      if (skill.id === 'aimed_shot') flavor = 'Precision Vital Strike';
      else if (skill.id === 'multishot') flavor = '3x Rapid Arrow Barrage';
      else if (skill.id === 'sneak_attack') flavor = 'Double Crit Threat Strike';
      else if (skill.id === 'magic_missile') flavor = 'Unerring Force (Never Misses)';
      else if (skill.id === 'pyroblast') flavor = 'Roaring Fire Blast';
      else if (skill.id === 'cleave') flavor = 'Sweeping Heavy Cleave';
      else if (skill.id === 'smite') flavor = 'Radiant Solar Smite';
      else if (skill.id === 'holy_strike') flavor = 'Disciplined Crusader Blow';

      boxText = `${baseDice} ${damageBonus >= 0 ? `+ ${damageBonus}` : damageBonus} (${damageBreakdown}) • ${flavor}`;
    }

    return {
      statKey,
      statMod,
      extraAccuracy,
      extraAccuracyLabel,
      totalAtkMod,
      isAutoHit,
      baseDice,
      damageBonus,
      damageBreakdown,
      rollSubtitle,
      boxLabel,
      boxText,
    };
  };

  // Helper to add combat log
  const addLog = (
    sender: 'hero' | 'monster' | 'system',
    actionName: string,
    message: string,
    rollDetails?: CombatLogEntry['rollDetails'],
    damageDealt?: number
  ) => {
    const entry: CombatLogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      turn: combat.turnNumber,
      sender,
      actionName,
      message,
      rollDetails,
      damageDealt,
    };
    combat.combatLogs = [entry, ...combat.combatLogs];
  };

  // 1. HERO INITIATES WEAPON ATTACK (Costs 2 Energy)
  const handleHeroAttack = () => {
    if (combatStep !== 'HERO_CHOICE' || monster.hp <= 0 || hero.currentMana < 2) return;
    hero.currentMana -= 2;
    onUpdateHero({ ...hero });
    setCombatStep('HERO_ATTACK_ROLLING');
    sounds.playDiceRoll();

    const staggerBonus = combat.monsterStumbled ? 2 : 0;
    if (combat.monsterStumbled) {
      combat.monsterStumbled = false;
      onUpdateCombat({ ...combat });
    }

    const atkRoll = rollDice(1, 20, totalWeaponAtkMod + staggerBonus);
    setCurrentRoll(atkRoll);

    setTimeout(() => {
      const isHit = atkRoll.isCrit || (!atkRoll.isFumble && atkRoll.total >= effectiveMonsterAc);
      
      if (atkRoll.isFumble) {
        combat.heroStumbled = true;
        onUpdateCombat({ ...combat });
      }

      setPendingAttack({
        type: 'weapon',
        name: primaryWeapon?.name || 'Unarmed Strike',
        atkRoll,
        isHit,
        isCrit: atkRoll.isCrit,
        isFumble: atkRoll.isFumble,
        damageFormula: weaponFormula,
        damageBonus: weaponBonus,
      });

      if (!isHit) {
        sounds.playBlock();
        setActionSummary({
          title: atkRoll.isFumble ? 'CRITICAL FUMBLE! (Natural 1)' : 'ATTACK MISSED',
          details: atkRoll.isFumble
            ? `Attack Roll: [1] (Natural 1 Fumble!) ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}${staggerBonus ? ' +2 Staggered' : ''}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n💥 STUMBLED & VULNERABLE: You overextended and lost your balance! You FORFEIT your next combat turn while recovering your stance, giving ${monster.name} a free round to strike!`
            : `Attack Roll: [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}${staggerBonus ? ' +2 Staggered' : ''}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}. The blow failed to penetrate!`,
          isHit: false,
          isFumble: atkRoll.isFumble,
          type: 'hero',
        });
        addLog(
          'hero',
          atkRoll.isFumble ? `Attack Fumble (Natural 1)` : `Attack with ${primaryWeapon?.name || 'Weapon'} (Miss)`,
          atkRoll.isFumble
            ? `Rolled Natural 1! Critical Fumble — Hero is stumbled and forfeits next turn!`
            : `Rolled [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}. Missed!`,
          {
            diceType: 'd20',
            rolls: atkRoll.individualRolls,
            modifier: atkRoll.modifier,
            total: atkRoll.total,
            targetValue: effectiveMonsterAc,
            isFumble: atkRoll.isFumble,
          }
        );
      } else {
        sounds.playHit();
        setActionSummary({
          title: atkRoll.isCrit ? 'CRITICAL HIT! (Natural 20)' : 'ATTACK HIT!',
          details: atkRoll.isCrit
            ? `Attack Roll: [20] (Natural 20 Critical!) ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}${staggerBonus ? ' +2 Staggered' : ''}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n⚔️ CRITICAL STRIKE: Maximum penetration! Your upcoming damage roll will be DOUBLED (2x Damage Multiplier + 3 Brutal Strike Bonus)!`
            : `Attack Roll: [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}${staggerBonus ? ' +2 Staggered' : ''}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}. Strike connected! Proceed to roll damage dice.`,
          isHit: true,
          isCrit: atkRoll.isCrit,
          type: 'hero',
        });
      }

      setCombatStep('HERO_ATTACK_RESULT');
    }, 600);
  };

  // 2. HERO EXECUTES DAMAGE ROLL (Step 2: Roll Damage dice after confirming Hit)
  const handleHeroRollDamage = () => {
    if (!pendingAttack || combatStep !== 'HERO_ATTACK_RESULT' || !pendingAttack.isHit) return;
    setCombatStep('HERO_DAMAGE_ROLLING');
    sounds.playDiceRoll();

    setTimeout(() => {
      const dmgRes = parseAndRollFormula(pendingAttack.damageFormula, heroStats, pendingAttack.damageBonus);
      const baseDmg = dmgRes.total;
      let dmg = baseDmg;

      if (pendingAttack.isCrit) {
        // Critical Hit Effect: Double Damage + 3 Brutal Strike Bonus
        const critMultiplier = 2;
        const brutalBonus = 3;
        dmg = baseDmg * critMultiplier + brutalBonus;
        sounds.playCriticalHit();
        hero.statsHistory.critsRolled += 1;
      } else {
        if (pendingAttack.type === 'spell') sounds.playFire();
        else sounds.playHit();
      }

      hero.statsHistory.highestDamageDealt = Math.max(hero.statsHistory.highestDamageDealt, dmg);
      const newMonsterHp = Math.max(0, monster.hp - dmg);
      monster.hp = newMonsterHp;
      setDamageRoll(dmgRes);

      setActionSummary({
        title: pendingAttack.isCrit ? 'CRITICAL HIT & DAMAGE!' : 'DAMAGE DEALT!',
        details: pendingAttack.isCrit
          ? `Hit with ${pendingAttack.name}! Base Dice: ${dmgRes.formulaString} (${dmgRes.individualRolls.join(' + ')}) ${dmgRes.modifier >= 0 ? `+ ${dmgRes.modifier}` : dmgRes.modifier} = ${baseDmg} Base Damage.\n\n⚔️ CRITICAL MULTIPLIER APPLIED: [${baseDmg} Base × 2 (Critical Multiplier) + 3 (Brutal Strike Bonus)] = ${dmg} Total Damage dealt to ${monster.name}!`
          : `Hit with ${pendingAttack.name}! Damage Dice: ${dmgRes.formulaString} (${dmgRes.individualRolls.join(' + ')}) ${dmgRes.modifier >= 0 ? `+ ${dmgRes.modifier}` : dmgRes.modifier} = ${dmg} damage dealt to ${monster.name}.`,
        damage: dmg,
        isHit: true,
        isCrit: pendingAttack.isCrit,
        type: 'hero',
      });

      addLog(
        'hero',
        pendingAttack.isCrit ? `Critical Hit with ${pendingAttack.name}` : `Hit with ${pendingAttack.name}`,
        pendingAttack.isCrit
          ? `CRITICAL HIT! Rolled ${baseDmg} base damage. Applied 2x Multiplier + 3 Brutal = ${dmg} total damage!`
          : `Attack roll ${pendingAttack.atkRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}. Dealt ${dmg} damage (${dmgRes.formulaString}).`,
        {
          diceType: 'd20',
          rolls: pendingAttack.atkRoll.individualRolls,
          modifier: pendingAttack.atkRoll.modifier,
          total: pendingAttack.atkRoll.total,
          targetValue: effectiveMonsterAc,
          isCrit: pendingAttack.isCrit,
        },
        dmg
      );

      onUpdateHero({ ...hero });
      onUpdateCombat({ ...combat });
      setCombatStep('HERO_DAMAGE_RESULT');
    }, 600);
  };

  // 3. HERO CAST SPELL / SKILL
  const handleHeroCastSkill = (skill: HeroSkill) => {
    if (combatStep !== 'HERO_CHOICE' || hero.currentMana < skill.manaCost) return;
    hero.currentMana -= skill.manaCost;
    const detail = getSkillDetails(skill);

    if (skill.type === 'heal') {
      setCombatStep('HERO_ATTACK_ROLLING');
      sounds.playMagic();
      const formulaToUse = skill.id === 'lay_on_hands' ? String(10 + hero.level * 5) : (skill.diceFormula || '1d8+INT');
      const healRoll = parseAndRollFormula(formulaToUse, heroStats);
      setCurrentRoll(healRoll);

      setTimeout(() => {
        const healed = healRoll.total;
        hero.currentHp = Math.min(hero.maxHp, hero.currentHp + healed);
        sounds.playLevelUp();

        setActionSummary({
          title: `${skill.name} Cast!`,
          details: `Channeled sacred vitality! Restored ${healed} Hit Points. Current HP: ${hero.currentHp} / ${hero.maxHp}.`,
          type: 'hero',
        });

        addLog('hero', skill.name, `Restored ${healed} Hit Points.`);
        onUpdateHero({ ...hero });
        onUpdateCombat({ ...combat });
        setCombatStep('HERO_NON_DAMAGE_RESULT');
      }, 600);
      return;
    }

    if (skill.type === 'buff') {
      const activeEffects = [...(hero.activeEffects || [])];
      let newEffect: StatusEffect | null = null;

      if (skill.id === 'bulwark') {
        const dmgRed = 4 + (hero.level - 1) * 2;
        newEffect = {
          id: 'bulwark',
          name: 'Aura of Protection',
          description: `Radiant holy barrier reducing all incoming monster damage by ${dmgRed}`,
          durationTurns: 3,
          type: 'buff',
          damageReduction: dmgRed,
          icon: 'ShieldCheck',
        };
      } else if (skill.id === 'shield_wall') {
        const acMod = 3 + hero.level;
        const dmgRed = 2 + hero.level;
        newEffect = {
          id: 'shield_wall',
          name: 'Iron Guard',
          description: `Fortified stance granting +${acMod} Armor Class & absorbing ${dmgRed} damage`,
          durationTurns: 2,
          type: 'buff',
          armorModifier: acMod,
          damageReduction: dmgRed,
          icon: 'Shield',
        };
      } else if (skill.id === 'survival_instinct') {
        const acMod = 3 + hero.level;
        const critMod = 0.10 + hero.level * 0.05;
        newEffect = {
          id: 'survival_instinct',
          name: "Hunter's Focus",
          description: `Sharpened senses granting +${acMod} Armor Class and +${Math.round(critMod * 100)}% Critical Chance`,
          durationTurns: 3,
          type: 'buff',
          armorModifier: acMod,
          critModifier: critMod,
          icon: 'Zap',
        };
      } else if (skill.id === 'holy_blessing') {
        const atkMod = 2 + hero.level;
        newEffect = {
          id: 'holy_blessing',
          name: 'Divine Favor',
          description: `Holy blessing granting +${atkMod} to all attack rolls and saving checks`,
          durationTurns: 3,
          type: 'buff',
          attackModifier: atkMod,
          icon: 'Sparkles',
        };
      } else if (skill.id === 'mana_shield') {
        const shieldVal = 12 + hero.level * 8;
        newEffect = {
          id: 'mana_shield',
          name: 'Arcane Barrier',
          description: `Mystic force barrier absorbing up to ${shieldVal} damage before breaking`,
          durationTurns: 4,
          type: 'buff',
          shieldHp: shieldVal,
          maxShieldHp: shieldVal,
          icon: 'Shield',
        };
      } else if (skill.id === 'smoke_bomb') {
        const evasion = Math.min(0.95, 0.70 + hero.level * 0.05);
        newEffect = {
          id: 'smoke_bomb',
          name: 'Shadow Evasion',
          description: `Dense smoke screen providing ${Math.round(evasion * 100)}% evasion against enemy attacks`,
          durationTurns: 2,
          type: 'buff',
          evasionBonus: evasion,
          icon: 'Wind',
        };
      } else if (skill.id === 'poison_blade') {
        const toxDmg = 2 + hero.level * 2;
        newEffect = {
          id: 'poison_blade',
          name: 'Venom Coating',
          description: `Coats weapon in viper venom dealing +${toxDmg} extra poison damage`,
          durationTurns: 3,
          type: 'buff',
          damagePerTurn: toxDmg,
          icon: 'FlaskRound',
        };
      } else {
        newEffect = {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          durationTurns: 3,
          type: 'buff',
          armorModifier: 4,
          icon: 'Shield',
        };
      }

      // Replace existing buff of same id or append
      const filtered = activeEffects.filter((e) => e.id !== newEffect!.id);
      filtered.push(newEffect);
      hero.activeEffects = filtered;

      sounds.playBlock();
      setActionSummary({
        title: `${skill.name} Activated!`,
        details: `${detail.boxText}\n\n✨ ACTIVE PROTECTION: Effect will remain active for ${newEffect.durationTurns} turns, persisting across rounds with full damage reductions & modifiers.`,
        type: 'hero',
      });
      addLog('hero', skill.name, `Activated ${skill.name} (${newEffect.durationTurns} turns active).`);
      onUpdateHero({ ...hero });
      onUpdateCombat({ ...combat });
      setCombatStep('HERO_NON_DAMAGE_RESULT');
      return;
    }

    // Attack Spell / Skill (Two-Stage: To-Hit -> Damage)
    setCombatStep('HERO_ATTACK_ROLLING');
    sounds.playMagic();

    const staggerBonus = combat.monsterStumbled ? 2 : 0;
    if (combat.monsterStumbled) {
      combat.monsterStumbled = false;
      onUpdateCombat({ ...combat });
    }

    const skillRoll = rollDice(1, 20, detail.totalAtkMod + staggerBonus);
    if (detail.isAutoHit) {
      skillRoll.isCrit = false;
      skillRoll.isFumble = false;
      skillRoll.total = Math.max(skillRoll.total, effectiveMonsterAc);
    }
    setCurrentRoll(skillRoll);

    setTimeout(() => {
      const isHit = detail.isAutoHit || skillRoll.isCrit || (!skillRoll.isFumble && skillRoll.total >= effectiveMonsterAc);
      
      if (skillRoll.isFumble && !detail.isAutoHit) {
        combat.heroStumbled = true;
        onUpdateCombat({ ...combat });
      }

      setPendingAttack({
        type: 'spell',
        name: skill.name,
        atkRoll: skillRoll,
        isHit,
        isCrit: skillRoll.isCrit,
        isFumble: skillRoll.isFumble,
        damageFormula: detail.baseDice,
        damageBonus: detail.damageBonus,
        skill,
      });

      const statBreakdown = `${detail.statMod >= 0 ? `+${detail.statMod}` : detail.statMod} ${detail.statKey}${detail.extraAccuracyLabel ? ` ${detail.extraAccuracyLabel}` : ''}${staggerBonus ? ' +2 Staggered' : ''}`;

      if (!isHit) {
        sounds.playBlock();
        setActionSummary({
          title: skillRoll.isFumble ? `${skill.name} Critical Fumble! (Natural 1)` : `${skill.name} Missed / Evaded`,
          details: skillRoll.isFumble
            ? `Attack Roll: [1] (Natural 1 Fumble!) ${skillRoll.modifier >= 0 ? `+ ${skillRoll.modifier}` : skillRoll.modifier} (${statBreakdown}) = ${skillRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n💥 STUMBLED & VULNERABLE: The ability completely backfired! You lost your footing and FORFEIT your next combat turn while recovering balance!`
            : `Attack Roll: [${skillRoll.individualRolls[0]}] ${skillRoll.modifier >= 0 ? `+ ${skillRoll.modifier}` : skillRoll.modifier} (${statBreakdown}) = ${skillRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}. Deflected by monster defenses!`,
          isHit: false,
          isFumble: skillRoll.isFumble,
          type: 'hero',
        });
        addLog(
          'hero',
          skillRoll.isFumble ? `${skill.name} (Fumble)` : `${skill.name} (Miss)`,
          skillRoll.isFumble
            ? `Rolled Natural 1 on ${skill.name}! Hero stumbled and forfeits next turn!`
            : `Failed to penetrate AC ${effectiveMonsterAc}${acReductionBreakdown} (Rolled ${skillRoll.total}).`
        );
      } else {
        sounds.playFire();
        setActionSummary({
          title: skillRoll.isCrit ? `CRITICAL ${skill.name.toUpperCase()}! (Natural 20)` : `${skill.name} Connected!`,
          details: detail.isAutoHit
            ? `Unerring Arcane strike automatically hit monster for full effect! Proceed to roll damage.`
            : skillRoll.isCrit
            ? `Attack Roll: [20] (Natural 20 Critical!) ${skillRoll.modifier >= 0 ? `+ ${skillRoll.modifier}` : skillRoll.modifier} (${statBreakdown}) = ${skillRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n⚔️ CRITICAL STRIKE: Devastating direct hit! Your upcoming damage roll will be DOUBLED (2x Damage Multiplier + 3 Brutal Strike Bonus)!`
            : `Attack Roll: [${skillRoll.individualRolls[0]}] ${skillRoll.modifier >= 0 ? `+ ${skillRoll.modifier}` : skillRoll.modifier} (${statBreakdown}) = ${skillRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}. Hit connected! Proceed to roll damage dice.`,
          isHit: true,
          isCrit: skillRoll.isCrit,
          type: 'hero',
        });
      }

      setCombatStep('HERO_ATTACK_RESULT');
    }, 600);
  };

  // 4a. HERO DEFEND & COUNTER-ATTACK (Costs 5 Energy)
  const handleHeroDefend = () => {
    if (combatStep !== 'HERO_CHOICE' || hero.currentMana < 5) return;
    hero.currentMana -= 5;
    onUpdateHero({ ...hero });
    combat.heroDefending = true;
    combat.heroCatchingBreath = false;
    sounds.playBlock();

    const shieldAbsorb = 3 + (hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus || 0);

    setActionSummary({
      title: `${guardProfile.actionName} Activated (-5 EP)`,
      details: `🛡️ DEFENSIVE STANCE ACTIVE:\n• Cost: 5 Energy\n• Fortified Defenses: +4 Armor Class (Your AC ${heroAc} ➔ ${heroAc + 4})\n• Damage Absorption: Absorbs ${shieldAbsorb} incoming monster damage\n• ⚔️ COUNTER-ATTACK PRIMED: Ready to execute a retaliatory ${guardProfile.counterName} (${guardProfile.counterFormula} + ${guardProfile.counterBonus >= 0 ? `+${guardProfile.counterBonus}` : guardProfile.counterBonus} ${guardProfile.counterStatKey}) when ${monster.name} attacks!`,
      type: 'hero',
    });

    addLog('hero', guardProfile.actionName, `Spent 5 Energy: Raised defense (+4 AC, -${shieldAbsorb} dmg) & primed ${guardProfile.counterName}.`);
    onUpdateCombat({ ...combat });
    setCombatStep('HERO_NON_DAMAGE_RESULT');
  };

  // 4b. HERO CATCH BREATH (Costs 0 Energy, Replaces Counter Attack when <5 EP, Restores +2 EP, +4 AC, No Damage Counter)
  const handleHeroCatchBreath = () => {
    if (combatStep !== 'HERO_CHOICE') return;
    const manaRecovered = Math.min(hero.maxMana - hero.currentMana, 2);
    hero.currentMana = Math.min(hero.maxMana, hero.currentMana + 2);
    onUpdateHero({ ...hero });
    combat.heroDefending = false;
    combat.heroCatchingBreath = true;
    sounds.playBlock();

    const shieldAbsorb = 3 + (hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus || 0);

    setActionSummary({
      title: `💨 Catch Breath & Guard (+${manaRecovered > 0 ? manaRecovered : 0} EP)`,
      details: `🛡️ STAMINA RECOVERY & TACTICAL GUARD:\n• Cost: 0 EP (Free Exhaustion Recovery)\n• Energy Restored: +2 Energy Points (${hero.currentMana} / ${hero.maxMana} EP)\n• Fortified Defenses: +4 Armor Class (Your AC ${heroAc} ➔ ${heroAc + 4})\n• Damage Absorption: Absorbs ${shieldAbsorb} incoming monster damage\n• Pure Defense: Focusing entirely on recovery — does not deliver a counter-attack.`,
      type: 'hero',
    });

    addLog('hero', 'Catch Breath & Guard', `Cost 0 EP: Restored +2 Energy (${hero.currentMana}/${hero.maxMana} EP). Fortified defense (+4 AC, -${shieldAbsorb} dmg) without counter-attack.`);
    onUpdateCombat({ ...combat });
    setCombatStep('HERO_NON_DAMAGE_RESULT');
  };

  // 5. ATTEMPT FLEE ACTION (Costs 0 Energy)
  const handleAttemptFlee = () => {
    if (combatStep !== 'HERO_CHOICE') return;
    setCombatStep('HERO_ATTACK_ROLLING');
    sounds.playDiceRoll();

    const escapeDc = 10 + monster.level;
    const fleeRoll = rollDice(1, 20, fleeMod);
    setCurrentRoll(fleeRoll);

    setTimeout(() => {
      if (fleeRoll.isFumble) {
        sounds.playTrap();
        combat.heroStumbled = true;
        setActionSummary({
          title: '✖ CRITICAL FUMBLE! ESCAPE BOTCHED (Natural 1)!',
          details: `Flee Check: Rolled [1] (Natural 1 Fumble!) ${fleeRoll.modifier >= 0 ? `+ ${fleeRoll.modifier}` : fleeRoll.modifier} = ${fleeRoll.total} vs Escape DC ${escapeDc}.\n\n💥 STUMBLED & VULNERABLE: You tripped on the flagstones while fleeing! You FORFEIT your next combat turn while scrambling back to your feet! (Fate cannot avert a Critical Fumble!)`,
          type: 'flee',
          isHit: false,
          isFumble: true,
        });
        addLog('hero', 'Flee Fumbled (Natural 1)', `Rolled Natural 1! Hero tripped and is stumbled!`);
        setCombatStep('HERO_NON_DAMAGE_RESULT');
      } else if (fleeRoll.total >= escapeDc) {
        // Success!
        sounds.playLoot();
        setActionSummary({
          title: '✦ ESCAPED THE ENCOUNTER!',
          details: `Flee Check: Rolled [${fleeRoll.individualRolls[0]}] ${fleeRoll.modifier >= 0 ? `+ ${fleeRoll.modifier}` : fleeRoll.modifier} = ${fleeRoll.total} vs Escape DC ${escapeDc}. You retreated safely to the previous chamber!`,
          type: 'flee',
          isHit: true,
          isFumble: false,
        });
        addLog('hero', 'Escaped', `Fled combat successfully (DC ${escapeDc}).`);
        setCombatStep('FLEE_RESULT');
      } else {
        // Failure
        sounds.playTrap();
        setActionSummary({
          title: '✖ FLEE FAILED! ESCAPE CUT OFF!',
          details: `Flee Check: Rolled [${fleeRoll.individualRolls[0]}] ${fleeRoll.modifier >= 0 ? `+ ${fleeRoll.modifier}` : fleeRoll.modifier} = ${fleeRoll.total} vs Escape DC ${escapeDc}. ${monster.name} blocks your escape!`,
          type: 'flee',
          isHit: false,
          isFumble: false,
        });
        addLog('hero', 'Flee Failed', `Failed to escape DC ${escapeDc}.`);
        setCombatStep('HERO_NON_DAMAGE_RESULT');
      }
    }, 600);
  };

  // 6. USE POTION / CONSUMABLE / SCROLL IN COMBAT
  const handleUseCombatItem = (invIdx: number) => {
    const inv = hero.inventory[invIdx];
    if (!inv || !inv.item.usableInCombat) return;
    if (!canHeroUseItem(hero, inv.item).canUse) {
      sounds.playBlock();
      return;
    }
    const item = inv.item;

    // A. OFFENSIVE SPELL SCROLLS (e.g. Scroll of Fireball)
    if (item.damageDice || item.id === 'scroll_of_fireball') {
      if (inv.quantity > 1) {
        inv.quantity -= 1;
      } else {
        hero.inventory.splice(invIdx, 1);
      }

      setCombatStep('HERO_DAMAGE_ROLLING');
      sounds.playFire();

      const intMod = getStatModifier(heroStats.INT);
      const formula = item.damageDice || '3d8';
      const dmgRes = parseAndRollFormula(formula, heroStats, intMod);
      setDamageRoll(dmgRes);

      setPendingAttack({
        type: 'spell',
        name: item.name,
        damageFormula: formula,
        damageBonus: intMod,
        atkRoll: rollDice(1, 20, 0),
        isHit: true,
        isCrit: false,
        isFumble: false,
      });

      setTimeout(() => {
        const dmg = Math.max(1, dmgRes.total);
        hero.statsHistory.highestDamageDealt = Math.max(hero.statsHistory.highestDamageDealt, dmg);
        monster.hp = Math.max(0, monster.hp - dmg);
        sounds.playFire();

        setActionSummary({
          title: `🔥 ${item.name.toUpperCase()} BLAST!`,
          details: `You unfurled the enchanted parchment and unleashed a searing blaze upon ${monster.name}!\n\nDamage Roll: ${dmgRes.formulaString} (${dmgRes.individualRolls.join(' + ')}) ${dmgRes.modifier >= 0 ? `+ ${dmgRes.modifier}` : dmgRes.modifier} (${intMod >= 0 ? `+${intMod}` : intMod} INT Power) = ${dmg} Fire Damage dealt!`,
          damage: dmg,
          isHit: true,
          isCrit: false,
          type: 'hero',
        });

        addLog(
          'hero',
          `Cast ${item.name}`,
          `Unfurled ${item.name} blasting ${monster.name} for ${dmg} Fire Damage (${dmgRes.formulaString}).`,
          {
            diceType: 'd8',
            rolls: dmgRes.individualRolls,
            modifier: dmgRes.modifier,
            total: dmgRes.total,
          },
          dmg
        );

        onUpdateHero({ ...hero });
        onUpdateCombat({ ...combat });
        setCombatStep('HERO_DAMAGE_RESULT');
      }, 600);
      return;
    }

    // B. ESCAPE SCROLLS (e.g. Scroll of Escape)
    if (item.id === 'scroll_of_teleport') {
      if (inv.quantity > 1) {
        inv.quantity -= 1;
      } else {
        hero.inventory.splice(invIdx, 1);
      }
      sounds.playMagic();
      setActionSummary({
        title: '✦ SCROLL OF ESCAPE TELEPORTATION!',
        details: 'You unfurled the Scroll of Escape! A dimensional rift opens and instantly transports you safely out of combat back to the previous chamber.',
        type: 'flee',
        isHit: true,
      });
      addLog('hero', 'Used Scroll of Escape', 'Safely teleported out of combat back to the previous chamber.');
      onUpdateHero({ ...hero });
      onUpdateCombat({ ...combat });
      setCombatStep('FLEE_RESULT');
      return;
    }

    // C. RESTORATIVE POTIONS / CONSUMABLES (HP & Energy)
    if (item.healHp && item.healMana) {
      sounds.playHeal();
      hero.currentHp = Math.min(hero.maxHp, hero.currentHp + item.healHp);
      hero.currentMana = Math.min(hero.maxMana, hero.currentMana + item.healMana);
      setActionSummary({
        title: `Consumed ${item.name}!`,
        details: `Restored ${item.healHp} HP and ${item.healMana} Energy! Current HP: ${hero.currentHp}/${hero.maxHp}, Energy: ${hero.currentMana}/${hero.maxMana}.`,
        type: 'hero',
      });
      addLog('hero', `Used ${item.name}`, `Restored ${item.healHp} HP and ${item.healMana} Energy.`);
    } else if (item.healHp) {
      sounds.playHeal();
      hero.currentHp = Math.min(hero.maxHp, hero.currentHp + item.healHp);
      setActionSummary({
        title: `Drank ${item.name}!`,
        details: `Recovered ${item.healHp} Hit Points! Current HP: ${hero.currentHp}/${hero.maxHp}.`,
        type: 'hero',
      });
      addLog('hero', `Used ${item.name}`, `Restored ${item.healHp} HP.`);
    } else if (item.healMana) {
      sounds.playSpell();
      hero.currentMana = Math.min(hero.maxMana, hero.currentMana + item.healMana);
      setActionSummary({
        title: `Drank ${item.name}!`,
        details: `Restored ${item.healMana} Energy! Current Energy: ${hero.currentMana}/${hero.maxMana}.`,
        type: 'hero',
      });
      addLog('hero', `Used ${item.name}`, `Restored ${item.healMana} Energy.`);
    } else {
      sounds.playMagic();
      setActionSummary({
        title: `Used ${item.name}!`,
        details: `Activated ${item.name}.`,
        type: 'hero',
      });
      addLog('hero', `Used ${item.name}`, `Activated ${item.name}.`);
    }

    if (inv.quantity > 1) {
      inv.quantity -= 1;
    } else {
      hero.inventory.splice(invIdx, 1);
    }

    onUpdateHero({ ...hero });
    onUpdateCombat({ ...combat });
    setCombatStep('HERO_NON_DAMAGE_RESULT');
  };

  // 7. TRIGGER ENEMY TURN
  const handleProceedToEnemyTurn = () => {
    if (monster.hp <= 0) {
      handleMonsterSlain();
      return;
    }

    setCombatStep('ENEMY_ROLLING');
    sounds.playDiceRoll();

    const actions = monster.actions;
    const action = actions[Math.floor(Math.random() * actions.length)] || actions[0];

    const atkRoll = rollDice(1, 20, monster.attackBonus);
    setCurrentRoll(atkRoll);

    setTimeout(() => {
      // Check Active Evasion Buffs (e.g. Smoke Bomb 75% evasion)
      const evasionBuff = (hero.activeEffects || []).find((e) => e.evasionBonus && e.evasionBonus > 0);
      const isEvaded = Boolean(evasionBuff && Math.random() < (evasionBuff.evasionBonus || 0));

      if (isEvaded && evasionBuff) {
        sounds.playBlock();
        setActionSummary({
          title: `✦ ${evasionBuff.name.toUpperCase()} EVASION!`,
          details: `${monster.name} attacked with ${action.name} (Roll ${atkRoll.total}), but you vanished into the shadows and completely evaded the strike!`,
          isHit: false,
          type: 'monster',
        });
        addLog('hero', evasionBuff.name, `Completely evaded ${monster.name}'s attack using ${evasionBuff.name}!`);
      } else if (atkRoll.isFumble) {
        // Monster Critical Fumble (Natural 1)
        combat.monsterStumbled = true;
        sounds.playBlock();

        // Check if Hero was Defending -> Trigger Counter-Attack
        if (combat.heroDefending) {
          const counterRes = parseAndRollFormula(guardProfile.counterFormula, heroStats, guardProfile.counterBonus);
          const counterDmg = Math.max(1, counterRes.total);
          monster.hp = Math.max(0, monster.hp - counterDmg);

          if (guardProfile.sound === 'fire') sounds.playFire();
          else sounds.playHit();

          setActionSummary({
            title: `CRITICAL ENEMY FUMBLE & ${guardProfile.counterName.toUpperCase()}!`,
            details: `💥 ENEMY FUMBLE (Natural 1): ${monster.name} slipped and stumbled, completely botching its attack (dealing 0 damage & granting you +2 Advantage next turn)!\n\n⚔️ RETALIATORY COUNTER-ATTACK: Seizing the monster's blunder, you struck back with ${guardProfile.counterName} (${counterRes.formulaString} = ${counterDmg} damage)!${monster.hp <= 0 ? `\n\n💀 ${monster.name.toUpperCase()} HAS BEEN SLAIN BY YOUR COUNTER-ATTACK!` : ''}`,
            damage: 0,
            isHit: false,
            isFumble: true,
            type: 'monster',
          });

          addLog(
            'hero',
            `Counter-Attack: ${guardProfile.counterName}`,
            `Retaliated against stumbled ${monster.name} for ${counterDmg} damage!`,
            undefined,
            counterDmg
          );
        } else {
          setActionSummary({
            title: 'CRITICAL ENEMY FUMBLE! (Natural 1)',
            details: `${monster.name} rolled a Natural 1 and slipped on the dungeon stones! The creature is STAGGERED and completely botched its attack, dealing 0 damage and leaving its guard wide open (+2 Advantage to your next attack roll)!`,
            isHit: false,
            isFumble: true,
            type: 'monster',
          });
        }

        addLog(
          'monster',
          `${monster.name} Fumbled! (Natural 1)`,
          `Rolled Natural 1! The attack backfired — ${monster.name} is staggered (+2 advantage to hero next turn).`,
          {
            diceType: 'd20',
            rolls: atkRoll.individualRolls,
            modifier: atkRoll.modifier,
            total: atkRoll.total,
            targetValue: heroAc,
            isFumble: true,
          }
        );
      } else {
        const isHit = atkRoll.isCrit || atkRoll.total >= heroAc;

        if (isHit) {
          const actionDice = action.damageDice || '1d6';
          const dmgRes = parseAndRollFormula(actionDice);
          const rawBaseDmg = dmgRes.total;
          let calculatedDmg = rawBaseDmg;

          if (atkRoll.isCrit) {
            // Monster Critical Strike: 1.5x damage + 2 brutality
            calculatedDmg = Math.floor(rawBaseDmg * 1.5) + 2;
            sounds.playCriticalHit();
          } else {
            sounds.playHit();
          }

          // Damage Reduction from Active Buffs (e.g. Aura of Protection -4, Iron Guard -3)
          const activeBuffDmgReduction = (hero.activeEffects || []).reduce((sum, eff) => sum + (eff.damageReduction || 0), 0);
          const isGuarding = combat.heroDefending || combat.heroCatchingBreath;
          const guardReduction = isGuarding ? (3 + (hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus || 0)) : 0;
          const totalReduction = activeBuffDmgReduction + guardReduction;

          let dmgAfterReduction = Math.max(0, calculatedDmg - totalReduction);

          // Check Arcane Barrier (shieldHp absorption)
          let absorbedByShield = 0;
          const manaShieldEff = (hero.activeEffects || []).find((e) => e.id === 'mana_shield' && e.shieldHp && e.shieldHp > 0);
          if (manaShieldEff && manaShieldEff.shieldHp) {
            absorbedByShield = Math.min(manaShieldEff.shieldHp, dmgAfterReduction);
            manaShieldEff.shieldHp -= absorbedByShield;
            dmgAfterReduction = Math.max(0, dmgAfterReduction - absorbedByShield);
          }

          const finalDmgTaken = dmgAfterReduction;
          hero.currentHp = Math.max(0, hero.currentHp - finalDmgTaken);

          // Build reduction breakdown string
          const reductionDetails: string[] = [];
          if (activeBuffDmgReduction > 0) {
            const buffNames = (hero.activeEffects || []).filter((e) => (e.damageReduction || 0) > 0).map((e) => `${e.name} (-${e.damageReduction} Dmg)`).join(', ');
            reductionDetails.push(buffNames);
          }
          if (guardReduction > 0) {
            reductionDetails.push(`Defensive Guard: -${guardReduction} Dmg`);
          }
          if (absorbedByShield > 0) {
            reductionDetails.push(`Arcane Barrier: -${absorbedByShield} Absorb (${manaShieldEff?.shieldHp || 0} HP left)`);
          }

          const isFullyAbsorbed = calculatedDmg > 0 && finalDmgTaken === 0;
          if (isFullyAbsorbed) {
            sounds.playBlock();
          }

          const reductionString = reductionDetails.length > 0
            ? isFullyAbsorbed
              ? `\n\n🛡️ FULL DAMAGE ABSORPTION: Rolled ${calculatedDmg} base damage, but [${reductionDetails.join(' + ')}] completely absorbed the blow (0 HP lost)!`
              : `\n\n🛡️ DAMAGE REDUCTION APPLIED: Rolled ${calculatedDmg} Base Damage - [${reductionDetails.join(' + ')}] = ${finalDmgTaken} Final Damage Taken!`
            : '';

          // Check Hero Counter-Attack if Defending
          if (combat.heroDefending) {
            const counterRes = parseAndRollFormula(guardProfile.counterFormula, heroStats, guardProfile.counterBonus);
            const counterDmg = Math.max(1, counterRes.total);
            monster.hp = Math.max(0, monster.hp - counterDmg);

            if (guardProfile.sound === 'fire') sounds.playFire();
            else sounds.playHit();

            setActionSummary({
              title: isFullyAbsorbed
                ? `🛡️ BLOCKED & ${guardProfile.counterName.toUpperCase()}!`
                : atkRoll.isCrit
                ? 'CRITICAL ENEMY HIT & RETALIATION!'
                : `${monster.name} Hit & ${guardProfile.counterName.toUpperCase()}!`,
              details: `${action.name}: Rolled [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} = ${atkRoll.total} vs your fortified AC ${heroAc}. Struck for ${calculatedDmg} base damage.${reductionString}\n\n⚔️ RETALIATORY COUNTER-ATTACK: Absorbing the blow, you counter-struck with ${guardProfile.counterName} (${counterRes.formulaString} = ${counterDmg} damage)!${monster.hp <= 0 ? `\n\n💀 ${monster.name.toUpperCase()} HAS BEEN SLAIN BY YOUR COUNTER-ATTACK!` : ''}`,
              damage: finalDmgTaken,
              isHit: true,
              isCrit: atkRoll.isCrit,
              type: 'monster',
            });

            addLog(
              'hero',
              `Counter-Attack: ${guardProfile.counterName}`,
              `Retaliated against ${monster.name} for ${counterDmg} damage!`,
              undefined,
              counterDmg
            );
          } else {
            setActionSummary({
              title: isFullyAbsorbed
                ? '🛡️ ATTACK FULLY ABSORBED / BLOCKED!'
                : atkRoll.isCrit
                ? 'CRITICAL ENEMY STRIKE! (Natural 20)'
                : `${monster.name} Struck You!`,
              details: atkRoll.isCrit
                ? `${action.name}: Rolled [20] + ${atkRoll.modifier} = ${atkRoll.total} (NATURAL 20 CRITICAL!). Penetrated defenses!\n\n💥 CRITICAL DAMAGE: [${rawBaseDmg} Base × 1.5 + 2 Brutality] = ${calculatedDmg} damage.${reductionString}\n\nYou took ${finalDmgTaken} damage!`
                : `${action.name}: Rolled [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} = ${atkRoll.total} vs your AC ${heroAc}.${reductionString}\nYou took ${finalDmgTaken} damage!`,
              damage: finalDmgTaken,
              isHit: true,
              isCrit: atkRoll.isCrit,
              type: 'monster',
            });
          }

          const logDetail = isFullyAbsorbed
            ? `Attack roll: [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs AC ${heroAc}. HIT for ${calculatedDmg} base dmg, but 100% ABSORBED by ${reductionDetails.join(' + ')} (0 damage taken).`
            : reductionDetails.length > 0
            ? `Attack roll: [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs AC ${heroAc}. HIT for ${calculatedDmg} base dmg [Reduced by ${reductionDetails.join(' + ')}] ➔ Took ${finalDmgTaken} damage.`
            : `Attack roll: [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs AC ${heroAc}. HIT for ${finalDmgTaken} damage.`;

          addLog(
            'monster',
            isFullyAbsorbed
              ? `${monster.name} Attack Absorbed!`
              : atkRoll.isCrit
              ? `Critical Strike from ${monster.name}`
              : `${monster.name}: ${action.name}`,
            atkRoll.isCrit && !isFullyAbsorbed
              ? `NATURAL 20 CRITICAL! Struck with ${action.name} for ${finalDmgTaken} damage (after protections).`
              : logDetail,
            {
              diceType: 'd20',
              rolls: atkRoll.individualRolls,
              modifier: atkRoll.modifier,
              total: atkRoll.total,
              targetValue: heroAc,
              isCrit: atkRoll.isCrit,
            },
            finalDmgTaken
          );
        } else {
          // Monster Missed!
          sounds.playBlock();

          if (combat.heroDefending) {
            const counterRes = parseAndRollFormula(guardProfile.counterFormula, heroStats, guardProfile.counterBonus);
            const counterDmg = Math.max(1, counterRes.total);
            monster.hp = Math.max(0, monster.hp - counterDmg);

            if (guardProfile.sound === 'fire') sounds.playFire();
            else sounds.playHit();

            setActionSummary({
              title: `🛡️ DEFLECTED & ${guardProfile.counterName.toUpperCase()}!`,
              details: `${action.name}: Rolled [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} = ${atkRoll.total} vs your fortified AC ${heroAc}. Deflected cleanly by your guard stance!\n\n⚔️ RETALIATORY COUNTER-ATTACK: Seizing the opening, you struck with ${guardProfile.counterName} (${counterRes.formulaString} = ${counterDmg} damage)!${monster.hp <= 0 ? `\n\n💀 ${monster.name.toUpperCase()} HAS BEEN SLAIN BY YOUR COUNTER-ATTACK!` : ''}`,
              isHit: false,
              type: 'monster',
            });

            addLog(
              'hero',
              `Counter-Attack: ${guardProfile.counterName}`,
              `Deflected attack and retaliated for ${counterDmg} damage!`,
              undefined,
              counterDmg
            );
          } else {
            setActionSummary({
              title: `${monster.name} Missed!`,
              details: `${action.name}: Rolled [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} = ${atkRoll.total} vs your AC ${heroAc}. The blow was deflected!`,
              isHit: false,
              type: 'monster',
            });
          }

          addLog(
            'monster',
            `${monster.name} Missed`,
            `Attack roll: [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs your AC ${heroAc}. Missed!`,
            {
              diceType: 'd20',
              rolls: atkRoll.individualRolls,
              modifier: atkRoll.modifier,
              total: atkRoll.total,
              targetValue: heroAc,
            }
          );
        }
      }

      // End of round state updates
      combat.heroDefending = false;
      combat.heroCatchingBreath = false;
      combat.turnNumber += 1;

      // Tick active buffs / status effects durations
      if (hero.activeEffects && hero.activeEffects.length > 0) {
        const remainingEffects: StatusEffect[] = [];
        hero.activeEffects.forEach((eff) => {
          const newTurns = eff.durationTurns - 1;
          const isShieldDepleted = eff.shieldHp !== undefined && eff.shieldHp <= 0;
          if (newTurns > 0 && !isShieldDepleted) {
            remainingEffects.push({ ...eff, durationTurns: newTurns });
          } else {
            addLog('system', 'Buff Expired', `${eff.name} has dissipated.`);
          }
        });
        hero.activeEffects = remainingEffects;
      }

      onUpdateHero({ ...hero });
      onUpdateCombat({ ...combat });
      setCombatStep('ENEMY_RESULT');
    }, 650);
  };

  // FATE REROLL HANDLERS
  const handleFateRerollHeroAttack = () => {
    if (hero.rerollTokens <= 0 || !pendingAttack || pendingAttack.isFumble || pendingAttack.atkRoll.isFumble) return;
    hero.rerollTokens -= 1;
    combat.heroStumbled = false;
    onUpdateHero({ ...hero });
    sounds.playDiceRoll();

    setCombatStep('HERO_ATTACK_ROLLING');

    if (pendingAttack.type === 'spell' && pendingAttack.skill) {
      const detail = getSkillDetails(pendingAttack.skill);
      const spellRoll = rollDice(1, 20, detail.totalAtkMod);
      if (detail.isAutoHit) {
        spellRoll.isCrit = false;
        spellRoll.isFumble = false;
        spellRoll.total = Math.max(spellRoll.total, effectiveMonsterAc);
      }
      setCurrentRoll(spellRoll);
      const statBreakdown = `${detail.statMod >= 0 ? `+${detail.statMod}` : detail.statMod} ${detail.statKey}${detail.extraAccuracyLabel ? ` ${detail.extraAccuracyLabel}` : ''}`;

      setTimeout(() => {
        const isHit = detail.isAutoHit || spellRoll.isCrit || (!spellRoll.isFumble && spellRoll.total >= effectiveMonsterAc);
        if (spellRoll.isFumble && !detail.isAutoHit) {
          combat.heroStumbled = true;
          onUpdateCombat({ ...combat });
        }

        setPendingAttack({
          ...pendingAttack,
          atkRoll: spellRoll,
          isHit,
          isCrit: spellRoll.isCrit,
          isFumble: spellRoll.isFumble,
        });

        if (!isHit) {
          sounds.playBlock();
          setActionSummary({
            title: spellRoll.isFumble ? `${pendingAttack.name} Critical Fumble (Fate Reroll)!` : `${pendingAttack.name} Missed (Fate Reroll)`,
            details: spellRoll.isFumble
              ? `Fate Reroll: [1] (Natural 1 Fumble!) ${spellRoll.modifier >= 0 ? `+ ${spellRoll.modifier}` : spellRoll.modifier} (${statBreakdown}) = ${spellRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n💥 STUMBLED & VULNERABLE: Botched the spell on reroll and lost balance! You FORFEIT your next combat turn!`
              : `Fate Reroll: [${spellRoll.individualRolls[0]}] ${spellRoll.modifier >= 0 ? `+ ${spellRoll.modifier}` : spellRoll.modifier} (${statBreakdown}) = ${spellRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}. Deflected by monster defenses!`,
            isHit: false,
            isFumble: spellRoll.isFumble,
            type: 'hero',
          });
          addLog('hero', `${pendingAttack.name} (Fate Reroll Miss)`, `Spell failed to penetrate AC ${effectiveMonsterAc}${acReductionBreakdown}.`);
        } else {
          sounds.playFire();
          setActionSummary({
            title: spellRoll.isCrit ? `CRITICAL ${pendingAttack.name.toUpperCase()} (FATE REROLL)!` : `${pendingAttack.name} Connected (Fate Reroll)!`,
            details: spellRoll.isCrit
              ? `Fate Reroll: [20] (Natural 20 Critical!) ${spellRoll.modifier >= 0 ? `+ ${spellRoll.modifier}` : spellRoll.modifier} (${statBreakdown}) = ${spellRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n⚔️ CRITICAL STRIKE: Upcoming damage roll will be DOUBLED (2x Damage Multiplier + 3 Brutal Strike Bonus)!`
              : `Fate Reroll: [${spellRoll.individualRolls[0]}] ${spellRoll.modifier >= 0 ? `+ ${spellRoll.modifier}` : spellRoll.modifier} (${statBreakdown}) = ${spellRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}. Strike connected! Proceed to roll damage dice.`,
            isHit: true,
            isCrit: spellRoll.isCrit,
            type: 'hero',
          });
        }
        setCombatStep('HERO_ATTACK_RESULT');
      }, 600);
    } else {
      const atkRoll = rollDice(1, 20, totalWeaponAtkMod);
      setCurrentRoll(atkRoll);

      setTimeout(() => {
        const isHit = atkRoll.isCrit || (!atkRoll.isFumble && atkRoll.total >= effectiveMonsterAc);
        if (atkRoll.isFumble) {
          combat.heroStumbled = true;
          onUpdateCombat({ ...combat });
        }

        setPendingAttack({
          ...pendingAttack,
          atkRoll,
          isHit,
          isCrit: atkRoll.isCrit,
          isFumble: atkRoll.isFumble,
        });

        if (!isHit) {
          sounds.playBlock();
          setActionSummary({
            title: atkRoll.isFumble ? 'CRITICAL FUMBLE (FATE REROLL)!' : 'ATTACK MISSED (FATE REROLL)',
            details: atkRoll.isFumble
              ? `Fate Reroll: [1] (Natural 1 Fumble!) ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n💥 STUMBLED & VULNERABLE: Overextended on reroll! You FORFEIT your next combat turn!`
              : `Fate Reroll: [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}. The blow failed to penetrate!`,
            isHit: false,
            isFumble: atkRoll.isFumble,
            type: 'hero',
          });
          addLog(
            'hero',
            `Fate Reroll Attack (Miss)`,
            `Rolled [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs AC ${effectiveMonsterAc}${acReductionBreakdown}. Missed!`,
            {
              diceType: 'd20',
              rolls: atkRoll.individualRolls,
              modifier: atkRoll.modifier,
              total: atkRoll.total,
              targetValue: effectiveMonsterAc,
              isFumble: atkRoll.isFumble,
            }
          );
        } else {
          sounds.playHit();
          setActionSummary({
            title: atkRoll.isCrit ? 'CRITICAL HIT (FATE REROLL)!' : 'ATTACK HIT (FATE REROLL)!',
            details: atkRoll.isCrit
              ? `Fate Reroll: [20] (Natural 20 Critical!) ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}.\n\n⚔️ CRITICAL STRIKE: Upcoming damage roll will be DOUBLED (2x Damage Multiplier + 3 Brutal Strike Bonus)!`
              : `Fate Reroll: [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} (${weaponStatBreakdown}) = ${atkRoll.total} vs Enemy AC ${effectiveMonsterAc}${acReductionBreakdown}. Strike connected! Proceed to roll damage dice.`,
            isHit: true,
            isCrit: atkRoll.isCrit,
            type: 'hero',
          });
        }
        setCombatStep('HERO_ATTACK_RESULT');
      }, 600);
    }
  };

  const handleFateRerollHeroDamage = () => {
    if (hero.rerollTokens <= 0 || !pendingAttack || !actionSummary) return;
    if (actionSummary.damage) {
      monster.hp = Math.min(monster.maxHp, monster.hp + actionSummary.damage);
    }
    hero.rerollTokens -= 1;
    onUpdateHero({ ...hero });
    sounds.playDiceRoll();

    setCombatStep('HERO_DAMAGE_ROLLING');

    setTimeout(() => {
      const dmgRes = parseAndRollFormula(pendingAttack.damageFormula, heroStats, pendingAttack.damageBonus);
      const baseDmg = dmgRes.total;
      let dmg = baseDmg;

      if (pendingAttack.isCrit) {
        dmg = baseDmg * 2 + 3;
        sounds.playCriticalHit();
      } else {
        if (pendingAttack.type === 'spell') sounds.playFire();
        else sounds.playHit();
      }

      hero.statsHistory.highestDamageDealt = Math.max(hero.statsHistory.highestDamageDealt, dmg);
      const newMonsterHp = Math.max(0, monster.hp - dmg);
      monster.hp = newMonsterHp;
      setDamageRoll(dmgRes);

      setActionSummary({
        title: pendingAttack.isCrit ? 'CRITICAL HIT & DAMAGE (FATE REROLL)!' : 'DAMAGE DEALT (FATE REROLL)!',
        details: pendingAttack.isCrit
          ? `Fate Reroll Base Dice: ${dmgRes.formulaString} (${dmgRes.individualRolls.join(' + ')}) ${dmgRes.modifier >= 0 ? `+ ${dmgRes.modifier}` : dmgRes.modifier} = ${baseDmg} Base Damage.\n\n⚔️ CRITICAL MULTIPLIER APPLIED: [${baseDmg} Base × 2 (Critical Multiplier) + 3 (Brutal Strike Bonus)] = ${dmg} Total Damage dealt to ${monster.name}!`
          : `Fate Reroll Damage Dice: ${dmgRes.formulaString} (${dmgRes.individualRolls.join(' + ')}) ${dmgRes.modifier >= 0 ? `+ ${dmgRes.modifier}` : dmgRes.modifier} = ${dmg} damage dealt to ${monster.name}.`,
        damage: dmg,
        isHit: true,
        isCrit: pendingAttack.isCrit,
        type: 'hero',
      });

      addLog(
        'hero',
        `Fate Reroll Damage on ${pendingAttack.name}`,
        pendingAttack.isCrit
          ? `CRITICAL REROLL! Rolled ${baseDmg} base damage. Applied 2x Multiplier + 3 Brutal = ${dmg} total damage!`
          : `New damage rolled: ${dmg} (${dmgRes.formulaString}).`,
        undefined,
        dmg
      );

      onUpdateHero({ ...hero });
      onUpdateCombat({ ...combat });
      setCombatStep('HERO_DAMAGE_RESULT');
    }, 600);
  };

  const handleHeroRecoverStumble = () => {
    combat.heroStumbled = false;
    sounds.playTrap();
    addLog('hero', 'Recovered Balance (Turn Forfeited)', `Spent turn regaining footing after Critical Fumble. Turn skipped!`);
    onUpdateCombat({ ...combat });
    handleProceedToEnemyTurn();
  };

  const handleFateRerollFlee = () => {
    if (hero.rerollTokens <= 0 || actionSummary?.isFumble) return;
    hero.rerollTokens -= 1;
    onUpdateHero({ ...hero });
    sounds.playDiceRoll();

    setCombatStep('HERO_ATTACK_ROLLING');

    const escapeDc = 10 + monster.level;
    const fleeRoll = rollDice(1, 20, fleeMod);
    setCurrentRoll(fleeRoll);

    setTimeout(() => {
      if (fleeRoll.total >= escapeDc) {
        sounds.playLoot();
        setActionSummary({
          title: '✦ ESCAPED THE ENCOUNTER (FATE REROLL)!',
          details: `Fate Reroll Flee Check: Rolled [${fleeRoll.individualRolls[0]}] ${fleeRoll.modifier >= 0 ? `+ ${fleeRoll.modifier}` : fleeRoll.modifier} = ${fleeRoll.total} vs Escape DC ${escapeDc}. You retreated safely to the previous chamber!`,
          type: 'flee',
          isHit: true,
        });
        addLog('hero', 'Escaped (Fate Reroll)', `Fled combat successfully (DC ${escapeDc}).`);
        setCombatStep('FLEE_RESULT');
      } else {
        sounds.playTrap();
        setActionSummary({
          title: '✖ FLEE FAILED (FATE REROLL)!',
          details: `Fate Reroll Flee Check: Rolled [${fleeRoll.individualRolls[0]}] ${fleeRoll.modifier >= 0 ? `+ ${fleeRoll.modifier}` : fleeRoll.modifier} = ${fleeRoll.total} vs Escape DC ${escapeDc}. ${monster.name} blocks your escape!`,
          type: 'flee',
          isHit: false,
        });
        addLog('hero', 'Flee Failed (Fate Reroll)', `Failed to escape DC ${escapeDc}.`);
        setCombatStep('HERO_NON_DAMAGE_RESULT');
      }
    }, 600);
  };

  const handleFateDodgeMonster = () => {
    if (hero.rerollTokens <= 0 || !actionSummary || actionSummary.isCrit) return;
    if (actionSummary.damage) {
      hero.currentHp = Math.min(hero.maxHp, hero.currentHp + actionSummary.damage);
    }
    hero.rerollTokens -= 1;
    onUpdateHero({ ...hero });
    sounds.playDiceRoll();

    setCombatStep('ENEMY_ROLLING');

    const actions = monster.actions;
    const action = actions[Math.floor(Math.random() * actions.length)] || actions[0];

    const atkRoll = rollDice(1, 20, monster.attackBonus);
    setCurrentRoll(atkRoll);

    setTimeout(() => {
      const isHit = atkRoll.isCrit || (!atkRoll.isFumble && atkRoll.total >= heroAc);

      if (isHit) {
        const actionDice = action.damageDice || '1d6';
        const dmgRes = parseAndRollFormula(actionDice);
        let dmg = dmgRes.total;

        if (atkRoll.isCrit) {
          dmg = Math.floor(dmg * 1.5) + 2;
          sounds.playCriticalHit();
        } else {
          sounds.playHit();
        }

        const activeBuffDmgReduction = (hero.activeEffects || []).reduce((sum, eff) => sum + (eff.damageReduction || 0), 0);
        const guardReduction = combat.heroDefending ? (3 + (hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus || 0)) : 0;
        const totalReduction = activeBuffDmgReduction + guardReduction;
        let dmgAfterReduction = Math.max(0, dmg - totalReduction);

        let absorbedByShield = 0;
        const manaShieldEff = (hero.activeEffects || []).find((e) => e.id === 'mana_shield' && e.shieldHp && e.shieldHp > 0);
        if (manaShieldEff && manaShieldEff.shieldHp) {
          absorbedByShield = Math.min(manaShieldEff.shieldHp, dmgAfterReduction);
          manaShieldEff.shieldHp -= absorbedByShield;
          dmgAfterReduction = Math.max(0, dmgAfterReduction - absorbedByShield);
        }

        const finalDmgTaken = dmgAfterReduction;
        hero.currentHp = Math.max(0, hero.currentHp - finalDmgTaken);

        const reductionDetails: string[] = [];
        if (activeBuffDmgReduction > 0) {
          const buffNames = (hero.activeEffects || []).filter((e) => (e.damageReduction || 0) > 0).map((e) => `${e.name} (-${e.damageReduction} Dmg)`).join(', ');
          reductionDetails.push(buffNames);
        }
        if (guardReduction > 0) {
          reductionDetails.push(`Defensive Guard: -${guardReduction} Dmg`);
        }
        if (absorbedByShield > 0) {
          reductionDetails.push(`Arcane Barrier: -${absorbedByShield} Absorb (${manaShieldEff?.shieldHp || 0} HP left)`);
        }

        const isFullyAbsorbed = dmg > 0 && finalDmgTaken === 0;
        if (isFullyAbsorbed) {
          sounds.playBlock();
        }

        const reductionString = reductionDetails.length > 0
          ? isFullyAbsorbed
            ? `\n\n🛡️ FULL DAMAGE ABSORPTION: Rolled ${dmg} base damage, but [${reductionDetails.join(' + ')}] completely absorbed the blow (0 HP lost)!`
            : `\n\n🛡️ DAMAGE REDUCTION APPLIED: Rolled ${dmg} Base - [${reductionDetails.join(' + ')}] = ${finalDmgTaken} Final Damage Taken!`
          : '';

        setActionSummary({
          title: isFullyAbsorbed
            ? '🛡️ ATTACK FULLY ABSORBED / BLOCKED!'
            : atkRoll.isCrit
            ? `CRITICAL ${action.name.toUpperCase()}!`
            : `${action.name} Landed!`,
          details: `${action.name} (Forced Reroll): Rolled [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} = ${atkRoll.total} vs your AC ${heroAc}.${reductionString}\nYou took ${finalDmgTaken} damage!`,
          damage: finalDmgTaken,
          isHit: true,
          isCrit: atkRoll.isCrit,
          type: 'monster',
        });

        const logDetail = isFullyAbsorbed
          ? `Reroll: [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs AC ${heroAc}. HIT for ${dmg} base dmg, but 100% ABSORBED by ${reductionDetails.join(' + ')} (0 damage taken).`
          : reductionDetails.length > 0
          ? `Reroll: [${atkRoll.individualRolls[0]}]+${atkRoll.modifier}=${atkRoll.total} vs AC ${heroAc}. HIT for ${dmg} base dmg [Reduced by ${reductionDetails.join(' + ')}] ➔ Took ${finalDmgTaken} damage.`
          : `Attack roll: ${atkRoll.total} vs your AC ${heroAc}. Dealt ${finalDmgTaken} damage.`;

        addLog(
          'monster',
          isFullyAbsorbed
            ? `${monster.name} Attack Absorbed! (Fate Dodge)`
            : `${monster.name} Hit (After Fate Dodge)`,
          logDetail,
          {
            diceType: 'd20',
            rolls: atkRoll.individualRolls,
            modifier: atkRoll.modifier,
            total: atkRoll.total,
            targetValue: heroAc,
            isCrit: atkRoll.isCrit,
          },
          finalDmgTaken
        );
      } else {
        sounds.playBlock();
        setActionSummary({
          title: '✦ FATE DEFLECTION SUCCESSFUL!',
          details: `Fate Dodge: ${monster.name} re-rolled [${atkRoll.individualRolls[0]}] ${atkRoll.modifier >= 0 ? `+ ${atkRoll.modifier}` : atkRoll.modifier} = ${atkRoll.total} vs your AC ${heroAc}. The blow was completely deflected by fate!`,
          isHit: false,
          type: 'monster',
        });

        addLog(
          'monster',
          `${monster.name} Missed (Fate Dodge)`,
          `Reroll: ${atkRoll.total} vs your AC ${heroAc}. Deflected with Fate!`,
          {
            diceType: 'd20',
            rolls: atkRoll.individualRolls,
            modifier: atkRoll.modifier,
            total: atkRoll.total,
            targetValue: heroAc,
          }
        );
      }

      onUpdateHero({ ...hero });
      onUpdateCombat({ ...combat });
      setCombatStep('ENEMY_RESULT');
    }, 650);
  };

  // 8. BEGIN NEXT ROUND (Player Turn)
  const handleBeginNextHeroRound = () => {
    setCurrentRoll(null);
    setDamageRoll(null);
    setPendingAttack(null);
    setActionSummary(null);
    setCombatStep('HERO_CHOICE');
  };

  // 9. MONSTER SLAIN
  const handleMonsterSlain = () => {
    sounds.playLevelUp();
    sounds.playCoins();
    hero.statsHistory.monstersSlain += 1;

    const goldReward =
      Math.floor(Math.random() * (monster.goldMax - monster.goldMin + 1)) + monster.goldMin;
    const itemsAwarded: GameItem[] = [];

    if (Math.random() < monster.lootDropChance && monster.possibleLootIds?.length) {
      const lootId = monster.possibleLootIds[Math.floor(Math.random() * monster.possibleLootIds.length)];
      if (ITEMS_DATABASE[lootId]) {
        itemsAwarded.push(ITEMS_DATABASE[lootId]);
      }
    }

    hero.statsHistory.goldCollected += goldReward;

    onCombatVictory(monster, {
      xp: monster.xpReward,
      gold: goldReward,
      items: itemsAwarded,
    });
  };

  // Combat consumables in inventory (usable in combat and meeting class/stat requirements)
  const combatConsumables = hero.inventory
    .map((inv, idx) => ({ inv, idx }))
    .filter(({ inv }) => inv.item.usableInCombat && canHeroUseItem(hero, inv.item).canUse);

  return (
    <div className="max-w-5xl mx-auto w-full space-y-4 font-sans text-amber-100 animate-fadeIn">
      {/* Interactive Zone: Combat Actions, Rolls & Outcome Steps */}
      <div ref={actionZoneRef} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Main Combat Interaction & Step Card */}
        <div className="lg:col-span-2 space-y-4">
          {/* STEP 1: Hero Action Choice (Compact 2x3 Grid View) */}
          {combatStep === 'HERO_CHOICE' && (
            <div className="bg-[#18120c]/90 border-2 border-amber-800/60 rounded-xl p-2.5 sm:p-3.5 shadow-xl space-y-2.5">
              {/* Header with turn and concise critical rules tip */}
              <div className="flex items-center justify-between border-b border-amber-900/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400 font-mono text-[10px] sm:text-xs font-bold uppercase">
                    Round {combat.turnNumber} (Your Turn)
                  </span>
                  <h3 className="text-sm sm:text-base font-serif font-bold text-amber-200">
                    Select Combat Action
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400">
                  <span className="text-yellow-400 font-bold">Nat 20: 2x Dmg</span>
                  <span className="text-stone-600">•</span>
                  <span className="text-red-400 font-bold">Nat 1: Fumble</span>
                </div>
              </div>

              {/* Action Cards 2x3 Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {/* 1. Attack with Weapon (2 Energy) */}
                {(() => {
                  const canAfford = hero.currentMana >= 2;
                  return (
                    <button
                      id="btn-combat-weapon-attack"
                      onClick={handleHeroAttack}
                      disabled={!canAfford}
                      className={`p-2 sm:p-2.5 border-2 rounded-xl text-left transition-all flex flex-col justify-between shadow-md min-h-[68px] sm:min-h-[74px] ${
                        canAfford
                          ? 'bg-gradient-to-br from-amber-950/80 via-stone-900 to-stone-900 border-amber-600/80 hover:border-amber-300 cursor-pointer transform active:scale-98 group'
                          : 'bg-stone-950/40 border-stone-800/80 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 leading-tight mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sword className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="font-serif font-bold text-amber-200 text-xs truncate">
                            Attack ({primaryWeapon?.name || 'Fists'})
                          </span>
                        </div>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-950 text-amber-300 rounded border border-amber-800 font-bold shrink-0">
                          2 EP
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-amber-400/90 leading-tight">
                        Roll: 1d20{totalWeaponAtkMod >= 0 ? `+${totalWeaponAtkMod}` : totalWeaponAtkMod} vs AC {effectiveMonsterAc}
                        {weaponAcReduction > 0 ? ` (-${weaponAcReduction} Sunder)` : ''}
                      </div>
                      <div className="text-[9px] font-mono text-stone-400 truncate mt-0.5">
                        Dmg: {weaponFormula}{weaponBonus >= 0 ? `+${weaponBonus}` : weaponBonus} • Crit: Nat 20
                      </div>
                    </button>
                  );
                })()}

                {/* 2. Defend & Counter-Attack (5 EP) OR Catch Breath (0 EP, +2 EP, +4 AC, No Damage) when EP < 5 */}
                {hero.currentMana >= 5 ? (
                  <button
                    id="btn-combat-defend"
                    onClick={handleHeroDefend}
                    className="p-2 sm:p-2.5 border-2 rounded-xl text-left transition-all flex flex-col justify-between shadow-md min-h-[68px] sm:min-h-[74px] bg-gradient-to-br from-blue-950/80 via-stone-900 to-stone-900 border-blue-600/80 hover:border-blue-300 cursor-pointer transform active:scale-98 group"
                  >
                    <div className="flex items-center justify-between gap-1 leading-tight mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="font-serif font-bold text-blue-200 text-xs truncate">
                          {guardProfile.actionName}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-1 py-0.2 bg-blue-950 text-blue-300 rounded border border-blue-800 font-bold shrink-0">
                        5 EP
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-blue-400/90 leading-tight">
                      +4 AC • Absorbs {3 + (hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus || 0)} Dmg
                    </div>
                    <div className="text-[9px] font-mono text-stone-400 truncate mt-0.5">
                      Riposte: {guardProfile.counterFormula}{guardProfile.counterBonus >= 0 ? `+${guardProfile.counterBonus}` : guardProfile.counterBonus}
                    </div>
                  </button>
                ) : (
                  <button
                    id="btn-combat-catch-breath"
                    onClick={handleHeroCatchBreath}
                    className="p-2 sm:p-2.5 border-2 rounded-xl text-left transition-all flex flex-col justify-between shadow-md min-h-[68px] sm:min-h-[74px] bg-gradient-to-br from-emerald-950/80 via-stone-900 to-stone-900 border-emerald-600/80 hover:border-emerald-300 cursor-pointer transform active:scale-98 group"
                  >
                    <div className="flex items-center justify-between gap-1 leading-tight mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="font-serif font-bold text-emerald-200 text-xs truncate">
                          Catch Breath
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-950 text-emerald-300 rounded border border-emerald-600 font-bold shrink-0">
                        +2 EP
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400/90 leading-tight">
                      Regain +2 EP • +4 AC Defense
                    </div>
                    <div className="text-[9px] font-mono text-stone-400 truncate mt-0.5">
                      Absorbs {3 + (hero.equipment.shield?.armorBonus || hero.equipment.offhand?.armorBonus || 0)} Dmg (No Attack)
                    </div>
                  </button>
                )}

                {/* 3. Hero Spells & Class Skills */}
                {hero.skills.map((skill) => {
                  const canAfford = hero.currentMana >= skill.manaCost;
                  const detail = getSkillDetails(skill);

                  return (
                    <button
                      key={skill.id}
                      id={`btn-combat-skill-${skill.id}`}
                      onClick={() => handleHeroCastSkill(skill)}
                      disabled={!canAfford}
                      className={`p-2 sm:p-2.5 border-2 rounded-xl text-left transition-all flex flex-col justify-between shadow-md min-h-[68px] sm:min-h-[74px] ${
                        canAfford
                          ? 'bg-gradient-to-br from-purple-950/80 via-stone-900 to-stone-900 border-purple-600/80 hover:border-purple-300 cursor-pointer transform active:scale-98 group'
                          : 'bg-stone-950/40 border-stone-900 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 leading-tight mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Wand2 className="w-3.5 h-3.5 text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="font-serif font-bold text-purple-200 text-xs truncate">
                            {skill.name}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-purple-950 text-purple-300 rounded border border-purple-800 font-bold shrink-0">
                          {skill.manaCost} EP
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-purple-300/90 leading-tight truncate">
                        {detail.rollSubtitle || detail.boxLabel}
                      </div>
                      <div className="text-[9px] font-mono text-stone-400 truncate mt-0.5">
                        {detail.boxText}
                      </div>
                    </button>
                  );
                })}

                {/* 4. Attempt Tactical Escape (0 Energy) */}
                <button
                  id="btn-combat-flee"
                  onClick={handleAttemptFlee}
                  className="p-2 sm:p-2.5 border-2 rounded-xl text-left transition-all flex flex-col justify-between shadow-md min-h-[68px] sm:min-h-[74px] bg-gradient-to-br from-stone-900 via-stone-900 to-[#18120c] border-stone-600/80 hover:border-amber-400 cursor-pointer transform active:scale-98 group"
                >
                  <div className="flex items-center justify-between gap-1 leading-tight mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Footprints className="w-3.5 h-3.5 text-amber-300 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="font-serif font-bold text-stone-200 text-xs truncate">
                        Tactical Escape
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-950/80 text-emerald-300 rounded border border-emerald-700 font-bold shrink-0">
                      Free
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-stone-300 leading-tight">
                    Roll: 1d20{fleeMod >= 0 ? `+${fleeMod}` : fleeMod} vs DC {10 + monster.level}
                  </div>
                  <div className="text-[9px] font-mono text-stone-400 truncate mt-0.5">
                    Retreats to safe previous room
                  </div>
                </button>
              </div>

              {/* Combat Consumables in Pack */}
              {combatConsumables.length > 0 && (
                <div className="pt-2 border-t border-amber-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[10px] font-mono font-bold text-amber-400/80 uppercase shrink-0">
                    Potions:
                  </span>
                  {combatConsumables.map(({ inv, idx }) => (
                    <button
                      key={idx}
                      id={`btn-combat-item-${idx}`}
                      onClick={() => handleUseCombatItem(idx)}
                      className="px-2 py-0.5 bg-[#2a1a10] hover:bg-[#3d2718] text-amber-200 border border-[#6b4728] rounded text-[10px] font-serif flex items-center gap-1 cursor-pointer shadow shrink-0 transition-colors"
                    >
                      <Package className="w-3 h-3 text-amber-400" />
                      <span className="truncate max-w-[100px]">
                        {inv.item.name} {inv.quantity > 1 ? `(x${inv.quantity})` : ''}
                      </span>
                      {inv.item.healHp && (
                        <span className="text-[9px] font-mono text-emerald-400 font-bold">+{inv.item.healHp} HP</span>
                      )}
                      {inv.item.healMana && (
                        <span className="text-[9px] font-mono text-cyan-400 font-bold">+{inv.item.healMana} EP</span>
                      )}
                      {inv.item.damageDice && (
                        <span className="text-[9px] font-mono text-orange-400 font-bold">({inv.item.damageDice} Dmg)</span>
                      )}
                      {inv.item.id === 'scroll_of_teleport' && (
                        <span className="text-[9px] font-mono text-purple-400 font-bold">(Escape)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Attack Dice Rolling Animation Phase */}
          {combatStep === 'HERO_ATTACK_ROLLING' && (
            <div className="space-y-3">
              <DiceVisualizer
                currentRoll={currentRoll}
                isRolling={true}
                allowCustomDice={false}
                label="Rolling d20 Attack Check vs Armor Class..."
              />
              <p className="text-center text-xs text-amber-300/80 font-mono animate-pulse">
                Rolling 1d20 + Modifiers against Target Armor Class...
              </p>
            </div>
          )}

          {/* STEP 3: Hero Attack Result (SHOWS THE DICE RESULT BEFORE CLICKING TO CONTINUE WITH DAMAGE ROLL) */}
          {combatStep === 'HERO_ATTACK_RESULT' && pendingAttack && actionSummary && (
            <div className="bg-[#18120c]/95 border-2 border-amber-500 rounded-xl p-4 sm:p-5 shadow-2xl space-y-3 animate-fadeIn">
              {/* Clean header with action title only (duplications removed) */}
              <div className="border-b border-amber-900/60 pb-2">
                <h3 className="text-lg sm:text-xl font-serif font-bold text-amber-200">
                  {actionSummary.title}
                </h3>
              </div>

              {/* Visual Attack Dice Visualizer (clean header line + dice and total) */}
              <div className="py-1">
                <DiceVisualizer
                  currentRoll={pendingAttack.atkRoll}
                  isRolling={false}
                  allowCustomDice={false}
                  showFormulaBadge={false}
                  label={`Attack Roll (1d20 + ${pendingAttack.atkRoll.modifier}) vs AC ${effectiveMonsterAc}${acReductionBreakdown}`}
                />
              </div>

              {/* Critical Banners (Only if Nat 20 or Nat 1) */}
              {pendingAttack.isCrit && (
                <div className="p-2.5 bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-950 border border-yellow-500 rounded-lg text-yellow-200 text-xs font-serif flex items-center gap-2 shadow">
                  <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse shrink-0" />
                  <span><strong>Natural 20 Critical Hit!</strong> 2x Damage Multiplier + 3 Brutal Strike applied.</span>
                </div>
              )}

              {pendingAttack.isFumble && (
                <div className="p-2.5 bg-gradient-to-r from-red-950 via-amber-950 to-red-950 border border-red-500 rounded-lg text-red-200 text-xs font-serif flex items-center gap-2 shadow">
                  <AlertTriangle className="w-4 h-4 text-red-400 animate-bounce shrink-0" />
                  <span><strong>Natural 1 Critical Fumble!</strong> Stumbled & forfeit next turn.</span>
                </div>
              )}

              {/* Fate Reroll on Failed Attack (Blocked on Critical Fumbles) */}
              {!pendingAttack.isHit && (
                pendingAttack.isFumble ? (
                  <div className="p-3.5 bg-gradient-to-r from-red-950/70 via-[#210f0f] to-red-950/70 border-2 border-red-800/80 rounded-xl shadow-lg flex items-center gap-3 text-xs font-serif text-red-200">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <span className="font-bold text-red-300">Fate Cannot Alter a Critical Fumble (Natural 1):</span>
                      <p className="text-red-300/80 text-[11px] mt-0.5 leading-relaxed">
                        A Natural 1 represents an absolute, catastrophic blunder. Fate Rerolls cannot be spent to undo Critical Fumbles.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-gradient-to-r from-purple-950/80 via-[#261536] to-purple-950/80 border-2 border-purple-500/80 rounded-xl shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-200 font-bold text-xs sm:text-sm">
                        <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
                        <span>Defy Fate & Alter Destiny</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-purple-200 bg-purple-900/90 px-2.5 py-0.5 rounded-full border border-purple-400/60 shadow">
                        {hero.rerollTokens} {hero.rerollTokens === 1 ? 'Token' : 'Tokens'} Available
                      </span>
                    </div>

                    <p className="text-xs text-purple-300/90 font-serif">
                      Spend 1 Fate Reroll from your inventory to immediately re-roll this attack check.
                    </p>

                    <button
                      id="btn-use-fate-reroll-attack"
                      disabled={hero.rerollTokens <= 0}
                      onClick={handleFateRerollHeroAttack}
                      className={`w-full py-2.5 px-4 rounded-xl font-serif font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                        hero.rerollTokens > 0
                          ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] border border-purple-300/40'
                          : 'bg-stone-900/80 border border-stone-800 text-stone-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Dices className="w-4 h-4 text-purple-200" />
                      <span>
                        {hero.rerollTokens > 0
                          ? `✦ Use Fate Reroll (${hero.rerollTokens} Available)`
                          : 'No Fate Tokens in Inventory'}
                      </span>
                    </button>
                  </div>
                )
              )}

              {/* Progress Action Controls */}
              <div className="flex justify-end pt-2">
                {pendingAttack.isHit ? (
                  <button
                    id="btn-roll-damage"
                    onClick={handleHeroRollDamage}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 text-stone-950 font-black font-serif rounded-xl shadow-xl flex items-center gap-2 transition-all cursor-pointer transform hover:scale-105"
                  >
                    <Dices className="w-5 h-5" />
                    <span>
                      Roll Damage Dice ({pendingAttack.damageFormula}
                      {pendingAttack.damageBonus >= 0 ? `+${pendingAttack.damageBonus}` : pendingAttack.damageBonus}) ➔
                    </span>
                  </button>
                ) : (
                  <button
                    id="btn-continue-missed-enemy-turn"
                    onClick={handleProceedToEnemyTurn}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-stone-100 font-black font-serif rounded-xl shadow-xl flex items-center gap-2 transition-all cursor-pointer transform hover:scale-105"
                  >
                    Continue to Enemy Turn ➔
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Damage Dice Rolling Animation */}
          {combatStep === 'HERO_DAMAGE_ROLLING' && (
            <div className="space-y-3">
              <DiceVisualizer
                currentRoll={damageRoll}
                isRolling={true}
                allowCustomDice={false}
                label="Rolling Damage Dice..."
              />
              <p className="text-center text-xs text-amber-300/80 font-mono animate-pulse">
                Rolling weapon damage dice + modifiers...
              </p>
            </div>
          )}

          {/* STEP 5: Damage Roll Result & Next Step */}
          {combatStep === 'HERO_DAMAGE_RESULT' && actionSummary && (
            <div className="bg-[#18120c]/95 border-2 border-emerald-500 rounded-xl p-4 sm:p-5 shadow-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-amber-900/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-emerald-950 border border-emerald-600 text-emerald-300">
                    Damage Dealt
                  </span>
                  <h3 className="text-lg sm:text-xl font-serif font-bold text-amber-200">
                    {actionSummary.title}
                  </h3>
                </div>
                {actionSummary.damage !== undefined && (
                  <span className="font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 bg-red-950 rounded border border-red-700 text-red-300">
                    -{actionSummary.damage} HP
                  </span>
                )}
              </div>

              {/* Visual Damage Dice Visualizer (includes base dice + modifier, e.g. 1d8 + 4) */}
              {damageRoll && (() => {
                const dmgMod = damageRoll.modifier ?? pendingAttack?.damageBonus ?? 0;
                const dmgModStr = dmgMod !== 0 ? (dmgMod > 0 ? ` + ${dmgMod}` : ` - ${Math.abs(dmgMod)}`) : '';
                const baseDiceStr = pendingAttack?.damageFormula || (damageRoll ? `${damageRoll.individualRolls.length}d${damageRoll.diceSides}` : '1d8');

                return (
                  <div className="py-1">
                    <DiceVisualizer
                      currentRoll={damageRoll}
                      isRolling={false}
                      allowCustomDice={false}
                      showFormulaBadge={false}
                      label={`Damage Roll: ${baseDiceStr}${dmgModStr} (${actionSummary.damage} Damage Dealt)`}
                    />
                  </div>
                );
              })()}

              {/* Explicit Critical Hit Damage Banner (compact, only when Crit) */}
              {actionSummary.isCrit && (
                <div className="p-2.5 bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-950 border border-yellow-500 rounded-lg text-amber-200 text-xs font-serif flex items-center justify-between shadow">
                  <span className="flex items-center gap-1.5 text-yellow-300 font-bold">
                    <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse shrink-0" />
                    Critical Hit Multiplier Applied!
                  </span>
                  <span className="px-2 py-0.5 bg-yellow-950 border border-yellow-600 rounded text-yellow-200 font-mono text-[10px]">
                    2x Multiplier + 3 Brutal
                  </span>
                </div>
              )}

              {/* Progress Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {monster.hp > 0 && (
                  <button
                    id="btn-fate-reroll-damage"
                    disabled={hero.rerollTokens <= 0}
                    onClick={handleFateRerollHeroDamage}
                    className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-serif font-bold flex items-center justify-center gap-2 border shadow-md transition-all ${
                      hero.rerollTokens > 0
                        ? 'bg-purple-950/80 hover:bg-purple-900 border-purple-500/80 text-purple-200 cursor-pointer active:scale-95'
                        : 'bg-stone-900/80 border-stone-800 text-stone-500 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      hero.rerollTokens > 0
                        ? `Reroll damage dice (${hero.rerollTokens} Fate Tokens remaining)`
                        : 'No Fate Tokens available in inventory'
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      {hero.rerollTokens > 0
                        ? `✦ Fate Reroll Damage (${hero.rerollTokens} Available)`
                        : '0 Fate Tokens Available'}
                    </span>
                  </button>
                )}

                {monster.hp <= 0 ? (
                  <button
                    id="btn-victory-claim-spoils"
                    onClick={handleMonsterSlain}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 text-stone-950 font-black font-serif rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer transform hover:scale-105 ml-auto"
                  >
                    <Award className="w-5 h-5" />
                    <span>Victory! Claim Spoils & XP ➔</span>
                  </button>
                ) : (
                  <button
                    id="btn-continue-after-damage"
                    onClick={handleProceedToEnemyTurn}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-stone-100 font-black font-serif rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer transform hover:scale-105 ml-auto"
                  >
                    <span>Continue to Enemy Turn ➔</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Non-Damage Hero Action Result (e.g. Heal, Buff, Item, Flee Fail) */}
          {combatStep === 'HERO_NON_DAMAGE_RESULT' && actionSummary && (
            <div className="bg-[#18120c]/95 border-2 border-amber-500 rounded-xl p-4 sm:p-5 shadow-2xl space-y-3 animate-fadeIn">
              <div className="border-b border-amber-900/60 pb-2.5">
                <h3 className="text-lg sm:text-xl font-serif font-bold text-amber-200">
                  {actionSummary.title}
                </h3>
              </div>

              {/* Visual Action Dice Visualizer */}
              {currentRoll && (
                <div className="py-1">
                  <DiceVisualizer
                    currentRoll={currentRoll}
                    isRolling={false}
                    allowCustomDice={false}
                    showFormulaBadge={false}
                    label={actionSummary.title}
                  />
                </div>
              )}

              <div className="p-4 bg-stone-900/80 rounded-lg border border-amber-900/60 text-sm text-stone-200 leading-relaxed font-serif">
                {actionSummary.details}
              </div>

              {/* Fate Reroll on Failed Flee (Blocked on Critical Fumbles) */}
              {actionSummary.type === 'flee' && !actionSummary.isHit && (
                actionSummary.isFumble ? (
                  <div className="p-3.5 bg-gradient-to-r from-red-950/70 via-[#210f0f] to-red-950/70 border-2 border-red-800/80 rounded-xl shadow-lg flex items-center gap-3 text-xs font-serif text-red-200">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <span className="font-bold text-red-300">Fate Cannot Alter a Critical Fumble (Natural 1):</span>
                      <p className="text-red-300/80 text-[11px] mt-0.5 leading-relaxed">
                        Tripping on a Natural 1 cannot be reversed by Fate. You must recover your stance on the next turn.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-gradient-to-r from-purple-950/80 via-[#261536] to-purple-950/80 border-2 border-purple-500/80 rounded-xl shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-200 font-bold text-xs sm:text-sm">
                        <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
                        <span>Defy Fate & Alter Destiny</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-purple-200 bg-purple-900/90 px-2.5 py-0.5 rounded-full border border-purple-400/60 shadow">
                        {hero.rerollTokens} {hero.rerollTokens === 1 ? 'Token' : 'Tokens'} Available
                      </span>
                    </div>

                    <p className="text-xs text-purple-300/90 font-serif">
                      Spend 1 Fate Reroll to re-attempt your escape roll immediately before the enemy attacks!
                    </p>

                    <button
                      id="btn-fate-reroll-flee"
                      disabled={hero.rerollTokens <= 0}
                      onClick={handleFateRerollFlee}
                      className={`w-full py-2.5 px-4 rounded-xl font-serif font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                        hero.rerollTokens > 0
                          ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] border border-purple-300/40'
                          : 'bg-stone-900/80 border border-stone-800 text-stone-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Dices className="w-4 h-4 text-purple-200" />
                      <span>
                        {hero.rerollTokens > 0
                          ? `✦ Use Fate Reroll (${hero.rerollTokens} Available) - Reroll Escape`
                          : 'No Fate Tokens in Inventory'}
                      </span>
                    </button>
                  </div>
                )
              )}

              <div className="flex justify-end pt-2">
                <button
                  id="btn-proceed-enemy-from-support"
                  onClick={handleProceedToEnemyTurn}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-stone-100 font-black font-serif rounded-xl shadow-xl flex items-center gap-2 transition-all cursor-pointer transform hover:scale-105"
                >
                  Continue to Enemy Turn ➔
                </button>
              </div>
            </div>
          )}

          {/* Enemy Rolling Phase */}
          {combatStep === 'ENEMY_ROLLING' && (
            <div className="space-y-3">
              <DiceVisualizer
                currentRoll={currentRoll}
                isRolling={true}
                allowCustomDice={false}
                showFormulaBadge={false}
                label={`${monster.name} Strike (1d20 + ${monster.attackBonus})`}
              />
              <p className="text-center text-xs text-red-400 font-mono animate-pulse">
                {monster.name} is rolling attack against your AC {heroAc}...
              </p>
            </div>
          )}

          {/* STEP 6: Enemy Result Card with Fate Dodge and Explicit "Begin Round" Button */}
          {combatStep === 'ENEMY_RESULT' && actionSummary && (
            <div className="bg-[#18120c]/95 border-2 border-red-600 rounded-xl p-4 sm:p-5 shadow-2xl space-y-3 animate-fadeIn">
              {/* Clean header with action title only (duplications removed) */}
              <div className="border-b border-red-900/60 pb-2.5">
                <h3 className="text-lg sm:text-xl font-serif font-bold text-red-200">
                  {actionSummary.title}
                </h3>
              </div>

              {/* Visual Enemy Strike Dice Result (clean header line + dice and total) */}
              {currentRoll && (
                <div className="py-1">
                  <DiceVisualizer
                    currentRoll={currentRoll}
                    isRolling={false}
                    allowCustomDice={false}
                    showFormulaBadge={false}
                    label={`${monster.name} Attack Roll vs Hero AC ${heroAc}`}
                  />
                </div>
              )}

              {/* Stumbled Turn Skipping Notification */}
              {combat.heroStumbled && (
                <div className="p-2.5 bg-gradient-to-r from-red-950 via-amber-950 to-red-950 border border-red-500 rounded-lg text-red-200 text-xs font-serif flex items-center gap-2 shadow">
                  <AlertTriangle className="w-4 h-4 text-red-400 animate-bounce shrink-0" />
                  <span><strong>Stumbled & Off-Balance:</strong> You forfeit Round {combat.turnNumber} to steady your stance.</span>
                </div>
              )}

              {/* Monster Staggered Notification */}
              {combat.monsterStumbled && (
                <div className="p-2.5 bg-gradient-to-r from-emerald-950 via-[#132c1c] to-emerald-950 border border-emerald-500 rounded-lg text-emerald-200 text-xs font-serif flex items-center gap-2 shadow">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Enemy Staggered!</strong> Monster rolled Nat 1 Fumble — grants you +2 Advantage next round!</span>
                </div>
              )}

              {/* Fate Dodge Opportunity when Monster lands a Hit on Hero */}
              {actionSummary.type === 'monster' && actionSummary.isHit && (
                actionSummary.isCrit ? (
                  <div className="p-3 bg-red-950/60 border border-red-700/70 rounded-xl space-y-1 text-left">
                    <div className="flex items-center gap-2 text-red-300 font-bold text-xs sm:text-sm">
                      <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                      <span>Natural 20 Critical Strike — Fate Cannot Alter</span>
                    </div>
                    <p className="text-xs text-red-200/80 font-serif">
                      A Natural 20 critical blow cleaves through time and destiny. Fate Dodge cannot be invoked against an enemy critical hit.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-gradient-to-r from-purple-950/80 via-[#261536] to-purple-950/80 border-2 border-purple-500/80 rounded-xl shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-200 font-bold text-xs sm:text-sm">
                        <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
                        <span>Fate Dodge: Force Enemy Reroll</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-purple-200 bg-purple-900/90 px-2.5 py-0.5 rounded-full border border-purple-400/60 shadow">
                        {hero.rerollTokens} {hero.rerollTokens === 1 ? 'Token' : 'Tokens'} Available
                      </span>
                    </div>

                    <p className="text-xs text-purple-300/90 font-serif">
                      Spend 1 Fate Reroll to rewind the strike, restore the damage taken, and force {monster.name} to re-roll their attack against your AC {heroAc}!
                    </p>

                    <button
                      id="btn-fate-dodge-monster"
                      disabled={hero.rerollTokens <= 0}
                      onClick={handleFateDodgeMonster}
                      className={`w-full py-2.5 px-4 rounded-xl font-serif font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                        hero.rerollTokens > 0
                          ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] border border-purple-300/40'
                          : 'bg-stone-900/80 border border-stone-800 text-stone-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Shield className="w-4 h-4 text-purple-200" />
                      <span>
                        {hero.rerollTokens > 0
                          ? `✦ Use Fate Reroll (${hero.rerollTokens} Available) - Fate Dodge`
                          : 'No Fate Tokens in Inventory'}
                      </span>
                    </button>
                  </div>
                )
              )}

              {/* Progress Controls */}
              <div className="flex justify-end pt-2">
                {hero.currentHp <= 0 ? (
                  <div className="text-sm font-bold text-red-400 flex items-center gap-2">
                    <Skull className="w-5 h-5 animate-bounce" />
                    Hero has fallen...
                  </div>
                ) : monster.hp <= 0 ? (
                  <button
                    id="btn-claim-counter-victory"
                    onClick={handleMonsterSlain}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 text-stone-950 font-black font-serif rounded-xl shadow-xl flex items-center gap-2 transition-all cursor-pointer transform hover:scale-105 animate-pulse"
                  >
                    <Trophy className="w-5 h-5" />
                    <span>Claim Victory & Spoils ➔</span>
                  </button>
                ) : combat.heroStumbled ? (
                  <button
                    id="btn-forfeit-stumble-turn"
                    onClick={handleHeroRecoverStumble}
                    className="px-6 py-3 bg-gradient-to-r from-red-700 via-amber-700 to-red-700 hover:from-red-600 hover:to-amber-600 text-stone-100 font-black font-serif rounded-xl shadow-xl flex items-center gap-2 transition-all cursor-pointer transform hover:scale-105"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-300 animate-pulse" />
                    <span>⚠️ Forfeit Round {combat.turnNumber} to Recover Balance ➔</span>
                  </button>
                ) : (
                  <button
                    id="btn-begin-next-round"
                    onClick={handleBeginNextHeroRound}
                    className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-stone-950 font-black font-serif rounded-xl shadow-xl flex items-center gap-2 transition-all cursor-pointer transform hover:scale-105"
                  >
                    Begin Round {combat.turnNumber} (Your Turn) ➔
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 7: Successful Flee Result */}
          {combatStep === 'FLEE_RESULT' && actionSummary && (
            <div className="bg-[#18120c]/95 border-2 border-emerald-600 rounded-xl p-6 shadow-2xl space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-emerald-950 pb-3">
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-emerald-950 border border-emerald-600 text-emerald-300">
                  Tactical Retreat
                </span>
                <h3 className="text-xl font-serif font-bold text-emerald-200">
                  {actionSummary.title}
                </h3>
              </div>

              {/* Visual Flee Dice Result */}
              {currentRoll && (
                <div className="py-1">
                  <DiceVisualizer
                    currentRoll={currentRoll}
                    isRolling={false}
                    allowCustomDice={false}
                    label="Tactical Escape Check (1d20 + DEX)"
                  />
                </div>
              )}

              <div className="p-4 bg-stone-900/80 rounded-lg border border-emerald-900/60 text-sm text-stone-200 leading-relaxed font-serif">
                {actionSummary.details}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="btn-flee-retreat"
                  onClick={onCombatFlee}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 text-stone-950 font-black font-serif rounded-xl shadow-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Footprints className="w-5 h-5" />
                  Retreat to Previous Room
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Combat Log History */}
        <div className="bg-[#18120c]/90 border-2 border-stone-800 rounded-xl p-4 shadow-xl flex flex-col h-[480px]">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-3">
            <span className="text-xs font-mono font-bold text-stone-400 uppercase tracking-wider">
              Turn & Dice Combat Log
            </span>
            <span className="text-[10px] font-mono text-stone-500">
              {combat.combatLogs.length} entries
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            {combat.combatLogs.map((log) => {
              const isHero = log.sender === 'hero';
              const isMonster = log.sender === 'monster';

              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                    isHero
                      ? 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                      : isMonster
                      ? 'bg-red-950/30 border-red-800/40 text-red-200'
                      : 'bg-stone-900 border-stone-800 text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] text-stone-400 mb-1">
                    <span className="font-bold">{log.actionName}</span>
                    <span>Turn {log.turn}</span>
                  </div>
                  <div>{log.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
