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
  Utensils,
  X,
  Table,
} from 'lucide-react';
import { CharacterStats, GameItem, HeroCharacter, HeroClassId, StatType } from '../types/game';
import { HERO_CLASSES } from '../data/classes';
import { ITEMS_DATABASE } from '../data/items';
import { canHeroEquipItem, syncHeroSupplies } from '../utils/inventory';
import { getHeroSkillsForLevel } from '../utils/skills';
import { LOOT_TABLE_CHEST, LootRewardResult, TableRow, lookupTableRow } from '../data/tables';
import { DieShape } from './DieShape';
import { roll4d6DropLowest, getStatModifier, RollResult } from '../utils/dice';
import { sounds } from '../utils/audio';
import { determineDestiny, Destiny, suggestName } from '../utils/destiny';

interface CharacterCreationProps {
  onCharacterCreated: (hero: HeroCharacter) => void;
}

export type CreationStep = 'STATS_ROLL' | 'DESTINY_REVEAL' | 'TREASURE_ROLL' | 'FINALIZE';

export interface RolledTreasureItem {
  id: string;
  rollIndex: number;
  roll: number;
  row: TableRow<LootRewardResult>;
  item: GameItem;
}

export function getStartingTreasureRollCount(lck: number): number {
  if (lck >= 16) return 4;
  if (lck >= 12) return 3;
  if (lck >= 8) return 2;
  return 1;
}

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

  // Starting Treasure Rolls state (X items based on LCK div 4: 16+=4, 12-15=3, 8-11=2, <=7=1)
  const [rolledTreasures, setRolledTreasures] = useState<RolledTreasureItem[]>([]);
  const [isTreasureRolling, setIsTreasureRolling] = useState(false);
  const [d20RollValue, setD20RollValue] = useState<number | null>(null);
  const [selectedSlotForReroll, setSelectedSlotForReroll] = useState<number | null>(null);
  const [showTreasureTableModal, setShowTreasureTableModal] = useState(false);
  const d20IntervalRef = useRef<number | null>(null);

  // Character Name & Fate Tokens
  const [characterName, setCharacterName] = useState('Alden Ironbreaker');
  const [fateTokens, setFateTokens] = useState(1);

  const selectedClass =
    HERO_CLASSES.find((c) => c.id === selectedClassId) || HERO_CLASSES[0];

  const treasureRollCount = getStartingTreasureRollCount(stats.LCK);
  const isAllTreasuresRolled = rolledTreasures.length >= treasureRollCount;
  const remainingTreasureRolls = Math.max(0, treasureRollCount - rolledTreasures.length);

  const clearAllTimers = () => {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
    if (d20IntervalRef.current) {
      clearInterval(d20IntervalRef.current);
      d20IntervalRef.current = null;
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

  // Close treasure table modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTreasureTableModal) {
        setShowTreasureTableModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTreasureTableModal]);

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
    setRolledTreasures([]);
    setD20RollValue(null);
    setSelectedSlotForReroll(null);
    setIsTreasureRolling(false);
    setShowTreasureTableModal(false);
    setCurrentStep('STATS_ROLL');
  };

  // Roll single treasure item on the 1d20 Loot Table with footer d20 tumbling animation
  const handleRollTreasureItem = (targetSlotIndex?: number) => {
    if (isTreasureRolling) return;
    setIsTreasureRolling(true);
    sounds.playDiceRoll();

    let cycles = 0;
    const maxCycles = 10;
    if (d20IntervalRef.current) clearInterval(d20IntervalRef.current);
    d20IntervalRef.current = window.setInterval(() => {
      const randomFace = Math.floor(Math.random() * 20) + 1;
      setD20RollValue(randomFace);
      cycles++;
      if (cycles >= maxCycles) {
        if (d20IntervalRef.current) {
          clearInterval(d20IntervalRef.current);
          d20IntervalRef.current = null;
        }
      }
    }, 50);

    setTimeout(() => {
      if (d20IntervalRef.current) {
        clearInterval(d20IntervalRef.current);
        d20IntervalRef.current = null;
      }
      const finalRoll = Math.floor(Math.random() * 20) + 1;
      setD20RollValue(finalRoll);
      setIsTreasureRolling(false);

      const row = lookupTableRow(LOOT_TABLE_CHEST, finalRoll);
      const item = row.data.itemId ? ITEMS_DATABASE[row.data.itemId] : null;
      if (item) {
        sounds.playLoot();
        const slotToUse =
          typeof targetSlotIndex === 'number'
            ? targetSlotIndex
            : selectedSlotForReroll !== null
            ? selectedSlotForReroll
            : rolledTreasures.length;

        if (slotToUse < rolledTreasures.length) {
          setRolledTreasures((prev) => {
            const next = [...prev];
            next[slotToUse] = {
              id: `slot-${slotToUse}-${Date.now()}`,
              rollIndex: slotToUse,
              roll: finalRoll,
              row,
              item,
            };
            return next;
          });
          setSelectedSlotForReroll(null);
        } else {
          setRolledTreasures((prev) => [
            ...prev,
            {
              id: `slot-${prev.length}-${Date.now()}`,
              rollIndex: prev.length,
              roll: finalRoll,
              row,
              item,
            },
          ]);
        }
      }
    }, 550);
  };

  const handleRollAllRemainingTreasures = () => {
    const needed = treasureRollCount - rolledTreasures.length;
    if (needed <= 0 || isTreasureRolling) return;
    sounds.playDiceRoll();
    const updated: RolledTreasureItem[] = [...rolledTreasures];
    let lastRoll = 20;
    for (let i = 0; i < needed; i++) {
      const roll = Math.floor(Math.random() * 20) + 1;
      lastRoll = roll;
      const row = lookupTableRow(LOOT_TABLE_CHEST, roll);
      const item = row.data.itemId ? ITEMS_DATABASE[row.data.itemId] : null;
      if (item) {
        updated.push({
          id: `slot-${updated.length}-${Date.now()}-${i}`,
          rollIndex: updated.length,
          roll,
          row,
          item,
        });
      }
    }
    setD20RollValue(lastRoll);
    setRolledTreasures(updated);
    sounds.playLoot();
  };

  const handleRerollTreasureSlot = (slotIdx: number) => {
    if (fateTokens <= 0 || isTreasureRolling) return;
    setFateTokens((tokens) => Math.max(0, tokens - 1));
    setSelectedSlotForReroll(slotIdx);
    handleRollTreasureItem(slotIdx);
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

    const tempHeroForCheck: HeroCharacter = {
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
      currentHp: 10,
      maxHp: 10,
      currentMana: 10,
      maxMana: 10,
      stats: { ...stats },
      baseStats: { ...stats },
      equipment: {},
      inventory: [],
      skills: [],
      activeEffects: [],
      maxInventorySlots: 15,
      gold: 0,
      rerollTokens: 1,
      rations: 1,
      torches: 1,
      lockpicks: 0,
      statsHistory: {
        roomsExplored: 1,
        monstersSlain: 0,
        chestsOpened: 0,
        trapsDisarmed: 0,
        goldCollected: 0,
        highestDamageDealt: 0,
        critsRolled: 0,
        turnsSurvived: 0,
      },
    };

    // 1. Class starting weapon & armour
    const classWeaponId = selectedClass.startingEquipment.find(
      (itemId) => ITEMS_DATABASE[itemId]?.type === 'weapon'
    );
    const classArmorId = selectedClass.startingEquipment.find(
      (itemId) => ITEMS_DATABASE[itemId]?.type === 'armor'
    );

    if (classWeaponId && ITEMS_DATABASE[classWeaponId]) {
      const weaponItem = ITEMS_DATABASE[classWeaponId];
      if (canHeroEquipItem(tempHeroForCheck, weaponItem, 'weapon').canEquip) {
        equipment.weapon = weaponItem;
      } else {
        // Cannot equip default starting weapon (e.g. Halfling/Gnome restrictions or low rolled stat)
        // Store class weapon in pack so player can trade or sell it
        inventory.push({ item: weaponItem, quantity: 1 });
        const heroRace = destinyDiagnosis?.race.name;
        if (heroRace === 'Halfling' && ITEMS_DATABASE['halfling_kukri']) {
          equipment.weapon = ITEMS_DATABASE['halfling_kukri'];
        } else if (heroRace === 'Gnome' && ITEMS_DATABASE['gnomish_clockwork_pistol']) {
          equipment.weapon = ITEMS_DATABASE['gnomish_clockwork_pistol'];
        } else if (
          ITEMS_DATABASE['iron_shortsword'] &&
          canHeroEquipItem(tempHeroForCheck, ITEMS_DATABASE['iron_shortsword'], 'weapon').canEquip
        ) {
          equipment.weapon = ITEMS_DATABASE['iron_shortsword'];
        } else if (ITEMS_DATABASE['rusty_dagger']) {
          equipment.weapon = ITEMS_DATABASE['rusty_dagger'];
        }
      }
    }

    if (classArmorId && ITEMS_DATABASE[classArmorId]) {
      equipment.armor = ITEMS_DATABASE[classArmorId];
    }

    // 2. Base supplies: exactly 1 torch and 1 salted beef ration
    if (ITEMS_DATABASE['dungeon_torch']) {
      inventory.push({ item: ITEMS_DATABASE['dungeon_torch'], quantity: 1 });
    }
    if (ITEMS_DATABASE['dungeon_ration']) {
      inventory.push({ item: ITEMS_DATABASE['dungeon_ration'], quantity: 1 });
    }

    // 3. Additional X items rolled from the treasure lookup table (where X is LCK div 4)
    const effectiveTreasures = [...rolledTreasures];
    while (effectiveTreasures.length < treasureRollCount) {
      const roll = Math.floor(Math.random() * 20) + 1;
      const row = lookupTableRow(LOOT_TABLE_CHEST, roll);
      const item = row.data.itemId ? ITEMS_DATABASE[row.data.itemId] : null;
      if (item) {
        effectiveTreasures.push({
          id: `slot-${effectiveTreasures.length}-${Date.now()}`,
          rollIndex: effectiveTreasures.length,
          roll,
          row,
          item,
        });
      }
    }

    effectiveTreasures.forEach((t) => {
      const item = t.item;
      // Auto-equip into empty gear slots if hero meets equip requirements
      if (
        item.type === 'shield' &&
        !equipment.offhand &&
        canHeroEquipItem(tempHeroForCheck, item, 'offhand').canEquip
      ) {
        equipment.offhand = item;
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

    const startingTokens = destinyDiagnosis
      ? destinyDiagnosis.fateTokenCount
      : 1;

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
      gold: selectedClass.startingGold,
      rerollTokens: startingTokens,
      rations: 1,
      torches: 1,
      lockpicks: inventory.filter((inv) => inv.item.id === 'iron_lockpick').length,
      skills: getHeroSkillsForLevel(selectedClass.id, 1),
      activeEffects: [],
      statsHistory: {
        roomsExplored: 1,
        monstersSlain: 0,
        chestsOpened: 0,
        trapsDisarmed: 0,
        goldCollected: selectedClass.startingGold,
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
              { id: 'TREASURE_ROLL', label: '3. Starting Treasure' },
              { id: 'FINALIZE', label: '4. Embark' },
            ].map((s, idx) => {
              const stepKeys = ['STATS_ROLL', 'DESTINY_REVEAL', 'TREASURE_ROLL', 'FINALIZE'];
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
            <div className="border-b border-amber-900/60 pb-3">
              <h3 className="text-xl sm:text-3xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mt-1 leading-tight">
                {destinyDiagnosis.title}
              </h3>
              <p className="mt-1 text-xs text-stone-400 font-serif">{destinyDiagnosis.race.trait}</p>
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
                  const isHigh = val >= 13;
                  const isLow = val <= 9;

                  return (
                    <div
                      key={key}
                      aria-label={`${key}: ${val}${isHigh ? ', high stat' : isLow ? ', low stat' : ''}`}
                      className={`p-2 rounded-lg border transition-all ${
                        isHigh
                          ? 'bg-emerald-950/70 border-emerald-500 ring-1 ring-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : isLow
                          ? 'bg-red-950/70 border-red-600 ring-1 ring-red-600/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                          : 'bg-stone-950/90 border-amber-950'
                      }`}
                    >
                      <div className="text-[10px] text-stone-400">{key}</div>
                      <div className={`text-base font-black ${isHigh ? 'text-emerald-300' : isLow ? 'text-red-300' : 'text-stone-200'}`}>
                        {val}
                      </div>
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
        {/* STEP 3: STARTING TREASURE ROLLS (LCK div 4 items) */}
        {/* ==================================================== */}
        {currentStep === 'TREASURE_ROLL' && (
          <div className="w-full space-y-4 max-w-3xl">
            {/* Header info */}
            <div className="bg-[#18120c]/95 border-2 border-amber-800/60 rounded-xl p-4 shadow-xl backdrop-blur-md text-amber-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold font-serif text-amber-200">
                  Starting Treasure Cache
                </h3>
                <p className="text-xs text-stone-300 font-serif mt-0.5">
                  Your Luck attribute entitles you to {treasureRollCount} bonus items rolled from the Dungeon Vault &amp; Chest table (LCK div 4, rounded down).
                </p>
              </div>

              {/* Icon button to view the lookup table */}
              <button
                id="btn-open-treasure-table-modal"
                type="button"
                onClick={() => setShowTreasureTableModal(true)}
                className="p-2 sm:px-3 sm:py-2 bg-stone-900/90 hover:bg-[#2c1d12] border border-amber-700/70 hover:border-amber-500 rounded-lg text-amber-300 font-mono text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all shrink-0"
                title="View Loot Table (1d20)"
                aria-label="View Loot Table"
              >
                <Table className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline font-bold">Loot Table</span>
              </button>
            </div>

            {/* Treasure Slots Grid */}
            <div className={`grid gap-2.5 ${treasureRollCount === 1 ? 'grid-cols-1' : treasureRollCount === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
              {Array.from({ length: treasureRollCount }).map((_, slotIdx) => {
                const rolled = rolledTreasures[slotIdx];
                const isNextSlot = !rolled && slotIdx === rolledTreasures.length;

                if (rolled) {
                  return (
                    <div
                      key={rolled.id || slotIdx}
                      className="p-3 bg-stone-950/90 rounded-xl border-2 border-amber-600/70 shadow-md flex flex-col justify-between gap-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono border-b border-stone-800 pb-1.5">
                        <span className="text-amber-400 font-bold">Slot #{slotIdx + 1}</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-200 font-bold border border-amber-700/60">
                          d20: {rolled.roll}
                        </span>
                      </div>

                      <div className="my-1">
                        <div className="font-serif font-bold text-sm text-amber-200 leading-snug">
                          {rolled.item.name}
                        </div>
                        <div className="text-[11px] text-amber-300/90 font-mono mt-0.5 line-clamp-2">
                          {rolled.row.subtitle || rolled.item.description}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-stone-900 text-xs">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-300">
                          {rolled.item.type}
                        </span>
                        {fateTokens > 0 && (
                          <button
                            onClick={() => handleRerollTreasureSlot(slotIdx)}
                            disabled={isTreasureRolling}
                            className="text-[11px] font-mono text-purple-300 hover:text-purple-100 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Reroll this slot using 1 Fate Token"
                          >
                            <RefreshCw className="w-3 h-3 text-purple-400" />
                            <span>Reroll</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={slotIdx}
                    className={`p-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-1.5 min-h-[110px] transition-all ${
                      isNextSlot
                        ? 'border-amber-500/80 bg-amber-950/20 text-amber-300 animate-pulse'
                        : 'border-stone-800 bg-stone-950/40 text-stone-500'
                    }`}
                  >
                    <Dices className="w-5 h-5 opacity-70" />
                    <div className="font-mono text-xs font-bold">
                      Slot #{slotIdx + 1} {isNextSlot ? '• Next Roll' : '• Pending'}
                    </div>
                    <div className="text-[11px] font-serif text-stone-400">
                      {isNextSlot ? 'Ready to roll 1d20' : 'Awaiting roll'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Treasure Table Modal behind icon */}
            {showTreasureTableModal && (
              <div
                id="treasure-table-modal-overlay"
                className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-fadeIn"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowTreasureTableModal(false);
                }}
              >
                <div className="bg-[#18120c] border-2 border-amber-800/80 rounded-2xl max-w-2xl w-full p-4 sm:p-5 text-amber-100 shadow-2xl relative max-h-[85vh] flex flex-col">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-amber-900/50 pb-3 mb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-700/60 text-amber-400">
                        <Table className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-serif font-black text-amber-200 leading-tight">
                          Dungeon Vault &amp; Chest Loot Table (1d20)
                        </h3>
                        <p className="text-xs text-amber-400/80 font-mono mt-0.5">
                          Roll 1d20 to determine each bonus starting item granted by Luck
                        </p>
                      </div>
                    </div>
                    <button
                      id="btn-close-treasure-table-modal"
                      onClick={() => setShowTreasureTableModal(false)}
                      className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                      title="Close table"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body: Loot Table Rows */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {LOOT_TABLE_CHEST.rows.map((row) => {
                      const rangeText =
                        row.minRoll === row.maxRoll
                          ? `[ ${row.minRoll} ]`
                          : `[ ${row.minRoll} - ${row.maxRoll} ]`;
                      const isRolled = rolledTreasures.some((t) => t.roll === row.minRoll);

                      return (
                        <div
                          key={row.id}
                          className={`p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between gap-3 ${
                            isRolled
                              ? 'bg-amber-900/40 border-amber-400 text-amber-100 shadow-md ring-1 ring-amber-400/50'
                              : 'bg-stone-900/50 border-stone-800/80 text-stone-300 hover:border-stone-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded text-xs shrink-0 ${
                                isRolled
                                  ? 'bg-amber-500 text-stone-950 font-black'
                                  : 'bg-stone-800 text-amber-400/80 border border-stone-700'
                              }`}
                            >
                              {rangeText}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className={`font-serif font-bold ${
                                    isRolled ? 'text-amber-200' : 'text-stone-200'
                                  }`}
                                >
                                  {row.name}
                                </span>
                                {row.badge && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 border border-stone-700 shrink-0">
                                    {row.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-stone-400 truncate">
                                {row.subtitle || row.description}
                              </p>
                            </div>
                          </div>

                          {isRolled && (
                            <div className="shrink-0 text-amber-400 flex items-center gap-1 font-mono text-[11px] font-bold">
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>Rolled</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
                  <div className="text-[11px] font-mono text-stone-400 uppercase">STARTING WEAPON & ARMOUR</div>
                  <div className="text-xs text-amber-200 font-semibold flex items-center gap-1.5 mt-0.5">
                    <Sword className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedClass.gearHighlights.map((g) => g.name).join(' • ')}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="text-[11px] font-mono text-stone-400 uppercase">STARTING SUPPLIES & WEALTH</div>
                  <div className="text-xs font-mono text-yellow-300 font-bold mt-0.5">
                    {selectedClass.startingGold} Gold • {fateTokens} Fate Tokens • 1 Salted Beef Ration • 1 Pitch Torch
                  </div>
                </div>

                <div className="pt-1">
                  <div className="text-[11px] font-mono text-stone-400 uppercase">BONUS TREASURE ITEMS ({rolledTreasures.length})</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rolledTreasures.map((t, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 text-[10px] font-mono">
                        [d20: {t.roll}] {t.item.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono text-stone-400 uppercase mb-1.5">ROLLED ABILITY SCORES</div>
                <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
                  {STAT_ORDER.map(({ key }) => {
                    const value = stats[key];
                    const isHigh = value >= 13;
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
                  <div className="text-[11px] font-mono text-stone-400 uppercase mb-1">ALL STARTING GEAR & PACK</div>
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono text-amber-300">
                    {selectedClass.startingEquipment.map((id) => (
                      <span key={id} className="px-1.5 py-0.5 bg-stone-950 rounded border border-stone-800">
                        {ITEMS_DATABASE[id]?.name || id}
                      </span>
                    ))}
                    {rolledTreasures.map((t, idx) => (
                      <span key={`treasure-${idx}`} className="px-1.5 py-0.5 bg-purple-950 text-purple-300 rounded border border-purple-800">
                        {t.item.name}
                      </span>
                    ))}
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
              {/* Primary CTA: "Accept calling" */}
              <button
                id="btn-confirm-destiny"
                onClick={() => setCurrentStep('TREASURE_ROLL')}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-xl text-xs sm:text-sm cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] border-2 border-yellow-200 flex items-center justify-center gap-2"
              >
                <span>Accept calling</span>
                <ChevronRight className="w-4 h-4 text-stone-950" />
              </button>

              {/* Subtext matching Step 1 footer height */}
              <div className="flex items-center justify-center gap-2 text-xs text-stone-400 font-mono py-0.5">
                <span>Class Calling Assigned • Step 2 of 4</span>
              </div>
            </>
          )}

          {currentStep === 'TREASURE_ROLL' && (
            <>
              {/* 1. Sub-bar: Back to calling / Treasure roll status */}
              <div className="flex items-center justify-between text-xs font-mono px-1">
                <button
                  onClick={() => setCurrentStep('DESTINY_REVEAL')}
                  className="text-stone-400 hover:text-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  ← Back to Calling
                </button>
                <span className="text-amber-300 font-bold truncate max-w-[260px]">
                  {rolledTreasures.length < treasureRollCount
                    ? `Rolling Item ${rolledTreasures.length + 1} of ${treasureRollCount} (1d20)`
                    : `${treasureRollCount} of ${treasureRollCount} Items Confirmed`}
                </span>
              </div>

              {/* 2. Primary CTA: "Roll treasure" or "Finalize Adventurer" */}
              {!isAllTreasuresRolled ? (
                <div className="flex items-center gap-2 w-full">
                  <button
                    id="btn-roll-treasure-footer"
                    onClick={() => handleRollTreasureItem()}
                    disabled={isTreasureRolling}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-xl text-xs sm:text-sm cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] border-2 border-yellow-200 flex items-center justify-center gap-2"
                  >
                    <Dices className={`w-4 h-4 ${isTreasureRolling ? 'animate-spin text-stone-950' : ''}`} />
                    <span>
                      {isTreasureRolling
                        ? 'Rolling 1d20...'
                        : `Roll Item ${rolledTreasures.length + 1} of ${treasureRollCount} (1d20)`}
                    </span>
                  </button>
                  {remainingTreasureRolls > 1 && (
                    <button
                      onClick={handleRollAllRemainingTreasures}
                      disabled={isTreasureRolling}
                      className="px-3 py-2 bg-[#22160d] hover:bg-[#2c1d12] border border-amber-900/80 text-amber-200 rounded-lg font-mono text-xs font-bold cursor-pointer shadow shrink-0 flex items-center gap-1"
                      title="Roll all remaining treasure items instantly"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Roll All ({remainingTreasureRolls})</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 w-full">
                  {fateTokens > 0 && (
                    <button
                      id="btn-reroll-treasure-footer"
                      onClick={() => {
                        const targetSlot = selectedSlotForReroll !== null ? selectedSlotForReroll : rolledTreasures.length - 1;
                        handleRerollTreasureSlot(targetSlot);
                      }}
                      disabled={isTreasureRolling}
                      className="px-3 py-2 bg-[#22160d] hover:bg-[#2c1d12] border border-amber-900/80 text-amber-200 rounded-lg font-mono text-xs font-bold cursor-pointer shadow shrink-0 flex items-center gap-1"
                      title="Spend 1 Fate Token to reroll"
                    >
                      <RefreshCw className={`w-3 h-3 text-amber-400 ${isTreasureRolling ? 'animate-spin' : ''}`} />
                      <span>Reroll Item</span>
                    </button>
                  )}
                  <button
                    id="btn-confirm-treasure"
                    onClick={() => setCurrentStep('FINALIZE')}
                    className="flex-1 py-2 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 text-stone-950 font-serif font-black rounded-lg shadow-lg text-xs sm:text-sm text-center cursor-pointer transition-all border border-yellow-200 flex items-center justify-center gap-2"
                  >
                    <span>Finalize Adventurer Details</span>
                    <ChevronRight className="w-4 h-4 text-stone-950" />
                  </button>
                </div>
              )}

              {/* 3. Dice Roll Animation in Footer Control Panel */}
              <div className="flex items-center justify-center gap-2.5 sm:gap-3 py-0.5 min-h-[36px]">
                <DieShape
                  sides={20}
                  value={d20RollValue !== null ? d20RollValue : 20}
                  isRolling={isTreasureRolling}
                  size="sm"
                />
                <span className="text-xs font-mono font-bold text-amber-300">
                  {isTreasureRolling
                    ? 'Rolling 1d20 on Table...'
                    : d20RollValue !== null
                    ? `d20 Rolled: ${d20RollValue}`
                    : '1d20 Treasure Die Ready'}
                </span>
              </div>
            </>
          )}

          {currentStep === 'FINALIZE' && (
            <>
              {/* 1. Sub-bar: Back to treasure / Name summary */}
              <div className="flex items-center justify-between text-xs font-mono px-1">
                <button
                  onClick={() => setCurrentStep('TREASURE_ROLL')}
                  className="text-stone-400 hover:text-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  ← Back to Treasure
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
                <span>{selectedClass.startingGold} Gold</span>
                <span>•</span>
                <span>{fateTokens} Fate Tokens</span>
                <span>•</span>
                <span>1 Torch • 1 Ration</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
