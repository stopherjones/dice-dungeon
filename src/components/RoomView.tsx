/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Skull,
  Package,
  Store,
  Tent,
  Sun,
  AlertTriangle,
  HelpCircle,
  Footprints,
  Key,
  Shield,
  ShieldAlert,
  Flame,
  Sparkles,
  Heart,
  Wand2,
  Crown,
  Eye,
  Hammer,
  Zap,
} from 'lucide-react';
import { DungeonFloor, DungeonRoom, GameItem, HeroCharacter, StatType } from '../types/game';
import { DiceVisualizer } from './DiceVisualizer';
import { LootRollerModal } from './LootRollerModal';
import { ActionChallengeModal, ActionChallengeConfig } from './ActionChallengeModal';
import { rollDice, getStatModifier, RollResult } from '../utils/dice';
import { sounds } from '../utils/audio';
import { addItemToHero, removeItemFromHero, syncHeroSupplies, canHeroUseItem } from '../utils/inventory';

export interface RoomPrimaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface RoomViewProps {
  floor: DungeonFloor;
  room: DungeonRoom;
  hero: HeroCharacter;
  onUpdateHero: (hero: HeroCharacter) => void;
  onUpdateRoom: (room: DungeonRoom) => void;
  onEnterCombat: (room: DungeonRoom) => void;
  onOpenMerchant: () => void;
  onUseTorch?: (targetRoomId: string) => void;
  onSmashWall: (wallId: string, item: GameItem) => void;
  onPhaseThroughWall: (targetRoomId: string, item?: GameItem) => void;
  onDescendFloor: () => void;
  onOpenInventory?: () => void;
  onClose?: () => void;
  onPrimaryActionChange: (action: RoomPrimaryAction | null) => void;
}

export const RoomView: React.FC<RoomViewProps> = ({
  floor,
  room,
  hero,
  onUpdateHero,
  onUpdateRoom,
  onEnterCombat,
  onOpenMerchant,
  onUseTorch,
  onSmashWall,
  onPhaseThroughWall,
  onDescendFloor,
  onOpenInventory,
  onClose,
  onPrimaryActionChange,
}) => {
  const [currentRoll, setCurrentRoll] = useState<RollResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [selectedTrapStat, setSelectedTrapStat] = useState<StatType | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [lootSourceTitle, setLootSourceTitle] = useState('Iron Vault Chest');
  const [lootSourceDesc, setLootSourceDesc] = useState('Opening the reinforced dungeon chest...');
  const [pendingGuaranteedGold, setPendingGuaranteedGold] = useState(0);
  const [pendingBonusItems, setPendingBonusItems] = useState<GameItem[]>([]);

  // Action Challenge Modal State for focused full-screen action resolution
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeConfig, setChallengeConfig] = useState<ActionChallengeConfig | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedTrapStat(null);
  }, [room.id]);

  // Scroll to top of modal container whenever room events, traps, chests, or rolls occur
  useEffect(() => {
    if (containerRef.current) {
      const scrollParent = containerRef.current.closest('.overflow-y-auto');
      if (scrollParent) {
        scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [
    eventMessage,
    room.trap?.disarmed,
    room.trap?.triggered,
    room.chest?.isOpened,
    room.chest?.isJammed,
    room.chest?.isFailed,
    room.shrineUsed,
    room.secretFound,
    room.isLooted,
    currentRoll,
  ]);

  // Check inventory for wall tools (verifying hero meets class and stat requirements)
  const hasBreachingTool = hero.inventory.find(
    (i) =>
      i.item.specialEffect === 'SMASH_WALL' &&
      (i.chargesLeft ?? i.item.charges ?? 1) > 0 &&
      canHeroUseItem(hero, i.item).canUse
  );
  const hasPhasingPotion = hero.inventory.find(
    (i) => i.item.id === 'potion_of_phasing' && i.quantity > 0 && canHeroUseItem(hero, i.item).canUse
  );
  const isWearingEtherealRing = hero.equipment.ring?.id === 'ethereal_ring';

  // Usable lockpicks check (must meet class requirements e.g. Rogue/Jester/Hero)
  const usablePicks = hero.inventory.find(
    (i) => i.item.id === 'iron_lockpick' && canHeroUseItem(hero, i.item).canUse
  );
  const unusablePicks = hero.inventory.find(
    (i) => i.item.id === 'iron_lockpick' && !canHeroUseItem(hero, i.item).canUse
  );
  const hasPicks = Boolean(usablePicks);
  const canPickLock = hasPicks;

  const heroStats = { ...hero.stats };
  (Object.values(hero.equipment) as (GameItem | undefined)[]).forEach((item) => {
    if (!item?.statBonuses) return;
    if (item.statBonuses.STR) heroStats.STR += item.statBonuses.STR;
    if (item.statBonuses.DEX) heroStats.DEX += item.statBonuses.DEX;
    if (item.statBonuses.CON) heroStats.CON += item.statBonuses.CON;
    if (item.statBonuses.INT) heroStats.INT += item.statBonuses.INT;
    if (item.statBonuses.LCK) heroStats.LCK += item.statBonuses.LCK;
  });

  // Chest: Pick Lock (DEX) via Focused Modal (Requires usable lockpick kit)
  const handlePickChestLock = () => {
    if (!room.chest || room.chest.isOpened || room.chest.isFailed || room.chest.isJammed) return;
    if (!canPickLock) {
      sounds.playBlock();
      setEventMessage(
        unusablePicks
          ? `✖ Cannot use Thieves' Lockpick Kit: Requires Rogue, Jester, or Hero class. Bash the chest open with STR instead!`
          : `✖ You need a Thieves' Lockpick Kit to pick locks. Bash the chest open with STR instead!`
      );
      return;
    }

    const bonus = getStatModifier(heroStats.DEX) + 3;

    setChallengeConfig({
      type: 'CHEST_PICK',
      title: 'Pick Lock on Iron Chest Vault',
      subtitle:
        'You insert your reusable masterwork lockpicks into the heavy iron tumbler, carefully testing each pin against the tension wrench.',
      iconType: 'chest',
      stat: 'DEX',
      dc: room.chest.lockDifficulty,
      bonus,
      bonusBreakdown: `DEX Mod (${getStatModifier(heroStats.DEX)}) + Reusable Lockpick Kit (+3)`,
      successOutcomeTitle: 'Tumbler Unlocked!',
      successOutcomeDesc: `With a satisfying mechanical click, the iron chest springs open! Ready to collect your spoils.`,
      failureOutcomeTitle: 'Lockpick Slipped',
      failureOutcomeDesc: `The stubborn pins seized up and jammed tight. The breach attempt has been abandoned.`,
      onSuccess: () => {
        if (room.chest) {
          room.chest.isLocked = false;
        }
        setLootSourceTitle('Lock Picked: Iron Chest Vault');
        setLootSourceDesc('With a satisfying click, the heavy tumbler turns! Revealing the treasure within.');
        setPendingGuaranteedGold(room.chest?.gold || 15);
        setPendingBonusItems(room.chest?.items || []);
        setShowLootModal(true);
        onUpdateRoom({ ...room });
      },
      onFailure: () => {
        if (room.chest) {
          room.chest.isFailed = true;
          room.chest.isJammed = true;
        }
        setEventMessage(`✖ Lockpick slipped & mechanism jammed! The chest cannot be opened.`);
        onUpdateRoom({ ...room });
      },
    });
    setShowChallengeModal(true);
  };

  // Chest: Force Open (STR) via Focused Modal
  const handleForceChest = () => {
    if (!room.chest || room.chest.isOpened || room.chest.isFailed || room.chest.isJammed) return;

    const bonus = getStatModifier(heroStats.STR);
    const dc = room.chest.lockDifficulty + 2;

    setChallengeConfig({
      type: 'CHEST_BASH',
      title: 'Smash Open Iron Chest Vault',
      subtitle:
        'You raise your weapon and strike with violent force at the reinforced latch and hinges.',
      iconType: 'smash',
      stat: 'STR',
      dc,
      bonus,
      bonusBreakdown: `STR Mod (${bonus})`,
      successOutcomeTitle: 'Iron Latch Splintered!',
      successOutcomeDesc:
        'Your strike shatters the locking mechanism completely! The heavy iron lid pops open.',
      failureOutcomeTitle: 'Recoil Shock & Latch Jammed!',
      failureOutcomeDesc:
        'The hardened iron chest deflects your blow with an echoing ring. The latch is warped and ruined! You take 2 recoil damage.',
      onSuccess: () => {
        if (room.chest) {
          room.chest.isLocked = false;
        }
        setLootSourceTitle('Smashed Open: Iron Chest');
        setLootSourceDesc('You splinter the iron latch with brute force! Revealing the vault contents.');
        setPendingGuaranteedGold(room.chest?.gold || 15);
        setPendingBonusItems(room.chest?.items || []);
        setShowLootModal(true);
        onUpdateRoom({ ...room });
      },
      onFailure: () => {
        if (room.chest) {
          room.chest.isFailed = true;
          room.chest.isJammed = true;
        }
        hero.currentHp = Math.max(1, hero.currentHp - 2);
        setEventMessage('✖ Failed to bash! The chest latch seized tight. Lost 2 HP from recoil.');
        onUpdateHero({ ...hero });
        onUpdateRoom({ ...room });
      },
    });
    setShowChallengeModal(true);
  };

  // Chest: Open Directly (if unlocked)
  const handleOpenUnlockedChest = () => {
    if (!room.chest || room.chest.isOpened) return;
    setLootSourceTitle('Dungeon Vault Chest');
    setLootSourceDesc('Lifting the creaking lid to reveal the hidden relics...');
    setPendingGuaranteedGold(room.chest.gold || 15);
    setPendingBonusItems(room.chest.items || []);
    setShowLootModal(true);
  };

  // Handle Loot Claim
  const handleClaimChestLoot = (goldEarned: number, itemsEarned: GameItem[]) => {
    if (room.chest) {
      room.chest.isOpened = true;
      room.chest.isLocked = false;
    }
    hero.gold += goldEarned;
    hero.statsHistory.chestsOpened += 1;
    hero.statsHistory.goldCollected += goldEarned;

    itemsEarned.forEach((item) => {
      addItemToHero(hero, item, 1);
    });
    syncHeroSupplies(hero);

    setShowLootModal(false);
    setEventMessage(
      `✦ Claimed ${goldEarned} Gold and ${itemsEarned.map((i) => i.name).join(', ') || 'valuable items'}!`
    );
    onUpdateHero({ ...hero });
    onUpdateRoom({ ...room });
  };

  // Trap: Disarm with chosen stat (DEX / INT / STR / LCK) via Focused Modal
  const handleDisarmTrap = (stat: StatType = 'DEX') => {
    if (!room.trap || room.trap.disarmed) return;

    const bonus = getStatModifier(heroStats[stat]);

    const statName =
      stat === 'DEX'
        ? 'Dexterity'
        : stat === 'INT'
        ? 'Intelligence'
        : stat === 'STR'
        ? 'Strength'
        : 'Luck';

    setChallengeConfig({
      type: 'TRAP_DISARM',
      title: `Disarm ${room.trap.name}`,
      subtitle: room.trap.description,
      iconType: 'trap',
      stat,
      dc: room.trap.difficulty,
      bonus,
      bonusBreakdown: `${statName} Mod (${bonus >= 0 ? `+${bonus}` : bonus})`,
      successOutcomeTitle: 'Trap Neutralized!',
      successOutcomeDesc: `You carefully dismantle the trigger mechanism and sever the tripwires. Gained +20 XP!`,
      failureOutcomeTitle: 'Trap Sprung!',
      failureOutcomeDesc: `A click rings out as the trigger springs! The trap remains armed and active until disarmed.`,
      onSuccess: () => {
        if (room.trap) {
          room.trap.disarmed = true;
        }
        hero.statsHistory.trapsDisarmed += 1;
        hero.xp += 20;
        setEventMessage(`✦ Trap Neutralized! Safe passage secured. Gained +20 XP.`);
        onUpdateHero({ ...hero });
        onUpdateRoom({ ...room });
      },
      onFailure: () => {
        if (room.trap) {
          room.trap.triggered = true;
          room.trap.disarmed = false;
        }
        const dmgRoll = rollDice(1, 8, 2);
        hero.currentHp = Math.max(0, hero.currentHp - dmgRoll.total);
        setEventMessage(`✖ Trap Sprung! Took ${dmgRoll.total} damage. The trap remains ARMED and ACTIVE until disarmed.`);
        onUpdateHero({ ...hero });
        onUpdateRoom({ ...room });
      },
    });
    setShowChallengeModal(true);
  };

  // Shrine: Pray
  const handlePrayAtShrine = () => {
    if (!room.shrine || room.shrine.used) return;
    sounds.playSpell();
    room.shrine.used = true;
    hero.currentHp = Math.min(hero.maxHp, hero.currentHp + 15);
    hero.currentMana = Math.min(hero.maxMana, hero.currentMana + 12);
    setEventMessage(`✦ The blessing of ${room.shrine.god} envelopes you! Restored 15 HP & 12 Energy.`);
    onUpdateHero({ ...hero });
    onUpdateRoom({ ...room });
  };

  // Secret: Search walls (INT / LCK) via Focused Modal
  const handleSearchSecret = () => {
    if (!room.secret || room.secret.discovered || room.secret.isFailed) return;

    const useInt = getStatModifier(heroStats.INT) >= getStatModifier(heroStats.LCK);
    const chosenStat: StatType = useInt ? 'INT' : 'LCK';
    const bonus = getStatModifier(heroStats[chosenStat]);

    setChallengeConfig({
      type: 'ROOM_SEARCH',
      title: 'Investigate Chamber for Hidden Vaults',
      subtitle:
        'You run your fingers along the stone masonry, inspecting floor grooves and mortar seams for concealed mechanisms.',
      iconType: 'search',
      stat: chosenStat,
      dc: room.secret.difficulty,
      bonus,
      bonusBreakdown: `${chosenStat} Mod (${bonus})`,
      successOutcomeTitle: 'Hidden Stash Discovered!',
      successOutcomeDesc:
        'A hollow block clicks inward, swinging open a hidden alcove containing ancient coins and treasures!',
      failureOutcomeTitle: 'Nothing Found',
      failureOutcomeDesc:
        'After thoroughly tapping the walls and cobblestones, you found no secret mechanisms. Search abandoned.',
      onSuccess: () => {
        if (room.secret) {
          room.secret.discovered = true;
          room.secret.rewardClaimed = true;
        }
        setLootSourceTitle('Secret Masonry Vault');
        setLootSourceDesc('A hidden switch swings back a false wall, revealing an ancient cache!');
        setPendingGuaranteedGold(25);
        setPendingBonusItems([]);
        setShowLootModal(true);
        onUpdateRoom({ ...room });
      },
      onFailure: () => {
        if (room.secret) {
          room.secret.isFailed = true;
        }
        setEventMessage('✖ Search failed & abandoned! You found no secret compartments in these walls.');
        onUpdateRoom({ ...room });
      },
    });
    setShowChallengeModal(true);
  };

  const primaryAction = room.monster && room.monster.hp > 0
    ? { label: 'Draw Weapon & Enter Combat', onClick: () => onEnterCombat(room) }
    : room.trap && !room.trap.disarmed
    ? {
        label: selectedTrapStat ? 'Attempt to Deactivate Trap' : 'Select a Trap Approach',
        onClick: () => selectedTrapStat && handleDisarmTrap(selectedTrapStat),
        disabled: !selectedTrapStat,
      }
    : room.hasStairs && (!room.monster || room.monster.hp <= 0)
    ? { label: floor.floorNumber === 3 ? 'Claim Victory' : `Descend to Floor ${floor.floorNumber + 1}`, onClick: onDescendFloor }
    : room.chest && !room.chest.isOpened && !room.chest.isFailed && !room.chest.isJammed
    ? room.chest.isLocked
      ? canPickLock
        ? { label: 'Pick Chest Lock (DEX)', onClick: handlePickChestLock }
        : { label: 'Bash Open Chest (STR)', onClick: handleForceChest }
      : { label: 'Open Chest for Treasure', onClick: handleOpenUnlockedChest }
    : room.type === 'MERCHANT'
    ? { label: 'Trade with Olaf', onClick: onOpenMerchant }
    : room.shrine && !room.shrine.used
    ? { label: 'Pray for Divine Blessing', onClick: handlePrayAtShrine }
    : room.secret && !room.secret.discovered && !room.secret.isFailed
    ? { label: 'Search for Hidden Treasure', onClick: handleSearchSecret }
    : room.type === 'CAMPFIRE' && onOpenInventory
    ? { label: 'Open Backpack', onClick: onOpenInventory }
    : null;

  useEffect(() => {
    onPrimaryActionChange(primaryAction);
  }, [primaryAction?.label, primaryAction?.onClick, primaryAction?.disabled, onPrimaryActionChange]);

  return (
    <div ref={containerRef} id="room-view-container" className="max-w-4xl mx-auto space-y-4">
      {/* If Trap Chamber: Render Single Merged Unified Trap Card */}
      {room.trap ? (
        <div
          className={`border-2 rounded-xl p-4 md:p-5 shadow-2xl relative overflow-hidden text-stone-200 transition-colors ${
            room.trap.disarmed
              ? 'bg-[#1b2419] border-emerald-700/70'
              : room.trap.triggered
              ? 'bg-[#2b1712] border-red-600/80 ring-1 ring-red-500/40'
              : 'bg-[#241a12] border-yellow-700/70'
          }`}
        >
          {/* Header Row: Title on Left, Badges on Right */}
          <div className="flex items-start justify-between gap-3 border-b border-[#4d3723] pb-2.5 mb-3">
            <div>
              <h2 className="text-lg md:text-xl font-serif font-black text-[#f5e4c6]">
                {room.title}
              </h2>
            </div>

            {/* Badges on Right: TRAP pill with DC pill underneath, or DISARMED on top */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {room.trap.disarmed ? (
                <span className="text-xs font-serif font-bold text-emerald-300 capitalize bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-700 shadow-sm">
                  DISARMED
                </span>
              ) : (
                <>
                  <span
                    className={`text-xs font-serif capitalize px-2.5 py-0.5 rounded border ${
                      room.trap.triggered
                        ? 'bg-red-950 text-red-300 border-red-700 font-bold'
                        : 'bg-[#160f09] text-stone-400 border-[#3b2716]'
                    }`}
                  >
                    {room.trap.triggered ? 'TRAP SPRUNG' : 'TRAP'}
                  </span>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded border font-bold ${
                      room.trap.triggered
                        ? 'bg-red-950 text-red-300 border-red-800/80'
                        : 'bg-[#181109] text-yellow-300 border-yellow-800/60'
                    }`}
                  >
                    DC {room.trap.difficulty}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Narrative & Atmosphere Text (No coordinates, no duplicates) */}
          <p className="text-sm font-serif text-stone-300 leading-relaxed mb-2">{room.description}</p>
          <p className="text-xs font-serif text-[#d6b78d] italic mb-3.5">{room.flavorText}</p>

          {/* State-specific Body: Unsuccessful vs First Entering vs Successful */}
          {!room.trap.disarmed ? (
            <div className="space-y-3">
              {/* Trap Sprung Status Banner with red highlight */}
              {room.trap.triggered && (
                <div className="p-2.5 bg-red-950/80 border border-red-600/70 rounded-lg text-xs text-red-200 font-serif flex items-start gap-2 shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Trap Sprung & Still Active:</strong> The hazard triggered on a previous attempt and remains armed! You must disarm it before proceeding.
                    {eventMessage && <div className="mt-1 text-red-300 font-bold">{eventMessage}</div>}
                  </div>
                </div>
              )}

              <div className="text-[11px] font-serif text-amber-200/90 italic">
                {room.trap.triggered
                  ? 'Choose your approach to deactivate the active trap:'
                  : 'Choose your skill approach to deactivate the trap:'}
              </div>

              {/* 4 Skill Approach Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Dexterity Disarm */}
                <button
                  id="btn-trap-dex"
                  disabled={isRolling}
                  aria-pressed={selectedTrapStat === 'DEX'}
                  onClick={() => setSelectedTrapStat('DEX')}
                  className={`p-2 text-amber-200 border rounded text-xs font-serif font-bold flex items-center justify-between cursor-pointer transition-colors disabled:opacity-50 ${selectedTrapStat === 'DEX' ? 'bg-amber-900/60 border-amber-300 ring-1 ring-amber-400' : 'bg-[#332213] hover:bg-[#48301c] border-[#7a5836]'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-left">Dexterity Disarm</span>
                  </div>
                  <span className="font-mono text-[10px] text-cyan-300">
                    {getStatModifier(heroStats.DEX) >= 0
                      ? `+${getStatModifier(heroStats.DEX)}`
                      : getStatModifier(heroStats.DEX)}
                  </span>
                </button>

                {/* Intelligence Mechanism Analysis */}
                <button
                  id="btn-trap-int"
                  disabled={isRolling}
                  aria-pressed={selectedTrapStat === 'INT'}
                  onClick={() => setSelectedTrapStat('INT')}
                  className={`p-2 text-amber-200 border rounded text-xs font-serif font-bold flex items-center justify-between cursor-pointer transition-colors disabled:opacity-50 ${selectedTrapStat === 'INT' ? 'bg-amber-900/60 border-amber-300 ring-1 ring-amber-400' : 'bg-[#332213] hover:bg-[#48301c] border-[#7a5836]'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-left">Intelligence Analysis</span>
                  </div>
                  <span className="font-mono text-[10px] text-purple-300">
                    {getStatModifier(heroStats.INT) >= 0
                      ? `+${getStatModifier(heroStats.INT)}`
                      : getStatModifier(heroStats.INT)}
                  </span>
                </button>

                {/* Strength Jam Mechanism */}
                <button
                  id="btn-trap-str"
                  disabled={isRolling}
                  aria-pressed={selectedTrapStat === 'STR'}
                  onClick={() => setSelectedTrapStat('STR')}
                  className={`p-2 text-amber-200 border rounded text-xs font-serif font-bold flex items-center justify-between cursor-pointer transition-colors disabled:opacity-50 ${selectedTrapStat === 'STR' ? 'bg-amber-900/60 border-amber-300 ring-1 ring-amber-400' : 'bg-[#332213] hover:bg-[#48301c] border-[#7a5836]'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Hammer className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-left">Strength Jam / Wedge</span>
                  </div>
                  <span className="font-mono text-[10px] text-orange-300">
                    {getStatModifier(heroStats.STR) >= 0
                      ? `+${getStatModifier(heroStats.STR)}`
                      : getStatModifier(heroStats.STR)}
                  </span>
                </button>

                {/* Luck Evasion */}
                <button
                  id="btn-trap-lck"
                  disabled={isRolling}
                  aria-pressed={selectedTrapStat === 'LCK'}
                  onClick={() => setSelectedTrapStat('LCK')}
                  className={`p-2 text-amber-200 border rounded text-xs font-serif font-bold flex items-center justify-between cursor-pointer transition-colors disabled:opacity-50 ${selectedTrapStat === 'LCK' ? 'bg-amber-900/60 border-amber-300 ring-1 ring-amber-400' : 'bg-[#332213] hover:bg-[#48301c] border-[#7a5836]'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span className="text-left">Fortune & Luck Leap</span>
                  </div>
                  <span className="font-mono text-[10px] text-yellow-300">
                    {getStatModifier(heroStats.LCK) >= 0
                      ? `+${getStatModifier(heroStats.LCK)}`
                      : getStatModifier(heroStats.LCK)}
                  </span>
                </button>
              </div>

            </div>
          ) : (
            /* Successful Roll: Green Status Format Text */
            <div className="space-y-2">
              <div className="p-3 bg-[#142617] border border-emerald-600/70 rounded-lg text-xs text-emerald-300 font-serif flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span className="font-bold">Trap mechanism disarmed and safe to pass.</span>
                </div>
                {eventMessage && (
                  <span className="text-[11px] text-amber-300 font-mono font-bold">
                    +20 XP Gained
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Standard Room Narrative Card for Non-Trap Rooms */
        <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-4 md:p-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#4d3723] pb-2.5 mb-3">
            <h2 className="text-lg md:text-xl font-serif font-black text-[#f5e4c6]">{room.title}</h2>

            <span className="text-xs font-serif text-stone-400 capitalize bg-[#160f09] px-2.5 py-0.5 rounded border border-[#3b2716]">
              {room.isBossRoom ? 'Boss & Descent Chamber' : room.type.replace('_', ' ')}
            </span>
          </div>

          <p className="text-sm font-serif text-stone-300 leading-relaxed mb-2">{room.description}</p>
          <p className="text-xs font-serif text-[#d6b78d] italic">{room.flavorText}</p>

          {/* Dynamic Event Result Box */}
          {eventMessage && (
            <div className="mt-3 p-2.5 bg-[#17110a] border border-[#6b4e2d] rounded-md font-serif text-xs text-amber-200 animate-fade-in flex items-center justify-between">
              <span>{eventMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Room Interactive Encounter Area */}
      <div className="flex flex-col gap-4">
          {/* 1. Monster / Boss Encounter */}
          {room.monster && room.monster.hp > 0 && (
            <div
              className={`border-2 rounded-xl p-4 shadow-lg text-stone-200 ${
                room.isBossRoom
                  ? 'bg-[#3b1915] border-red-500 ring-1 ring-red-400'
                  : 'bg-[#2e1913] border-red-700/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-red-300 font-serif font-bold text-sm">
                  {room.isBossRoom ? (
                    <Crown className="w-5 h-5 text-amber-400 animate-pulse" />
                  ) : (
                    <Skull className="w-5 h-5 text-red-500 animate-pulse" />
                  )}
                  <span>
                    {room.isBossRoom ? 'FLOOR MAP BOSS' : 'Hostile Encounter'}: {room.monster.name}
                  </span>
                </div>
                <span className="text-xs font-mono text-red-400 font-bold">
                  HP: {room.monster.hp}/{room.monster.maxHp}
                </span>
              </div>

              <p className="text-xs text-stone-300 font-serif mb-3.5 leading-relaxed">
                {room.monster.description}
              </p>

              {room.isBossRoom && (
                <div className="mb-3 p-2 bg-[#200e0b] border border-red-900 rounded text-[11px] font-serif text-amber-200 flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>The stairs to the next floor are locked behind this Boss. Defeat it to proceed!</span>
                </div>
              )}

            </div>
          )}

          {/* 2. Treasure Chest */}
          {room.chest && (
            <div className="bg-[#241a12] border-2 border-amber-600/70 rounded-xl p-4 shadow-lg text-stone-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-amber-300 font-serif font-bold text-sm">
                  <Package className="w-5 h-5 text-amber-400" />
                  <span>Iron-Bound Dungeon Chest</span>
                </div>
                <span className="text-[11px] font-mono text-stone-400">
                  {room.chest.isOpened
                    ? 'Opened'
                    : room.chest.isFailed || room.chest.isJammed
                    ? 'Jammed & Abandoned'
                    : room.chest.isLocked
                    ? `Locked (DC ${room.chest.lockDifficulty})`
                    : 'Unlocked'}
                </span>
              </div>

              {!room.chest.isOpened ? (
                room.chest.isFailed || room.chest.isJammed ? (
                  <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 font-serif flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Lock mechanism is wrecked and seized shut from failed breach attempts. Abandoned.</span>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {room.chest.isLocked ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          id="btn-pick-lock"
                          disabled={!canPickLock || isRolling}
                          onClick={handlePickChestLock}
                          className={`p-2.5 rounded text-xs font-serif flex flex-col items-center gap-1 transition-colors ${
                            canPickLock && !isRolling
                              ? 'bg-[#382617] hover:bg-[#4d3521] text-amber-200 border border-[#6b4c2b] cursor-pointer'
                              : 'bg-stone-900 border border-stone-800 text-stone-500 opacity-60 cursor-not-allowed'
                          }`}
                          title={
                            canPickLock
                              ? 'Pick lock with masterwork tools (+3 bonus)'
                              : unusablePicks
                              ? "Cannot use lockpicks: Requires Rogue, Jester, or Hero class"
                              : "Requires Thieves' Lockpick Kit"
                          }
                        >
                          <Key className={`w-4 h-4 ${canPickLock ? 'text-cyan-400' : 'text-stone-600'}`} />
                          <span className="font-bold">Pick Lock (DEX)</span>
                          <span className="text-[10px] font-mono">
                            {canPickLock
                              ? '+3 Lockpick'
                              : unusablePicks
                              ? 'Class Restricted'
                              : 'Requires Lockpicks'}
                          </span>
                        </button>

                        <button
                          id="btn-force-chest"
                          disabled={isRolling}
                          onClick={handleForceChest}
                          className="p-2.5 bg-[#382617] hover:bg-[#4d3521] text-amber-200 border border-[#6b4c2b] rounded text-xs font-serif flex flex-col items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Shield className="w-4 h-4 text-red-400" />
                          <span className="font-bold">Bash Open (STR)</span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            Roll vs DC {room.chest.lockDifficulty + 2}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 font-serif italic">The chest is unlocked and ready to open.</p>
                    )}
                  </div>
                )
              ) : (
                <div className="text-xs text-stone-400 font-serif italic py-1">
                  The chest lies empty, its treasures collected into your backpack.
                </div>
              )}
            </div>
          )}

          {/* 4. Campfire Hearth Sanctuary */}
          {room.type === 'CAMPFIRE' && (
            <div className="bg-[#241a12] border-2 border-amber-700/70 rounded-xl p-4 shadow-lg text-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-serif font-bold text-sm">
                  <Tent className="w-5 h-5 text-amber-500" />
                  <span>Dungeon Hearth (Floor Sanctuary)</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-700/50">
                  Entrance Haven
                </span>
              </div>
              <p className="text-xs text-stone-300 font-serif leading-relaxed">
                A safe, sheltered alcove around the floor entrance staircase. Your <strong>HP and Energy were fully replenished</strong> when you descended to this floor.
              </p>
              <div className="bg-[#18110c] border border-amber-900/60 rounded-lg p-3 text-xs font-serif text-amber-200/90 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-amber-200/90">
                  <strong className="text-amber-300">Sanctuary Rules:</strong> Mid-level resting at the hearth is not permitted. While exploring this floor, use <strong>food rations and healing potions</strong> directly from your backpack, or seek out sacred <strong>divine shrines</strong> to restore your health and energy.
                </div>
              </div>
            </div>
          )}

          {/* 5. Merchant Outpost */}
          {room.type === 'MERCHANT' && (
            <div className="bg-[#1c2419] border-2 border-emerald-700/70 rounded-xl p-4 shadow-lg text-stone-200">
              <div className="flex items-center gap-2 text-emerald-400 font-serif font-bold text-sm mb-2">
                <Store className="w-5 h-5 text-emerald-500" />
                <span>Olaf the Wandering Merchant</span>
              </div>
              <p className="text-xs text-stone-300 font-serif mb-3">
                “Welcome, traveler! My pack is full of potions, armor, pickaxes, and sharp steel.”
              </p>
            </div>
          )}

          {/* 6. Holy Shrine */}
          {room.shrine && (
            <div className="bg-[#1a2029] border-2 border-cyan-700/70 rounded-xl p-4 shadow-lg text-stone-200">
              <div className="flex items-center gap-2 text-cyan-300 font-serif font-bold text-sm mb-2">
                <Sun className="w-5 h-5 text-cyan-400" />
                <span>{room.shrine.name}</span>
              </div>
              <p className="text-xs text-stone-300 font-serif mb-3">{room.shrine.description}</p>
              {room.shrine.used && (
                <div className="text-xs text-stone-400 font-serif italic">
                  The altar's celestial glow has faded into quiet stone.
                </div>
              )}
            </div>
          )}

          {/* 7. Secret Chamber */}
          {room.secret && (
            <div className="bg-[#241a29] border-2 border-purple-700/70 rounded-xl p-4 shadow-lg text-stone-200">
              <div className="flex items-center gap-2 text-purple-300 font-serif font-bold text-sm mb-1.5">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <span>Hidden Wall Compartment</span>
              </div>
              {room.secret.discovered ? (
                <div className="text-xs text-stone-400 font-serif italic">
                  ✓ Hidden compartment discovered and looted.
                </div>
              ) : room.secret.isFailed && (
                <div className="text-xs text-stone-400 font-serif italic bg-[#18111f] p-2.5 rounded border border-purple-900/60 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>✖ Search abandoned. You inspected the crumbling masonry but found no concealed alcoves.</span>
                </div>
              )}
            </div>
          )}

          {/* 8. Floor Descent Stairs (Boss Room) */}
          {room.hasStairs && (
            <div className="bg-[#1e1e2c] border-2 border-blue-600 rounded-xl p-4 shadow-lg text-stone-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-300 font-serif font-bold text-sm">
                  <Footprints className="w-5 h-5 text-blue-400" />
                  <span>Spiral Descent Staircase</span>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    !room.monster || room.monster.hp <= 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : 'bg-red-950 text-red-300 border border-red-600'
                  }`}
                >
                  {!room.monster || room.monster.hp <= 0 ? 'UNLOCKED' : 'LOCKED BY BOSS'}
                </span>
              </div>

              <p className="text-xs text-stone-300 font-serif mb-3">
                {!room.monster || room.monster.hp <= 0
                  ? `The map boss has been defeated! The stone staircase opens downward into Floor ${
                      floor.floorNumber + 1
                    }.`
                  : `A heavy iron portcullis blocks the staircase. You must defeat ${room.monster.name} to unlock it.`}
              </p>

            </div>
          )}
        </div>

      {/* Loot Roller Modal */}
      <LootRollerModal
        isOpen={showLootModal}
        hero={hero}
        onUpdateHero={onUpdateHero}
        title={lootSourceTitle}
        sourceDescription={lootSourceDesc}
        floorNumber={room.floor}
        guaranteedGold={pendingGuaranteedGold}
        bonusItems={pendingBonusItems}
        onClaimLoot={handleClaimChestLoot}
        onClose={() => setShowLootModal(false)}
      />

      {/* Focused Action Challenge Modal (Traps, Chests, Searches) */}
      <ActionChallengeModal
        isOpen={showChallengeModal}
        hero={hero}
        onUpdateHero={onUpdateHero}
        config={challengeConfig}
        onClose={() => {
          setShowChallengeModal(false);
          setChallengeConfig(null);
        }}
      />
    </div>
  );
};
