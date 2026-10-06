/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BookOpen,
  Dices,
  Shield,
  Sword,
  Sparkles,
  Heart,
  Compass,
  Hammer,
  Eye,
  Crown,
  AlertTriangle,
  RefreshCw,
  Trophy,
  Skull,
  Table as TableIcon,
} from 'lucide-react';
import { DieShape } from './DieShape';
import {
  CHARACTER_CLASS_TABLE,
  STARTING_BOON_TABLE,
  ROOM_TABLE_FLOOR_1,
  ROOM_TABLE_FLOOR_2,
  ROOM_TABLE_FLOOR_3,
  MONSTER_TABLE_FLOOR_1,
  MONSTER_TABLE_FLOOR_2,
  MONSTER_TABLE_FLOOR_3,
  MONSTER_TRAIT_TABLE,
  LOOT_TABLE_CHEST,
  RollableTable,
} from '../data/tables';
import { LookupTableRoller } from './LookupTableRoller';
import { getHallOfFame } from '../utils/storage';

export type RuleTab =
  | 'dice'
  | 'fate'
  | 'dungeon'
  | 'combat'
  | 'loot_classes'
  | 'tables'
  | 'leaderboard';

const TAB_ORDER: RuleTab[] = [
  'dice',
  'fate',
  'dungeon',
  'combat',
  'loot_classes',
  'tables',
  'leaderboard',
];

interface RulesCodexViewProps {
  initialTab?: RuleTab;
  activeTab?: RuleTab;
  onTabChange?: (tab: RuleTab) => void;
}

const ALL_TABLES: { id: string; label: string; category: string; table: RollableTable<any> }[] = [
  { id: 'classes', label: '1. Character Classes (1d8)', category: 'Hero Creation', table: CHARACTER_CLASS_TABLE },
  { id: 'boons', label: '2. Heirloom Boons (1d6)', category: 'Hero Creation', table: STARTING_BOON_TABLE },
  { id: 'f1_rooms', label: '3. Catacomb Rooms F1 (1d20)', category: 'Exploration', table: ROOM_TABLE_FLOOR_1 },
  { id: 'f2_rooms', label: '4. Sunken Mines Rooms F2 (1d20)', category: 'Exploration', table: ROOM_TABLE_FLOOR_2 },
  { id: 'f3_rooms', label: '5. Infernal Rooms F3 (1d20)', category: 'Exploration', table: ROOM_TABLE_FLOOR_3 },
  { id: 'f1_monsters', label: '6. F1 Beasts Table (1d6)', category: 'Monsters', table: MONSTER_TABLE_FLOOR_1 },
  { id: 'f2_monsters', label: '7. F2 Mine Horrors (1d6)', category: 'Monsters', table: MONSTER_TABLE_FLOOR_2 },
  { id: 'f3_monsters', label: '8. F3 Infernal Guardians (1d6)', category: 'Monsters', table: MONSTER_TABLE_FLOOR_3 },
  { id: 'traits', label: '9. Monster Trait Table (1d6)', category: 'Monsters', table: MONSTER_TRAIT_TABLE },
  { id: 'loot', label: '10. Vault Loot & Relics (1d20)', category: 'Treasure', table: LOOT_TABLE_CHEST },
];

export const RulesCodexView: React.FC<RulesCodexViewProps> = ({
  initialTab = 'dice',
  activeTab: controlledActiveTab,
  onTabChange,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<RuleTab>(initialTab);
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const [selectedTableId, setSelectedTableId] = useState<string>('f1_rooms');

  // Mouse & Touch Drag Navigation between Tabs
  const dragStartX = React.useRef<number | null>(null);
  const dragStartY = React.useRef<number | null>(null);
  const isDraggingTabContent = React.useRef(false);

  // Tab bar click-and-drag scrolling
  const tabBarRef = React.useRef<HTMLDivElement>(null);
  const isTabBarMouseDown = React.useRef(false);
  const tabBarStartX = React.useRef(0);
  const tabBarScrollLeft = React.useRef(0);

  const handleSelectTab = (tab: RuleTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    dragStartX.current = clientX;
    dragStartY.current = clientY;
    isDraggingTabContent.current = true;
  };

  const handleDragEnd = (clientX: number, clientY: number) => {
    if (!isDraggingTabContent.current || dragStartX.current === null) return;
    const deltaX = clientX - dragStartX.current;
    const deltaY = clientY - (dragStartY.current || clientY);
    isDraggingTabContent.current = false;
    dragStartX.current = null;
    dragStartY.current = null;

    // Detect horizontal drag threshold (> 45px)
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (deltaX < 0) {
        // Dragged left -> switch to next tab
        if (currentIndex < TAB_ORDER.length - 1) {
          handleSelectTab(TAB_ORDER[currentIndex + 1]);
        }
      } else {
        // Dragged right -> switch to previous tab
        if (currentIndex > 0) {
          handleSelectTab(TAB_ORDER[currentIndex - 1]);
        }
      }
    }
  };

  const handleTabMouseDown = (e: React.MouseEvent) => {
    if (!tabBarRef.current) return;
    isTabBarMouseDown.current = true;
    tabBarStartX.current = e.pageX - tabBarRef.current.offsetLeft;
    tabBarScrollLeft.current = tabBarRef.current.scrollLeft;
  };

  const handleTabMouseMove = (e: React.MouseEvent) => {
    if (!isTabBarMouseDown.current || !tabBarRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabBarRef.current.offsetLeft;
    const walk = (x - tabBarStartX.current) * 1.5;
    tabBarRef.current.scrollLeft = tabBarScrollLeft.current - walk;
  };

  const handleTabMouseUp = () => {
    isTabBarMouseDown.current = false;
  };

  const currentTableEntry =
    ALL_TABLES.find((t) => t.id === selectedTableId) || ALL_TABLES[0];

  const scores = getHallOfFame();

  return (
    <div
      className="flex flex-col flex-1 w-full gap-3 text-stone-200 select-none"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, select, input, a, [data-no-tab-drag]')) return;
        handleDragStart(e.clientX, e.clientY);
      }}
      onMouseUp={(e) => handleDragEnd(e.clientX, e.clientY)}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (e.changedTouches.length > 0) {
          handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }
      }}
    >
      {/* Scrollable Horizontal Tab Navigation (with mouse drag scrolling) */}
      <div
        ref={tabBarRef}
        onMouseDown={handleTabMouseDown}
        onMouseMove={handleTabMouseMove}
        onMouseUp={handleTabMouseUp}
        onMouseLeave={handleTabMouseUp}
        className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 border-b border-[#4d3723] shrink-0 no-scrollbar cursor-grab active:cursor-grabbing"
      >
        <button
          id="tab-rule-dice"
          onClick={() => handleSelectTab('dice')}
          className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'dice'
              ? 'bg-amber-600 text-stone-950 shadow-md'
              : 'bg-[#181109] text-stone-400 hover:text-stone-200 hover:bg-[#2b1b10] border border-[#3d2716]'
          }`}
        >
          <Dices className="w-3.5 h-3.5" />
          <span>Dice & Resolution</span>
        </button>

        <button
          id="tab-rule-fate"
          onClick={() => handleSelectTab('fate')}
          className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'fate'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-[#181109] text-stone-400 hover:text-stone-200 hover:bg-[#2b1b10] border border-[#3d2716]'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Fate Rerolls</span>
        </button>

        <button
          id="tab-rule-dungeon"
          onClick={() => handleSelectTab('dungeon')}
          className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'dungeon'
              ? 'bg-emerald-600 text-stone-950 shadow-md'
              : 'bg-[#181109] text-stone-400 hover:text-stone-200 hover:bg-[#2b1b10] border border-[#3d2716]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>4x4 Grid & Walls</span>
        </button>

        <button
          id="tab-rule-combat"
          onClick={() => handleSelectTab('combat')}
          className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'combat'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-[#181109] text-stone-400 hover:text-stone-200 hover:bg-[#2b1b10] border border-[#3d2716]'
          }`}
        >
          <Sword className="w-3.5 h-3.5" />
          <span>Combat & Actions</span>
        </button>

        <button
          id="tab-rule-loot"
          onClick={() => handleSelectTab('loot_classes')}
          className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'loot_classes'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-[#181109] text-stone-400 hover:text-stone-200 hover:bg-[#2b1b10] border border-[#3d2716]'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Vault Loot & Classes</span>
        </button>

        {/* Tab 6: Lookup Tables */}
        <button
          id="tab-rule-tables"
          onClick={() => handleSelectTab('tables')}
          className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'tables'
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-stone-950 shadow-md font-black'
              : 'bg-[#181109] text-amber-300 hover:text-amber-100 hover:bg-[#2b1b10] border border-amber-800/60'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Lookup Tables</span>
        </button>

        {/* Tab 7: Leaderboard */}
        <button
          id="tab-rule-leaderboard"
          onClick={() => handleSelectTab('leaderboard')}
          className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'leaderboard'
              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-stone-950 shadow-md font-black'
              : 'bg-[#181109] text-yellow-300 hover:text-yellow-100 hover:bg-[#2b1b10] border border-yellow-800/60'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          <span>Leaderboard</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto space-y-3 font-serif text-xs text-stone-300 leading-relaxed pr-1">
        {/* TAB 1: DICE & RESOLUTION */}
        {activeTab === 'dice' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-[#140e09] p-4 rounded-xl border border-[#3e2b1c]">
              <h3 className="text-amber-300 font-bold text-sm mb-2 flex items-center gap-2">
                <Dices className="w-4 h-4 text-amber-400" />
                The 1d20 Resolution System
              </h3>
              <p>
                Every challenge in the dungeon—attacking monsters, dodging swinging blades, picking ancient locks, or resisting arcane hexes—is determined by a fair d20 dice roll.
              </p>
              <div className="bg-[#0c0805] p-3 rounded-lg my-2.5 font-mono text-[11px] sm:text-xs text-amber-200 border border-[#382618]">
                <strong>Total Check</strong> = [1d20 Roll] + [Stat Modifier] + [Equipment Bonuses] vs [Target AC / DC]
              </div>
              <p>
                If your total equals or exceeds the target’s <strong>Armor Class (AC)</strong> or the challenge's <strong>Difficulty Class (DC)</strong>, the action succeeds!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#140e09] p-3.5 rounded-xl border border-amber-500/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-amber-300 text-xs uppercase tracking-wide">
                    Natural 20 (Critical Hit)
                  </h4>
                </div>
                <p className="text-stone-300 text-[11px]">
                  Rolling a <strong>20</strong> on a d20 attack is an automatic strike regardless of enemy AC. It deals <strong>Maximum Base Weapon Damage</strong> plus an extra weapon damage die roll!
                </p>
              </div>

              <div className="bg-[#140e09] p-3.5 rounded-xl border border-red-800/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h4 className="font-bold text-red-300 text-xs uppercase tracking-wide">
                    Natural 1 (Critical Fumble)
                  </h4>
                </div>
                <p className="text-stone-300 text-[11px]">
                  Rolling a <strong>1</strong> on a d20 is an automatic failure. On tactical escape attempts, a fumble stumbles you, forfeiting your next turn while scrambling to your feet. <em>Fate cannot avert a Natural 1 fumble!</em>
                </p>
              </div>
            </div>

            <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c]">
              <h4 className="text-amber-300 font-bold text-xs mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Visual Polyhedral Dice Suite
              </h4>
              <p className="text-[11px] text-stone-300 mb-2">
                All rolls render authentic geometric polyhedral dice (d4, d6, d8, d10, d12, d20, d100) with visual roll animations that remain clearly visible on results screens.
              </p>
              <div className="flex items-center justify-center gap-2 sm:gap-4 py-2 bg-[#0d0906] rounded-lg border border-[#2b1d12]">
                <DieShape sides={4} value={4} size="sm" />
                <DieShape sides={6} value={6} size="sm" />
                <DieShape sides={8} value={8} size="sm" />
                <DieShape sides={10} value={10} size="sm" />
                <DieShape sides={12} value={12} size="sm" />
                <DieShape sides={20} value={20} size="sm" />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FATE REROLL TOKENS */}
        {activeTab === 'fate' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-gradient-to-br from-[#1a0e23] via-[#140e09] to-[#1a0e23] p-4 rounded-xl border-2 border-purple-500/50">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-purple-400" />
                <h3 className="text-purple-300 font-bold text-sm">
                  Fate Reroll Tokens & Destiny
                </h3>
              </div>
              <p className="text-stone-300">
                Fate Tokens represent a hero's uncanny knack for cheating death. When a roll goes wrong, you can expend 1 Fate Token to immediately re-roll the die and take the new result!
              </p>
            </div>

            <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c] space-y-2">
              <h4 className="text-amber-300 font-bold text-xs">
                Where Can Fate Rerolls Be Used?
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] text-stone-300">
                <li>
                  <strong className="text-purple-300">Missed Weapon Attacks:</strong> Reroll your attack d20 before the monster counter-attacks.
                </li>
                <li>
                  <strong className="text-purple-300">Failed Tactical Escapes:</strong> Re-roll a failed flee check to safely retreat from deadly foes.
                </li>
                <li>
                  <strong className="text-purple-300">Action Challenge Hazards:</strong> Reroll failed trap disarms, lockpicking checks, chasm leaps, and glyph deciphering.
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#140e09] p-3 rounded-xl border border-stone-700">
                <h4 className="font-bold text-amber-300 text-xs mb-1">
                  Starting Fate Allotment
                </h4>
                <p className="text-[11px] text-stone-300">
                  • <strong>Standard Classes</strong> (Warrior, Paladin, Wizard, Cleric, Ranger) start with <strong>1 Fate Token</strong>.
                  <br />• <strong>Rogue</strong> starts with <strong>2 Fate Tokens</strong>.
                </p>
              </div>

              <div className="bg-[#140e09] p-3 rounded-xl border border-stone-700">
                <h4 className="font-bold text-amber-300 text-xs mb-1">
                  How to Find More Fate Tokens
                </h4>
                <p className="text-[11px] text-stone-300">
                  The elusive <strong>Dice of Fate</strong> relic is not sold in shops—it can only be discovered as a rare prize in <strong>Vault Chests</strong> (Roll #12 on the d20 Vault Loot Table).
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-950/40 rounded-xl border border-red-900/60 flex items-start gap-2.5 text-[11px] text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong>Critical Fumble Exemption:</strong> Fate cannot alter a Natural 1 Critical Fumble. When destiny collapses completely, no reroll is permitted.
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 4x4 GRID & WALLS */}
        {activeTab === 'dungeon' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-[#140e09] p-4 rounded-xl border border-[#3e2b1c]">
              <h3 className="text-amber-300 font-bold text-sm mb-2 flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                4x4 Dungeon Grid & Hidden Chamber Cards
              </h3>
              <p>
                Each dungeon floor is a <strong>4x4 board containing 16 pre-determined room tiles</strong> laid face-down. You begin at the entrance Hearth [1,1]. Step onto cards to reveal their perils, treasures, merchants, and shrines.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c]">
                <h4 className="text-cyan-300 font-bold text-xs mb-1.5 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Chamber Scouting & Vision
                </h4>
                <p className="text-[11px] text-stone-300">
                  Chambers remain dark and hidden until scouted. Light a <strong>Torch</strong> to reveal an adjacent room, use the reusable <strong>Burglar's Spyglass</strong> to scout without torches, or cast a <strong>Scroll of Clairvoyance</strong> to uncover any room anywhere on the 4x4 grid!
                </p>
              </div>

              <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c]">
                <h4 className="text-orange-300 font-bold text-xs mb-1.5 flex items-center gap-1.5">
                  <Hammer className="w-4 h-4 text-orange-400" />
                  Wall Breaching & Phasing
                </h4>
                <p className="text-[11px] text-stone-300">
                  Interior stone walls block passage. Smash them down permanently with an <strong>Iron Pickaxe</strong> or <strong>Dwarven Breaching Sledge</strong>, or phase through them using <strong>Potion of Phasing</strong> or the <strong>Ring of the Ethereal Strider</strong>.
                </p>
              </div>
            </div>

            <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c] space-y-2">
              <h4 className="text-yellow-300 font-bold text-xs flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-yellow-400" />
                Boss Chambers & Spiral Stairs
              </h4>
              <p className="text-[11px] text-stone-300">
                The spiral descent staircase is NOT in a fixed location — it is hidden alongside the Floor Boss in <strong>1 of 8 candidate chambers</strong> (marked with gold stars ★: [4,1], [4,2], [4,3], [4,4], [3,3], [3,4], [2,4], or [1,4]). You must scout and hunt around the dungeon to discover which candidate tile houses the boss. Defeating the boss unlocks the spiral stairs to descend.
              </p>
            </div>

            <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c]">
              <h4 className="text-emerald-300 font-bold text-xs mb-1 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-emerald-400" />
                Hearth Sanctuary & Healing
              </h4>
              <p className="text-[11px] text-stone-300">
                Descending the stairs to a new dungeon floor triggers the <strong>Entrance Hearth Sanctuary</strong>, completely replenishing your <strong>HP and Mana</strong>. Mid-floor healing requires rations, potions, or divine shrines.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: COMBAT & ACTIONS */}
        {activeTab === 'combat' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-[#140e09] p-4 rounded-xl border border-[#3e2b1c]">
              <h3 className="text-red-300 font-bold text-sm mb-2 flex items-center gap-2">
                <Sword className="w-4 h-4 text-red-400" />
                Turn-Based Combat & Energy Management
              </h3>
              <p>
                Combat is fully turn-based. Each action consumes <strong>Energy Points (EP / Mana)</strong>. Manage your stamina wisely between physical strikes, defensive stances, magical spells, and retreat checks.
              </p>
            </div>

            <div className="space-y-2">
              <div className="bg-[#140e09] p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-xs">1. Standard Weapon Strike</span>
                  <span className="font-mono text-[10px] text-amber-400 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-700">1 EP</span>
                </div>
                <p className="text-[11px] text-stone-300 mt-1">
                  Roll 1d20 + Attack Stat vs Monster AC. On hit, roll weapon damage dice + modifiers minus monster Damage Reduction (DR).
                </p>
              </div>

              <div className="bg-[#140e09] p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 text-xs">2. Class Spells & Powers</span>
                  <span className="font-mono text-[10px] text-cyan-400 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-700">2-3 EP</span>
                </div>
                <p className="text-[11px] text-stone-300 mt-1">
                  Unleash potent class specials like <em>Fireball</em>, <em>Smite Evil</em>, <em>Power Cleave</em>, <em>Holy Radiance</em>, <em>Shadow Ambush</em>, or <em>Aimed Volley</em>.
                </p>
              </div>

              <div className="bg-[#140e09] p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-300 text-xs">3. Defend Guard & Counter-Attack</span>
                  <span className="font-mono text-[10px] text-blue-400 bg-stone-900 px-1.5 py-0.5 rounded border border-blue-800">5 EP</span>
                </div>
                <p className="text-[11px] text-stone-300 mt-1">
                  Brace your guard for 5 EP, granting <strong>+4 Armor Class (AC)</strong>, absorbing incoming damage, and automatically launching a class-specific <strong>Counter-Attack</strong> retaliatory strike when the monster attacks!
                </p>
              </div>

              <div className="bg-[#140e09] p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 text-xs">4. Catch Breath (Exhaustion Recovery)</span>
                  <span className="font-mono text-[10px] text-emerald-400 bg-stone-900 px-1.5 py-0.5 rounded border border-emerald-700 font-bold">+2 EP (0 Cost)</span>
                </div>
                <p className="text-[11px] text-stone-300 mt-1">
                  When your energy falls below 5 EP, <strong>Catch Breath</strong> automatically replaces the Counter-Attack option. It costs <strong>0 EP</strong>, recovers <strong>+2 Energy</strong>, grants <strong>+4 AC</strong>, and absorbs damage.
                </p>
              </div>

              <div className="bg-[#140e09] p-3 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-xs">5. Tactical Escape (Flee)</span>
                  <span className="font-mono text-[10px] text-amber-400 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-700">0 EP (Free)</span>
                </div>
                <p className="text-[11px] text-stone-300 mt-1">
                  Roll 1d20 + DEX/LCK vs <strong>Escape DC (10 + Monster Level)</strong>. Costs 0 EP. Success retreats you safely to the previous chamber.
                </p>
              </div>

              {/* Weapon Sunder & Requirements Codex Card */}
              <div className="bg-[#1a110a] p-3 rounded-xl border border-amber-900/60 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                  <Sword className="w-3.5 h-3.5 text-amber-400" />
                  <span>Weapon Armor Sunder & Item Requirements</span>
                </div>
                <p className="text-[11px] text-stone-300 leading-relaxed">
                  <strong>Enemy AC Reduction:</strong> Weapons sunder monster defenses directly (e.g. -1 AC, -2 AC, or -1x Level AC) instead of buffing hero stats. Lowering enemy AC makes your d20 attack rolls connect much more reliably.
                </p>
                <p className="text-[11px] text-stone-300 leading-relaxed">
                  <strong>Requirements & Heritage:</strong> Powerful weapons require minimum attributes (including bonuses from amulets and rings), specific classes (e.g. staves for Wizards), or specific races (e.g. Stone-Splitter for Dwarves; two-handed Broadswords are too heavy for Halflings and Gnomes).
                </p>
                <p className="text-[11px] text-amber-200/90 leading-relaxed italic">
                  <strong>Loot & Trade:</strong> Any item can appear in dungeon chests or merchant carts. If you cannot wield an item, you can keep it in your backpack or sell it to Olaf the Merchant for gold!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: VAULT LOOT & CLASSES */}
        {activeTab === 'loot_classes' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-[#140e09] p-4 rounded-xl border border-[#3e2b1c]">
              <h3 className="text-amber-300 font-bold text-sm mb-2 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                20-Tier Vault Loot System (d20)
              </h3>
              <p className="text-[11px] text-stone-300 mb-2">
                Every chest in the dungeon rolls on a fully distinct 20-tier loot table, with 1 unique reward per d20 outcome scaling from 5 to 150 gold value:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px] text-stone-300">
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">1: Copper Pouch (5g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">2: Minor Potion (10g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">3: Iron Dagger (15g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">4: Leather Boots (20g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">5: Wooden Buckler (25g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">6: Silver Coinage (30g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">7: Greater Potion (35g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">8: Reinforced Shield (40g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">9: Steel Broadsword (45g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">10: Chainmail Vest (50g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">11: Ring of Luck (55g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-purple-900/60 text-purple-300 font-bold">12: Dice of Fate (60g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">13: Elixir of Vigor (70g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">14: Boots of Swiftness (80g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">15: Amulet of Warding (90g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">16: Breaching Sledge (100g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">17: Mythril Hauberk (115g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">18: Sunforged Blade (130g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-stone-800">19: Ring of Titans (140g)</div>
                <div className="p-1.5 bg-[#0c0805] rounded border border-amber-500/80 text-amber-300 font-bold">20: King's Hoard (150g)</div>
              </div>
            </div>

            <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c]">
              <h4 className="text-amber-300 font-bold text-xs mb-2">
                Hero Classes & Starting Traits
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-[#0c0805] rounded border border-stone-800">
                  <strong className="text-amber-200">Warrior:</strong> +3 STR, +2 CON • Cleaving Melee • 1 Fate Token
                </div>
                <div className="p-2 bg-[#0c0805] rounded border border-stone-800">
                  <strong className="text-amber-200">Paladin:</strong> +3 STR, +2 WIS • Smite & Heavy Armor • 1 Fate Token
                </div>
                <div className="p-2 bg-[#0c0805] rounded border border-stone-800">
                  <strong className="text-amber-200">Wizard:</strong> +3 INT, +2 WIS • Arcane Spells • 1 Fate Token
                </div>
                <div className="p-2 bg-[#0c0805] rounded border border-stone-800">
                  <strong className="text-amber-200">Cleric:</strong> +3 WIS, +2 CON • Healing & Turn Undead • 1 Fate Token
                </div>
                <div className="p-2 bg-[#0c0805] rounded border border-purple-900/60">
                  <strong className="text-purple-300">Rogue:</strong> +3 DEX, +2 LCK • Spyglass & 1 Reusable Lockpick Kit • <span className="text-amber-300 font-bold">2 Fate Tokens</span>
                </div>
                <div className="p-2 bg-[#0c0805] rounded border border-stone-800">
                  <strong className="text-amber-200">Ranger:</strong> +3 DEX, +2 WIS • Ranged Volleys • 1 Fate Token
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: LOOKUP TABLES (Integrated directly into Rules Codex) */}
        {activeTab === 'tables' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c]">
              <div className="flex items-center gap-2 mb-1.5">
                <TableIcon className="w-4 h-4 text-amber-400" />
                <h3 className="text-amber-300 font-bold text-sm">
                  Procedural Lookup & Dice Tables
                </h3>
              </div>
              <p className="text-[11px] text-stone-300">
                Explore the underlying mathematical tables that generate rooms, spawn monsters, and roll vault loot. You can inspect table probabilities or roll the dice directly!
              </p>
            </div>

            {/* Sidebar + Table Roller Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Table Selection Menu */}
              <div className="md:col-span-4 space-y-1 bg-[#120c08] p-2 rounded-xl border border-[#3d2716] shrink-0">
                <div className="text-[10px] font-mono text-stone-400 uppercase font-bold px-2 py-1 border-b border-[#2b1c10] mb-1">
                  Select Rollable Table
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                  {ALL_TABLES.map((entry) => {
                    const isSelected = selectedTableId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedTableId(entry.id)}
                        className={`w-full text-left p-2 rounded-lg text-xs font-serif transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-900/60 border border-amber-500 text-amber-100 font-bold shadow'
                            : 'text-stone-300 hover:bg-[#20150d] hover:text-amber-200 border border-transparent'
                        }`}
                      >
                        <span className="truncate">{entry.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Table Viewer / Interactive Roller */}
              <div className="md:col-span-8 flex flex-col bg-[#120c08] p-3 rounded-xl border border-[#3d2716]">
                <LookupTableRoller
                  key={currentTableEntry.id}
                  table={currentTableEntry.table}
                  title={currentTableEntry.label}
                  subtitle={currentTableEntry.category}
                  onRollComplete={() => {}}
                  actionButtonLabel="Roll This Table"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: LEADERBOARD / HALL OF FAME (Integrated directly into Rules Codex) */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-[#140e09] p-3.5 rounded-xl border border-[#3e2b1c] flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-yellow-300 font-bold text-sm">
                    Dungeon Hall of Fame
                  </h3>
                </div>
                <p className="text-[11px] text-stone-300">
                  The chronicled deeds of heroes who dared to challenge the Dragon's Lair.
                </p>
              </div>
              <div className="bg-[#1f150d] border border-amber-700/60 px-3 py-1.5 rounded-lg text-xs font-mono text-yellow-300 font-bold shrink-0">
                {scores.length} Hero {scores.length === 1 ? 'Record' : 'Records'}
              </div>
            </div>

            {/* Scores List */}
            <div className="space-y-2">
              {scores.map((record, idx) => (
                <div
                  key={record.id || idx}
                  className="bg-[#140e09] border border-[#442e1d] p-3 rounded-xl flex items-center justify-between font-serif text-xs hover:border-amber-600/60 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 font-mono font-bold text-center text-amber-500 text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-200 text-sm">{record.heroName}</span>
                        <span className="text-[10px] font-mono bg-[#2a1d13] text-stone-400 px-1.5 py-0.5 rounded border border-[#4a3422]">
                          Lv. {record.level} {record.heroClass}
                        </span>
                        {record.victory ? (
                          <span className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold bg-yellow-950/60 border border-yellow-700 px-1.5 py-0.5 rounded">
                            <Crown className="w-3 h-3 text-yellow-400" /> Victor
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-stone-400 bg-stone-900 border border-stone-700 px-1.5 py-0.5 rounded">
                            <Skull className="w-3 h-3 text-stone-500" /> Fallen
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono mt-0.5 block">
                        {record.monstersSlain} beasts slain • {record.goldAccumulated} gold • {record.date}
                      </span>
                    </div>
                  </div>

                  <div className="font-mono text-base font-black text-yellow-300">
                    {record.score} PTS
                  </div>
                </div>
              ))}

              {scores.length === 0 && (
                <div className="text-center py-10 bg-[#140e09] rounded-xl border border-dashed border-[#442e1d] text-stone-400 font-serif">
                  <Trophy className="w-8 h-8 text-stone-600 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-bold text-amber-200">No Hero Legends Recorded Yet</p>
                  <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                    Dare the dungeon, slay monsters, amass wealth, and vanquish the Crimson Dragon to etch your name into the Hall of Fame!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Open-Source Attribution Footer (Moved from global page footer) */}
      <div className="text-center text-xs text-stone-400 font-mono py-3.5 border-t border-[#4d3723]/60 mt-3 shrink-0">
        Open-source personal web project built by me, Chris Jones (stopherjones). For more information, see{' '}
        <a
          href="https://stopherjones.github.io/about.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors font-bold"
        >
          About Me
        </a>
      </div>
    </div>
  );
};
