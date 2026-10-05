/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Zap,
  Sparkles,
  Sun,
  ShieldAlert,
  Target,
  Dices,
  RefreshCw,
  UserCheck,
  Heart,
  Wand2,
  Check,
  ChevronRight,
  Coins,
  Key,
  Package,
  Sword,
  Flame,
  ArrowRight,
  Sparkle,
  Hammer,
  Shirt,
  ShieldCheck,
  Crown,
  Footprints,
  BookOpen,
} from 'lucide-react';
import { CharacterStats, HeroCharacter, HeroClassId, StatType } from '../types/game';
import { HERO_CLASSES } from '../data/classes';
import { ITEMS_DATABASE } from '../data/items';
import { syncHeroSupplies } from '../utils/inventory';
import { getHeroSkillsForLevel } from '../utils/skills';
import { STARTING_BOON_TABLE, StartingBoon, TableRow } from '../data/tables';
import { LookupTableRoller } from './LookupTableRoller';
import { roll4d6DropLowest, getStatModifier, RollResult } from '../utils/dice';
import { sounds } from '../utils/audio';
import { determineDestiny, Destiny, suggestName } from '../utils/destiny';

interface CharacterCreationProps {
  onCharacterCreated: (hero: HeroCharacter) => void;
}

type CreationStep = 'STATS_ROLL' | 'DESTINY_REVEAL' | 'BOON_ROLL' | 'FINALIZE';

const STAT_ORDER: { key: StatType; label: string; desc: string }[] = [
  { key: 'STR', label: 'Strength', desc: 'Melee weapon damage, physical checks & wall smash' },
  { key: 'DEX', label: 'Dexterity', desc: 'Agility, armor class bonus & trap disarm' },
  { key: 'CON', label: 'Constitution', desc: 'Health points, stamina & poison resilience' },
  { key: 'INT', label: 'Intelligence', desc: 'Arcane spell power, energy capacity & lore' },
  { key: 'LCK', label: 'Luck', desc: 'Critical strike chance & dungeon loot rolls' },
];

/**
 * Authentic Tabletop Pip Die Component - clean, no extra text
 */
const PipDie: React.FC<{
  value: number;
  isDropped?: boolean;
  isRolling?: boolean;
}> = ({ value, isDropped = false, isRolling = false }) => {
  const getPips = (val: number) => {
    switch (val) {
      case 1:
        return [{ cx: 50, cy: 50, color: '#dc2626', r: 12 }]; // Red center dot for 1
      case 2:
        return [
          { cx: 28, cy: 28, color: '#1c1917', r: 8 },
          { cx: 72, cy: 72, color: '#1c1917', r: 8 },
        ];
      case 3:
        return [
          { cx: 28, cy: 28, color: '#1c1917', r: 8 },
          { cx: 50, cy: 50, color: '#1c1917', r: 8 },
          { cx: 72, cy: 72, color: '#1c1917', r: 8 },
        ];
      case 4:
        return [
          { cx: 28, cy: 28, color: '#1c1917', r: 8 },
          { cx: 72, cy: 28, color: '#1c1917', r: 8 },
          { cx: 28, cy: 72, color: '#1c1917', r: 8 },
          { cx: 72, cy: 72, color: '#1c1917', r: 8 },
        ];
      case 5:
        return [
          { cx: 28, cy: 28, color: '#1c1917', r: 8 },
          { cx: 72, cy: 28, color: '#1c1917', r: 8 },
          { cx: 50, cy: 50, color: '#1c1917', r: 8 },
          { cx: 28, cy: 72, color: '#1c1917', r: 8 },
          { cx: 72, cy: 72, color: '#1c1917', r: 8 },
        ];
      case 6:
        return [
          { cx: 28, cy: 24, color: '#1c1917', r: 8 },
          { cx: 72, cy: 24, color: '#1c1917', r: 8 },
          { cx: 28, cy: 50, color: '#1c1917', r: 8 },
          { cx: 72, cy: 50, color: '#1c1917', r: 8 },
          { cx: 28, cy: 76, color: '#1c1917', r: 8 },
          { cx: 72, cy: 76, color: '#1c1917', r: 8 },
        ];
      default:
        return [{ cx: 50, cy: 50, color: '#1c1917', r: 8 }];
    }
  };

  const pips = getPips(Math.min(6, Math.max(1, value)));

  return (
    <div
      className={`relative flex items-center justify-center transition-all ${
        isDropped ? 'opacity-40 grayscale scale-90' : 'opacity-100 scale-100'
      }`}
    >
      <div
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#f5ebd7] border-2 border-[#543b24] shadow-md flex items-center justify-center relative overflow-hidden ${
          isRolling ? 'animate-bounce' : ''
        }`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full p-1 sm:p-1.5">
          {pips.map((p, idx) => (
            <circle
              key={idx}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill={isDropped ? '#9e8975' : p.color === '#dc2626' ? '#b91c1c' : '#2b1b11'}
            />
          ))}
        </svg>
        {isDropped && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-red-600 rotate-45 transform" />
            <div className="w-full h-0.5 bg-red-600 -rotate-45 transform absolute" />
          </div>
        )}
      </div>
    </div>
  );
};

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreated }) => {
  const [currentStep, setCurrentStep] = useState<CreationStep>('STATS_ROLL');

  // Currently active attribute in the footer selector (starts on STR)
  const [activeStatKey, setActiveStatKey] = useState<StatType>('STR');

  // Rolled Stats (4d6 drop lowest)
  const [stats, setStats] = useState<CharacterStats>({
    STR: 10,
    DEX: 10,
    CON: 10,
    INT: 10,
    LCK: 10,
  });

  const [rolledStatBreakdowns, setRolledStatBreakdowns] = useState<
    Record<StatType, { rolls: number[]; dropped: number; subtotal: number; total: number; droppedIndex: number }>
  >({} as any);

  // Dice rolling stages: 'idle' | 'tumbling' | 'landed' | 'dropped'
  const [isRollingCurrentStat, setIsRollingCurrentStat] = useState(false);
  const [rollStage, setRollStage] = useState<'idle' | 'tumbling' | 'landed' | 'dropped'>('idle');
  const [animatedDiceValues, setAnimatedDiceValues] = useState<number[]>([3, 4, 5, 2]);
  const [currentDroppedIndex, setCurrentDroppedIndex] = useState<number | null>(null);

  const rollIntervalRef = useRef<number | null>(null);
  const timer1Ref = useRef<number | null>(null);
  const timer2Ref = useRef<number | null>(null);
  const timer3Ref = useRef<number | null>(null);

  // Assigned Destiny & Class
  const [destinyDiagnosis, setDestinyDiagnosis] = useState<Destiny | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<HeroClassId>('warrior');

  // Boon table rolling state (1d6 table roll)
  const [rolledBoon, setRolledBoon] = useState<StartingBoon | null>(null);
  const [hasRolledBoon, setHasRolledBoon] = useState(false);
  const [boonTriggerRoll, setBoonTriggerRoll] = useState(0);
  const [isBoonRolling, setIsBoonRolling] = useState(false);

  // Character Name & Fate Tokens
  const [characterName, setCharacterName] = useState('Alden Ironbreaker');
  const [fateTokens, setFateTokens] = useState(1);

  const selectedClass =
    HERO_CLASSES.find((c) => c.id === selectedClassId) || HERO_CLASSES[0];

  const clearAllTimers = () => {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
    if (timer1Ref.current) {
      clearTimeout(timer1Ref.current);
      timer1Ref.current = null;
    }
    if (timer2Ref.current) {
      clearTimeout(timer2Ref.current);
      timer2Ref.current = null;
    }
    if (timer3Ref.current) {
      clearTimeout(timer3Ref.current);
      timer3Ref.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  // Auto-scroll active stat row into view so the user always sees the row being rolled
  useEffect(() => {
    if (currentStep !== 'STATS_ROLL') return;
    const cardEl = document.getElementById(`stat-card-${activeStatKey}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeStatKey, currentStep]);

  // Roll Single Stat (4d6 drop lowest with sequenced animation stages)
  const handleRollSingleStat = (statKey: StatType, isFateReroll = false) => {
    if (isRollingCurrentStat) return;
    if (isFateReroll && fateTokens <= 0) return;

    clearAllTimers();
    setActiveStatKey(statKey);
    setIsRollingCurrentStat(true);
    setRollStage('tumbling');
    setCurrentDroppedIndex(null);

    // Ensure the row being rolled is scrolled into view immediately
    const cardEl = document.getElementById(`stat-card-${statKey}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (isFateReroll) {
      setFateTokens((tokens) => Math.max(0, tokens - 1));
    }
    sounds.playDiceRoll();

    // 1. Rapid tumbling animation
    rollIntervalRef.current = window.setInterval(() => {
      setAnimatedDiceValues([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 45);

    // 2. Landed stage: Tumbling stops, reveal 4 landed numbers clean (none crossed out yet)
    timer1Ref.current = window.setTimeout(() => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }

      const rollRes = roll4d6DropLowest();
      const rawRolls = [...rollRes.rolls];

      // Identify lowest index
      let lowestIdx = 0;
      let lowestVal = rawRolls[0];
      for (let i = 1; i < rawRolls.length; i++) {
        if (rawRolls[i] < lowestVal) {
          lowestVal = rawRolls[i];
          lowestIdx = i;
        }
      }

      setAnimatedDiceValues(rawRolls);
      setRollStage('landed');

      // 3. Dropped stage: Slight delay, then cross out the lowest die with red cross
      timer2Ref.current = window.setTimeout(() => {
        setRollStage('dropped');
        setCurrentDroppedIndex(lowestIdx);
        sounds.playBlock();

        // 4. Settle stage: Slight delay, then reveal score and advance to next stat
        timer3Ref.current = window.setTimeout(() => {
          const finalTotal = rollRes.total;

          const newBreakdowns = {
            ...rolledStatBreakdowns,
            [statKey]: {
              rolls: rawRolls,
              dropped: lowestVal,
              subtotal: finalTotal,
              total: finalTotal,
              droppedIndex: lowestIdx,
            },
          };
          setRolledStatBreakdowns(newBreakdowns);

          const newStats = {
            ...stats,
            [statKey]: finalTotal,
          };
          setStats(newStats);

          setIsRollingCurrentStat(false);
          setRollStage('idle');
          sounds.playCoins();

          // Check if there is another unrolled stat
          const nextUnrolled = STAT_ORDER.find(
            (s) => s.key !== statKey && newBreakdowns[s.key] === undefined
          );

          const allRolled = STAT_ORDER.every((s) => newBreakdowns[s.key] !== undefined);

          if (allRolled) {
            sounds.playLevelUp();
          } else if (nextUnrolled) {
            setActiveStatKey(nextUnrolled.key);
          }
        }, 550);
      }, 500);
    }, 500);
  };

  // Reveal Destiny & Assigned Class based on rolled stats
  const handleRevealDestiny = () => {
    const keptDice = STAT_ORDER.flatMap(({ key }) => {
      const breakdown = rolledStatBreakdowns[key];
      return breakdown.rolls.filter((_, index) => index !== breakdown.droppedIndex);
    });
    const diagnosis = determineDestiny(stats, keptDice);
    setDestinyDiagnosis(diagnosis);
    setSelectedClassId(diagnosis.classId);
    setFateTokens(diagnosis.fateTokenCount);
    setCharacterName(suggestName(diagnosis.race.name));

    sounds.playLevelUp();
    setCurrentStep('DESTINY_REVEAL');
  };

  // Reset and reroll all attributes from scratch
  const handleRestartRolls = () => {
    clearAllTimers();
    sounds.playBlock();
    setRolledStatBreakdowns({} as any);
    setActiveStatKey('STR');
    setDestinyDiagnosis(null);
    setFateTokens(1);
    setRollStage('idle');
    setCurrentDroppedIndex(null);
    setAnimatedDiceValues([3, 4, 5, 2]);
    setIsRollingCurrentStat(false);
    setCurrentStep('STATS_ROLL');
  };

  // Handle Starting Boon Roll Complete
  const handleBoonRollComplete = (res: {
    roll: number;
    rollDetails: RollResult;
    selectedRow: TableRow<StartingBoon>;
  }) => {
    setRolledBoon(res.selectedRow.data);
    setHasRolledBoon(true);
    setIsBoonRolling(false);
    sounds.playCoins();
  };

  const handleRandomName = () => {
    if (!destinyDiagnosis) return;
    sounds.playCoins();
    setCharacterName(suggestName(destinyDiagnosis.race.name));
  };

  // Finalize Hero & Enter Dungeon
  const handleStartAdventure = () => {
    sounds.playLevelUp();

    const conMod = getStatModifier(stats.CON);
    const intMod = getStatModifier(stats.INT);
    const maxHp = selectedClass.hpFormula.base + Math.max(0, conMod * 2);
    const maxMana = selectedClass.manaFormula.base + Math.max(0, intMod * 3);

    const equipment: HeroCharacter['equipment'] = {};
    const inventory: HeroCharacter['inventory'] = [];

    // Starting Class Gear
    selectedClass.startingEquipment.forEach((itemId) => {
      const item = ITEMS_DATABASE[itemId];
      if (!item) return;

      if (item.type === 'weapon' && !equipment.weapon) {
        equipment.weapon = item;
      } else if (item.type === 'shield' && !equipment.offhand) {
        equipment.offhand = item;
      } else if (item.type === 'armor' && !equipment.armor) {
        equipment.armor = item;
      } else if (item.type === 'helmet' && !equipment.helmet) {
        equipment.helmet = item;
      } else if (item.type === 'boots' && !equipment.boots) {
        equipment.boots = item;
      } else if (item.type === 'ring' && !equipment.ring) {
        equipment.ring = item;
      } else if (item.type === 'amulet' && !equipment.amulet) {
        equipment.amulet = item;
      } else {
        inventory.push({ item, quantity: 1 });
      }
    });

    // Apply Boon
    let startingGold = selectedClass.startingGold;
    let extraRations = 3;
    let extraTorches = selectedClassId === 'rogue' ? 0 : 2;
    let extraRerollTokens = destinyDiagnosis
      ? destinyDiagnosis.fateTokenCount
      : selectedClassId === 'rogue'
      ? 2
      : 1;

    const activeBoon = rolledBoon || STARTING_BOON_TABLE.rows[0].data;

    if (activeBoon) {
      if (activeBoon.type === 'gold') startingGold += activeBoon.value;
      if (activeBoon.type === 'lockpicks') {
        startingGold += 15;
      }
      if (activeBoon.type === 'supplies') {
        extraRations += 3;
        extraTorches += 2;
      }
      if (activeBoon.type === 'tokens') extraRerollTokens += activeBoon.value;
      if (activeBoon.type === 'item' && activeBoon.itemId) {
        const boonItem = ITEMS_DATABASE[activeBoon.itemId];
        if (boonItem) {
          if (boonItem.type === 'amulet' && !equipment.amulet) {
            equipment.amulet = boonItem;
          } else {
            inventory.push({ item: boonItem, quantity: 1 });
          }
        }
      }
    }

    // Lockpicks: Rogue and Ranger receive a reusable lockpick set
    const alreadyHasLockpick = inventory.some((inv) => inv.item.id === 'iron_lockpick');
    const deservesLockpick =
      alreadyHasLockpick ||
      selectedClassId === 'rogue' ||
      selectedClassId === 'ranger' ||
      (activeBoon && activeBoon.type === 'lockpicks');
    if (deservesLockpick && !alreadyHasLockpick && ITEMS_DATABASE['iron_lockpick']) {
      inventory.push({ item: ITEMS_DATABASE['iron_lockpick'], quantity: 1 });
    }

    // Supplies into backpack
    for (let i = 0; i < extraRations; i++) {
      if (ITEMS_DATABASE['dungeon_ration']) {
        inventory.push({ item: ITEMS_DATABASE['dungeon_ration'], quantity: 1 });
      }
    }
    for (let i = 0; i < extraTorches; i++) {
      if (ITEMS_DATABASE['dungeon_torch']) {
        inventory.push({ item: ITEMS_DATABASE['dungeon_torch'], quantity: 1 });
      }
    }

    const hero: HeroCharacter = {
      name: characterName.trim() || 'Nameless Explorer',
      classId: selectedClass.id,
      destinyProfile: destinyDiagnosis
        ? {
            label: destinyDiagnosis.label,
            title: destinyDiagnosis.title,
            race: destinyDiagnosis.race.name,
            raceTrait: destinyDiagnosis.race.trait,
            summary: destinyDiagnosis.reason,
          }
        : undefined,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      currentHp: maxHp,
      maxHp,
      currentMana: maxMana,
      maxMana,
      stats: { ...stats },
      baseStats: { ...stats },
      equipment,
      inventory,
      maxInventorySlots: 15,
      gold: startingGold,
      rerollTokens: extraRerollTokens,
      rations: extraRations,
      torches: extraTorches,
      lockpicks: inventory.filter((inv) => inv.item.id === 'iron_lockpick').length,
      skills: getHeroSkillsForLevel(selectedClass.id, 1),
      activeEffects: [],
      statsHistory: {
        roomsExplored: 1,
        monstersSlain: 0,
        chestsOpened: 0,
        trapsDisarmed: 0,
        goldCollected: startingGold,
        highestDamageDealt: 0,
        critsRolled: 0,
        turnsSurvived: 0,
      },
    };

    syncHeroSupplies(hero);
    onCharacterCreated(hero);
  };

  const getClassIcon = (iconName: string) => {
    switch (iconName) {
      case 'Shield':
        return <Shield className="w-6 h-6" />;
      case 'Zap':
        return <Zap className="w-6 h-6" />;
      case 'Sparkles':
        return <Sparkles className="w-6 h-6" />;
      case 'Sun':
        return <Sun className="w-6 h-6" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-6 h-6" />;
      case 'Target':
        return <Target className="w-6 h-6" />;
      case 'Crown':
        return <Crown className="w-6 h-6" />;
      default:
        return <Sword className="w-6 h-6" />;
    }
  };


  const rolledCount = STAT_ORDER.filter((s) => rolledStatBreakdowns[s.key] !== undefined).length;
  const allRolled = rolledCount === STAT_ORDER.length;
  const activeStatDef = STAT_ORDER.find((s) => s.key === activeStatKey) || STAT_ORDER[0];
  const activeBreakdown = rolledStatBreakdowns[activeStatKey];
  const isCurrentStatRolled = activeBreakdown !== undefined;
  const nextStatToRoll = STAT_ORDER.find((s) => rolledStatBreakdowns[s.key] === undefined);

  // Active dice for display
  const displayDice = isRollingCurrentStat
    ? animatedDiceValues
    : activeBreakdown
    ? activeBreakdown.rolls
    : [3, 4, 5, 2];

  // Which die index is dropped
  const droppedIndexToShow = isRollingCurrentStat
    ? rollStage === 'dropped'
      ? currentDroppedIndex
      : null
    : activeBreakdown
    ? activeBreakdown.droppedIndex
    : null;

  return (
    <div className="h-full min-h-0 flex-1 w-full max-w-full flex flex-col overflow-hidden bg-[#0d0906] text-amber-100 font-sans selection:bg-amber-800 selection:text-amber-100">
      {/* Scrollable Content Container */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto scroll-smooth px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-5 pb-6 flex flex-col items-center">
        {/* Header */}
        <header className="max-w-4xl w-full text-center mb-4 shrink-0">
          <h1 className="text-3xl md:text-5xl font-black font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 tracking-wide drop-shadow-md">
            Roll your character
          </h1>
          <p className="text-sm md:text-base text-stone-400 mt-1 max-w-xl mx-auto font-serif italic">
            Roll 4d6 for each attribute, dropping the lowest value, to determine your character's class and characteristics.
          </p>

          {/* Step Indicator */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-4 max-w-2xl mx-auto">
            {[
              { id: 'STATS_ROLL', label: '1. Roll Attributes' },
              { id: 'DESTINY_REVEAL', label: '2. Assigned Calling' },
              { id: 'BOON_ROLL', label: '3. Roll Heirloom' },
              { id: 'FINALIZE', label: '4. Embark' },
            ].map((s, idx) => {
              const stepKeys = ['STATS_ROLL', 'DESTINY_REVEAL', 'BOON_ROLL', 'FINALIZE'];
              const isActive = currentStep === s.id;
              const isDone = stepKeys.indexOf(currentStep) > idx;

              return (
                <div
                  key={s.id}
                  className={`text-center py-2 px-2 rounded-lg text-xs font-mono border transition-all ${
                    isActive
                      ? 'bg-amber-900/60 border-amber-400 text-amber-200 font-bold shadow-md'
                      : isDone
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                      : 'bg-stone-900/40 border-stone-800 text-stone-500'
                  }`}
                >
                  <div className="truncate">{s.label}</div>
                </div>
              );
            })}
          </div>
        </header>

        {/* Main Content Steps */}
        <main className="max-w-4xl w-full flex-1 min-h-0 flex flex-col items-center justify-start">
        {/* ==================================================== */}
        {/* STEP 1: ROLL ATTRIBUTES (Scrollable Attribute Guide) */}
        {/* ==================================================== */}
        {currentStep === 'STATS_ROLL' && (
          <div className="w-full max-w-3xl space-y-2.5 animate-fadeIn">
            {/* 5 Attribute Cards (Clicking any selects it in the footer) */}
            <div className="space-y-2">
              {STAT_ORDER.map((item, idx) => {
                const statKey = item.key;
                const isRolled = rolledStatBreakdowns[statKey] !== undefined;
                const isSelected = activeStatKey === statKey;
                const value = stats[statKey];
                const modifier = getStatModifier(value);

                return (
                  <div
                    key={statKey}
                    id={`stat-card-${statKey}`}
                    onClick={() => {
                      setActiveStatKey(statKey);
                      sounds.playTileReveal();
                    }}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#2b1c10] border-amber-500 shadow-xl ring-2 ring-amber-500/40'
                        : isRolled
                        ? 'bg-[#1a120b] border-amber-800/60 hover:border-amber-700'
                        : 'bg-[#140d07] border-stone-800/80 hover:border-stone-700'
                    }`}
                  >
                    {/* Left: Stat Icon & Title & Fate Re-roll Button */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-serif font-black text-sm shrink-0 transition-all ${
                          isSelected
                            ? 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-400 text-stone-950 shadow-md'
                            : isRolled
                            ? 'bg-stone-900 border-amber-700 text-amber-300'
                            : 'bg-stone-950 border-stone-800 text-stone-500'
                        }`}
                      >
                        {statKey}
                      </div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-serif font-bold text-stone-200 text-sm sm:text-base">
                          {idx + 1}. {item.label}
                        </span>

                        {/* Button for fate re-roll (if re-roll token(s) are available and attribute is rolled) */}
                        {isRolled && fateTokens > 0 && (
                          <button
                            id={`btn-reroll-card-${statKey}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollSingleStat(statKey, true);
                            }}
                            disabled={isRollingCurrentStat}
                            className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-600 rounded-lg font-mono text-xs font-bold cursor-pointer shadow flex items-center gap-1.5 transition-all active:scale-95"
                            title={`Spend 1 Fate Token to reroll ${item.label}`}
                          >
                            <RefreshCw className="w-3 h-3 text-purple-400" />
                            <span>Fate Re-roll ({fateTokens})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: Rolled Value & Modifier */}
                    <div className="text-right pl-3 border-l border-stone-800 shrink-0 min-w-[70px]">
                      <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300 leading-none">
                        {isRolled ? value : '—'}
                      </div>
                      <div className="text-[10px] font-mono text-amber-400 font-bold mt-1">
                        {isRolled ? `${modifier >= 0 ? `+${modifier}` : modifier} Mod` : 'Pending'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 2: ASSIGNED DESTINY & LOADOUT REVEAL */}
        {/* ==================================================== */}
        {currentStep === 'DESTINY_REVEAL' && destinyDiagnosis && (
          <div className="w-full max-w-3xl bg-[#18120c]/95 border-2 border-amber-600 rounded-xl p-4 sm:p-6 shadow-2xl backdrop-blur-md text-amber-100 space-y-5 animate-fadeIn">
            {/* Header Banner */}
            <div className="border-b border-amber-900/60 pb-3 flex items-start justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-amber-950 border border-amber-600 text-amber-300">
                  {destinyDiagnosis.label}
                </span>
                <h3 className="text-xl sm:text-3xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mt-1 leading-tight">
                  {destinyDiagnosis.title}
                </h3>
                <p className="mt-1 text-xs text-stone-400 font-serif">{destinyDiagnosis.race.trait}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 grid place-items-center bg-amber-500/20 border border-amber-500 rounded-xl text-amber-400">
                {getClassIcon(selectedClass.icon)}
              </div>
            </div>

            {/* Narrative Reasoning Box */}
            <div className="p-4 bg-stone-950/80 rounded-xl border border-amber-900/70">
              <p className="text-sm font-serif text-stone-200 leading-relaxed italic">
                "{destinyDiagnosis.reason}"
              </p>
            </div>

            {/* Rolled Attributes Summary */}
            <div>
              <div className="text-xs font-mono text-stone-400 uppercase mb-1.5">YOUR FATED ABILITY SCORES</div>
              <div className="grid grid-cols-5 gap-2 text-center font-mono">
                {STAT_ORDER.map(({ key }) => {
                  const val = stats[key];
                  const mod = getStatModifier(val);
                  const isHigh = val >= 15;
                  const isLow = val <= 9;
                  return (
                    <div
                      key={key}
                      aria-label={`${key}: ${val}${isHigh ? ', high stat' : isLow ? ', low stat' : ''}`}
                      className={`p-2 rounded-lg border ${
                        isHigh
                          ? 'bg-emerald-950/70 border-emerald-600'
                          : isLow
                          ? 'bg-red-950/70 border-red-700'
                          : 'bg-stone-950/90 border-amber-950'
                      }`}
                    >
                      <div className="text-[10px] text-stone-400">{key}</div>
                      <div className={`text-base font-black ${isHigh ? 'text-emerald-300' : isLow ? 'text-red-300' : 'text-cyan-300'}`}>{val}</div>
                      <div className="text-[10px] font-bold text-amber-400">
                        {mod >= 0 ? `+${mod}` : mod}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assigned Starting Loadout */}
            <div className="p-4 bg-[#21160d] rounded-xl border border-amber-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Assigned Starting Equipment & Weaponry</span>
                </h4>
                <span className="text-xs font-mono text-yellow-300 font-bold">
                  {selectedClass.startingGold} Gold • {destinyDiagnosis.fateTokenCount} Fate Tokens
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedClass.gearHighlights.map((gear, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-stone-950/80 rounded-lg border border-amber-900/60 text-xs font-serif"
                  >
                    <div className="font-bold text-amber-200">{gear.name}</div>
                    <div className="text-[11px] text-stone-400">{gear.type}</div>
                    <div className="text-[11px] text-amber-300/90 font-mono mt-0.5">{gear.bonus}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Class Skills Preview */}
            <div className="space-y-2">
              <div className="text-xs font-mono text-stone-400 uppercase">
                CLASS COMBAT ABILITIES & SKILLS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedClass.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-2.5 bg-stone-950/70 rounded-lg border border-stone-800 text-xs font-serif"
                  >
                    <div className="font-bold text-amber-200 flex items-center justify-between">
                      <span>{skill.name}</span>
                      <span className="text-[10px] font-mono text-cyan-400">{skill.manaCost} EP</span>
                    </div>
                    <p className="text-[11px] text-stone-300 mt-1 leading-snug">
                      {skill.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 3: ROLL STARTING BOON / HEIRLOOM (1d6 Table Roll) */}
        {/* ==================================================== */}
        {currentStep === 'BOON_ROLL' && (
          <div className="w-full space-y-4">
            <LookupTableRoller<StartingBoon>
              table={STARTING_BOON_TABLE}
              title="Roll Starting Heirloom & Boon Table"
              subtitle="Roll 1d6 to inherit a family heirloom, extra gold, lockpicks, or protective amulets for your expedition."
              actionButtonLabel="Roll Heirloom Table (1d6)"
              canReroll={true}
              rerollTokens={fateTokens}
              onUseRerollToken={() => setFateTokens((t) => Math.max(0, t - 1))}
              onRollComplete={handleBoonRollComplete}
              hideHeaderButton={true}
              externalTrigger={boonTriggerRoll}
              onRollingStateChange={setIsBoonRolling}
            />
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 4: FINALIZE CHARACTER & ENTER DUNGEON */}
        {/* ==================================================== */}
        {currentStep === 'FINALIZE' && (
          <div className="w-full max-w-3xl bg-[#18120c]/95 border-2 border-amber-800/60 rounded-xl p-6 shadow-2xl backdrop-blur-md text-amber-100 space-y-6 animate-fadeIn">
            <div className="border-b border-amber-900/50 pb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="px-2.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 font-mono text-xs uppercase">
                  Character Sheet Ready
                </span>
                <h3 className="text-2xl font-bold font-serif text-amber-200 mt-1">
                  Name Your Adventurer
                </h3>
              </div>
              <div className="shrink-0 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500 text-amber-400">
                {getClassIcon(selectedClass.icon)}
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-amber-300/80 uppercase">
                Hero Name / Epithet
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="input-character-name"
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="flex-1 bg-stone-900/90 border-2 border-amber-800/80 rounded-lg px-4 py-2.5 text-amber-100 font-serif text-lg focus:outline-none focus:border-amber-400"
                  placeholder="Enter adventurer name..."
                />
                <button
                  id="btn-random-name"
                  onClick={handleRandomName}
                  className="px-3.5 py-2.5 bg-stone-900 hover:bg-stone-800 border border-amber-700/60 text-amber-300 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Random
                </button>
              </div>
            </div>

            {/* Character Snapshot Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-stone-900/80 border border-amber-900/60">
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] font-mono text-stone-400 uppercase">CLASS & CALLING</div>
                  <div className="text-lg font-serif font-black text-amber-200">
                    {destinyDiagnosis?.title || `${selectedClass.name} • ${selectedClass.title}`}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono text-stone-400 uppercase">ROLLED HEIRLOOM BOON</div>
                  <div className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{rolledBoon?.grantText || STARTING_BOON_TABLE.rows[0].data.grantText}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="text-[11px] font-mono text-stone-400 uppercase">STARTING WEALTH & SUPPLIES</div>
                  <div className="text-xs font-mono text-yellow-300 font-bold mt-0.5">
                    {selectedClass.startingGold + (rolledBoon?.type === 'gold' ? rolledBoon.value : 0)} Gold • {fateTokens} Fate Tokens • 3 Rations • {selectedClass.id === 'rogue' ? (rolledBoon?.type === 'supplies' ? '2 Torches (Boon)' : '0 Torches (Uses Spyglass)') : (rolledBoon?.type === 'supplies' ? '4 Torches' : '2 Torches')}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono text-stone-400 uppercase mb-1.5">ROLLED ABILITY SCORES</div>
                <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
                  {STAT_ORDER.map(({ key }) => {
                    const value = stats[key];
                    const isHigh = value >= 15;
                    const isLow = value <= 9;
                    const modifier = getStatModifier(value);
                    return (
                      <div
                        key={key}
                        aria-label={`${key}: ${value}${isHigh ? ', high stat' : isLow ? ', low stat' : ''}`}
                        className={`p-1.5 rounded-lg border ${
                          isHigh
                            ? 'bg-emerald-950/70 border-emerald-600'
                            : isLow
                            ? 'bg-red-950/70 border-red-700'
                            : 'bg-stone-950 border-stone-800'
                        }`}
                      >
                        <div className="text-[10px] text-stone-400">{key}</div>
                        <div className={`text-sm font-bold ${isHigh ? 'text-emerald-300' : isLow ? 'text-red-300' : 'text-amber-300'}`}>{value}</div>
                        <div className="text-[9px] text-stone-500">
                          {modifier >= 0 ? `+${modifier}` : modifier}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <div className="text-[11px] font-mono text-stone-400 uppercase mb-1">STARTING PACK & GEAR</div>
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono text-amber-300">
                    {selectedClass.startingEquipment.map((id) => (
                      <span key={id} className="px-1.5 py-0.5 bg-stone-950 rounded border border-stone-800">
                        {ITEMS_DATABASE[id]?.name || id}
                      </span>
                    ))}
                    {rolledBoon?.itemId && ITEMS_DATABASE[rolledBoon.itemId] && (
                      <span className="px-1.5 py-0.5 bg-purple-950 text-purple-300 rounded border border-purple-800">
                        {ITEMS_DATABASE[rolledBoon.itemId].name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>

      {/* ==================================================== */}
      {/* FIXED SAME-SIZE TABLETOP FOOTER (STEPS 1, 2, 3, 4) */}
      {/* ==================================================== */}
      <div className="shrink-0 z-40 w-full bg-[#160f09]/98 border-t-2 border-amber-800/80 shadow-[0_-12px_28px_rgba(0,0,0,0.95)] backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {currentStep === 'STATS_ROLL' && (
            <>
              {/* 1. Characteristic Buttons: Single line (STR=? / STR=13) */}
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {STAT_ORDER.map((item) => {
                  const isSelected = activeStatKey === item.key;
                  const isRolled = rolledStatBreakdowns[item.key] !== undefined;
                  const score = stats[item.key];
                  const label = `${item.key}=${isRolled ? score : '?'}`;

                  return (
                    <button
                      key={item.key}
                      id={`btn-select-stat-${item.key}`}
                      onClick={() => {
                        setActiveStatKey(item.key);
                        sounds.playTileReveal();
                      }}
                      className={`py-1.5 px-1 rounded-md border text-xs sm:text-sm font-mono font-bold text-center transition-all cursor-pointer whitespace-nowrap shadow-sm ${
                        isSelected
                          ? 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-300 text-stone-950 font-black shadow-md ring-1 ring-amber-400'
                          : isRolled
                          ? 'bg-[#22160d] border-amber-900/80 text-amber-200 hover:bg-[#2c1d12] hover:border-amber-700/80'
                          : 'bg-[#150d08] border-stone-800 text-stone-400 hover:border-amber-700/80 hover:text-stone-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* 2. Roll <STAT> Button: Single line */}
              <div className="w-full">
                {allRolled ? (
                  <button
                    id="btn-reveal-calling-destiny"
                    onClick={handleRevealDestiny}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-xl text-xs sm:text-sm cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] border-2 border-yellow-200 animate-pulse text-center"
                  >
                    Reveal Your Calling & Destiny ➔
                  </button>
                ) : isRollingCurrentStat ? (
                  <div className="w-full py-2 px-4 bg-[#26170d] text-amber-300 font-serif font-bold rounded-lg border border-amber-600/80 shadow text-xs sm:text-sm text-center animate-pulse flex items-center justify-center gap-2">
                    <Dices className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Rolling {activeStatDef.label}...</span>
                  </div>
                ) : isCurrentStatRolled ? (
                  <div className="flex gap-1.5 w-full">
                    {nextStatToRoll ? (
                      <button
                        id="btn-roll-next-attribute"
                        onClick={() => handleRollSingleStat(nextStatToRoll.key)}
                        className="flex-1 py-2 px-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 text-stone-950 font-serif font-black rounded-lg shadow-lg border border-amber-300 text-xs sm:text-sm text-center cursor-pointer transition-all"
                      >
                        Roll {nextStatToRoll.label} (4d6 drop lowest)
                      </button>
                    ) : null}

                    {fateTokens > 0 && (
                      <button
                        id={`btn-reroll-active-${activeStatKey}`}
                        onClick={() => handleRollSingleStat(activeStatKey, true)}
                        className="px-3 py-2 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-600 rounded-lg font-mono text-xs font-bold cursor-pointer shadow shrink-0 flex items-center gap-1"
                        title={`Spend 1 Fate Token to reroll ${activeStatDef.label}`}
                      >
                        <RefreshCw className="w-3 h-3 text-purple-400" />
                        <span>Reroll {activeStatKey}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    id={`btn-roll-attribute-${activeStatKey}`}
                    onClick={() => handleRollSingleStat(activeStatKey)}
                    className="w-full py-2 px-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-serif font-black rounded-lg shadow-lg text-xs sm:text-sm text-center cursor-pointer transition-all border border-amber-300/80"
                  >
                    Roll {activeStatDef.label} (4d6 drop lowest)
                  </button>
                )}
              </div>

              {/* 3. Dice Roll Pool: Just the actual dice, no text! */}
              <div className="flex items-center justify-center gap-2.5 sm:gap-3 py-0.5">
                {displayDice.map((dVal, idx) => (
                  <PipDie
                    key={idx}
                    value={dVal}
                    isDropped={droppedIndexToShow !== null && idx === droppedIndexToShow}
                    isRolling={isRollingCurrentStat && rollStage === 'tumbling'}
                  />
                ))}
              </div>
            </>
          )}

          {currentStep === 'DESTINY_REVEAL' && (
            <>
              {/* 1. Sub-bar: Reroll all / Fate tokens summary */}
              <div className="flex items-center justify-between text-xs font-mono px-1">
                <button
                  onClick={handleRestartRolls}
                  className="text-stone-400 hover:text-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-stone-400" />
                  <span>Reroll All Attributes</span>
                </button>
                <span className="text-amber-300 font-bold">
                  {selectedClass.name} • {destinyDiagnosis?.fateTokenCount ?? 1} Fate Tokens
                </span>
              </div>

              {/* 2. Primary CTA: "Accept calling" */}
              <button
                id="btn-confirm-destiny"
                onClick={() => setCurrentStep('BOON_ROLL')}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-xl text-xs sm:text-sm cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] border-2 border-yellow-200 flex items-center justify-center gap-2"
              >
                <span>Accept calling</span>
                <ChevronRight className="w-4 h-4 text-stone-950" />
              </button>

              {/* 3. Subtext matching Step 1 footer height */}
              <div className="flex items-center justify-center gap-2 text-xs text-stone-400 font-mono py-0.5">
                <span>Class Calling Assigned • Step 2 of 4</span>
              </div>
            </>
          )}

          {currentStep === 'BOON_ROLL' && (
            <>
              {/* 1. Sub-bar: Back to calling / Boon status */}
              <div className="flex items-center justify-between text-xs font-mono px-1">
                <button
                  onClick={() => setCurrentStep('DESTINY_REVEAL')}
                  className="text-stone-400 hover:text-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  ← Back to Calling
                </button>
                <span className="text-amber-300 font-bold truncate max-w-[220px]">
                  {hasRolledBoon && rolledBoon ? rolledBoon.name : '1d6 Procedural Heirloom'}
                </span>
              </div>

              {/* 2. Primary CTA: "Roll heirloom" or "Finalize Adventurer" */}
              {!hasRolledBoon ? (
                <button
                  id="btn-roll-heirloom-footer"
                  onClick={() => setBoonTriggerRoll((n) => n + 1)}
                  disabled={isBoonRolling}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-xl text-xs sm:text-sm cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] border-2 border-yellow-200 flex items-center justify-center gap-2"
                >
                  <Dices className={`w-4 h-4 ${isBoonRolling ? 'animate-spin text-stone-950' : ''}`} />
                  <span>{isBoonRolling ? 'Rolling Heirloom...' : 'Roll heirloom'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 w-full">
                  <button
                    id="btn-reroll-heirloom-footer"
                    onClick={() => {
                      if (fateTokens > 0) {
                        setFateTokens((t) => Math.max(0, t - 1));
                      }
                      setBoonTriggerRoll((n) => n + 1);
                    }}
                    disabled={isBoonRolling}
                    className="px-3 py-2 bg-[#22160d] hover:bg-[#2c1d12] border border-amber-900/80 text-amber-200 rounded-lg font-mono text-xs font-bold cursor-pointer shadow shrink-0 flex items-center gap-1"
                    title="Reroll on the heirloom table"
                  >
                    <RefreshCw className={`w-3 h-3 text-amber-400 ${isBoonRolling ? 'animate-spin' : ''}`} />
                    <span>Roll again</span>
                  </button>
                  <button
                    id="btn-confirm-boon"
                    onClick={() => setCurrentStep('FINALIZE')}
                    className="flex-1 py-2 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-lg text-xs sm:text-sm text-center cursor-pointer transition-all border border-yellow-200 flex items-center justify-center gap-2"
                  >
                    <span>Finalize Adventurer Details</span>
                    <ChevronRight className="w-4 h-4 text-stone-950" />
                  </button>
                </div>
              )}

              {/* 3. Subtext matching Step 1 footer height */}
              <div className="flex items-center justify-center gap-2 text-xs text-stone-400 font-mono py-0.5">
                {hasRolledBoon ? (
                  <span className="text-emerald-400">Heirloom Confirmed • Ready to Embark</span>
                ) : (
                  <span>Roll 1d6 on the procedural heirloom table above</span>
                )}
              </div>
            </>
          )}

          {currentStep === 'FINALIZE' && (
            <>
              {/* 1. Sub-bar: Back to heirloom / Name summary */}
              <div className="flex items-center justify-between text-xs font-mono px-1">
                <button
                  onClick={() => setCurrentStep('BOON_ROLL')}
                  className="text-stone-400 hover:text-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  ← Back to Heirloom
                </button>
                <span className="text-amber-300 font-bold truncate">
                  {characterName || 'Hero'} the {selectedClass.name}
                </span>
              </div>

              {/* 2. Primary CTA: "Enter the dungeon" */}
              <button
                id="btn-embark-adventure"
                onClick={handleStartAdventure}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-xl text-xs sm:text-sm cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] border-2 border-yellow-200 flex items-center justify-center gap-2 animate-pulse"
              >
                <UserCheck className="w-4 h-4 text-stone-950" />
                <span>Enter the dungeon</span>
                <ChevronRight className="w-4 h-4 text-stone-950" />
              </button>

              {/* 3. Subtext matching Step 1 footer height */}
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-amber-300/80 py-0.5">
                <span>Catacombs of Ur • Floor 1</span>
                <span>•</span>
                <span>{selectedClass.startingGold + (rolledBoon?.type === 'gold' ? rolledBoon.value : 0)} Gold</span>
                <span>•</span>
                <span>{fateTokens} Fate Tokens</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
