/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Heart,
  Wand2,
  Zap,
  Shield,
  Coins,
  Dices,
  Utensils,
  Flame,
  Key,
  Package,
  BookOpen,
  Sword,
  Sparkles,
} from 'lucide-react';
import { GameItem, HeroCharacter, StatType } from '../types/game';
import { getStatModifier } from '../utils/dice';

interface CharacterSheetProps {
  hero: HeroCharacter;
  onOpenInventory: () => void;
  onOpenJournal: () => void;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({
  hero,
  onOpenInventory,
  onOpenJournal,
}) => {
  // Calculate total stats including equipment
  const computedStats = { ...hero.stats };
  let computedArmor = 10 + getStatModifier(computedStats.DEX); // Base AC = 10 + DEX mod

  // Apply equipment bonuses
  (Object.values(hero.equipment) as (GameItem | undefined)[]).forEach((item) => {
    if (!item) return;
    if (item.armorBonus) computedArmor += item.armorBonus;
    if (item.statBonuses) {
      (Object.keys(item.statBonuses) as StatType[]).forEach((stat) => {
        computedStats[stat] += item.statBonuses![stat] || 0;
      });
    }
  });

  const hpPercent = Math.max(0, Math.min(100, (hero.currentHp / hero.maxHp) * 100));
  const manaPercent = Math.max(0, Math.min(100, (hero.currentMana / hero.maxMana) * 100));
  const xpPercent = Math.max(0, Math.min(100, (hero.xp / hero.xpToNextLevel) * 100));

  return (
    <div
      id="hero-character-sheet"
      className="bg-[#241a12] border-2 border-[#735438] rounded-lg p-3.5 text-stone-200 shadow-xl"
    >
      {/* Top Hero Identity Banner */}
      <div className="flex items-center justify-between border-b border-[#4d3723] pb-2.5 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-serif font-bold text-[#f5e4c6] tracking-wide">{hero.name}</h2>
            <span className="text-[10px] font-mono font-bold bg-[#3d2a19] text-[#e5b967] px-2 py-0.5 rounded border border-[#6b4c2b] uppercase">
              Lv. {hero.level} {hero.destinyProfile?.title || hero.classId}
            </span>
          </div>
          <div className="text-[11px] text-stone-400 font-serif">AC {computedArmor} • Total Defense</div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-open-inventory"
            onClick={onOpenInventory}
            className="px-2.5 py-1 bg-[#3a2818] hover:bg-[#523922] text-amber-200 border border-[#6e4e2d] rounded text-xs font-serif flex items-center gap-1 transition-colors"
            title="Open Backpack Inventory"
          >
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Pack</span>
            <span className="text-[10px] font-mono text-stone-400">({hero.inventory.length})</span>
          </button>

          <button
            id="btn-open-journal"
            onClick={onOpenJournal}
            className="px-2 py-1 bg-[#3a2818] hover:bg-[#523922] text-amber-200 border border-[#6e4e2d] rounded text-xs font-serif flex items-center gap-1 transition-colors"
            title="Adventure Log & Stats"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Vitals Bars: HP, Mana, XP */}
      <div className="space-y-2 mb-3">
        {/* Health */}
        <div>
          <div className="flex justify-between text-[11px] font-mono mb-0.5">
            <span className="text-red-300 flex items-center gap-1">
              <Heart className="w-3 h-3 text-red-500 fill-red-500" /> HP
            </span>
            <span className="font-bold text-red-200">
              {hero.currentHp} / {hero.maxHp}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#140e0a] rounded-full overflow-hidden border border-[#442e1d]">
            <div
              className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-300"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* Energy */}
        <div>
          <div className="flex justify-between text-[11px] font-mono mb-0.5">
            <span className="text-cyan-300 flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" /> Energy
            </span>
            <span className="font-bold text-cyan-200">
              {hero.currentMana} / {hero.maxMana} EP
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#140e0a] rounded-full overflow-hidden border border-[#442e1d]">
            <div
              className="h-full bg-gradient-to-r from-blue-700 to-cyan-500 transition-all duration-300"
              style={{ width: `${manaPercent}%` }}
            />
          </div>
        </div>

        {/* XP */}
        <div>
          <div className="flex justify-between text-[10px] font-mono mb-0.5 text-stone-400">
            <span>Experience</span>
            <span>
              {hero.xp} / {hero.xpToNextLevel} XP
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#140e0a] rounded-full overflow-hidden border border-[#382618]">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-300"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-1.5 text-center mb-3 bg-[#17100a] p-1.5 rounded border border-[#422e1d]">
        {(['STR', 'DEX', 'CON', 'INT', 'LCK'] as const).map((stat) => {
          const val = computedStats[stat];
          const mod = getStatModifier(val);
          return (
            <div key={stat} className="flex flex-col">
              <span className="text-[9px] font-mono text-stone-400">{stat}</span>
              <span className="text-xs font-mono font-bold text-[#f5dfb8]">{val}</span>
              <span className={`text-[9px] font-mono ${mod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {mod >= 0 ? `+${mod}` : mod}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active Buffs / Spell Modifiers (Visible for as long as they last) */}
      {hero.activeEffects && hero.activeEffects.length > 0 && (
        <div className="mb-2.5 p-2 bg-[#1b1526] border border-purple-500/70 rounded-lg animate-pulse shadow-md">
          <div className="flex items-center gap-1.5 text-purple-300 font-serif font-bold text-[11px] mb-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Active Magical Modifiers & Buffs ({hero.activeEffects.length})</span>
          </div>
          <div className="space-y-1">
            {hero.activeEffects.map((effect) => (
              <div
                key={effect.id}
                className="bg-[#120c1c] p-1.5 rounded border border-purple-900/60 flex items-center justify-between text-[10px]"
              >
                <div>
                  <span className="font-bold text-purple-200">{effect.name}: </span>
                  <span className="text-stone-300 font-serif">{effect.description}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300 font-mono font-bold shrink-0">
                  {effect.durationTurns} turns
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Spells & Grimoire in Pack / Equipment */}
      <div className="border-t border-[#44301d] pt-2 mb-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1">
            <Wand2 className="w-3 h-3 text-cyan-400" /> Available Spells & Abilities:
          </span>
          <span className="text-[10px] font-mono text-cyan-300 font-bold">
            {hero.currentMana} / {hero.maxMana} MP
          </span>
        </div>

        <div className="space-y-1">
          {hero.skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-[#14121a] p-1.5 rounded border border-[#3b3252] flex items-center justify-between text-xs"
            >
              <div className="truncate mr-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-cyan-200 text-[11px] truncate">
                    {skill.name}
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                    {skill.manaCost} MP
                  </span>
                </div>
                <div className="text-[10px] text-stone-400 font-serif truncate">
                  {skill.diceFormula ? `${skill.diceFormula} • ` : ''}
                  {skill.description}
                </div>
              </div>
            </div>
          ))}

          {/* Spell Scrolls in Adventurer's Pack */}
          {hero.inventory
            .filter((inv) => inv.item.type === 'scroll')
            .map((inv, idx) => (
              <div
                key={`scroll-${idx}`}
                className="bg-[#18111e] p-1.5 rounded border border-purple-900/60 flex items-center justify-between text-xs"
              >
                <div className="truncate">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="font-serif font-bold text-purple-200 text-[11px] truncate">
                      {inv.item.name} {inv.quantity > 1 ? `(x${inv.quantity})` : ''}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-400 font-serif truncate">
                    {inv.item.description}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Wealth & Fate Currency */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="flex items-center justify-between bg-[#171008] px-2.5 py-1.5 rounded-lg border border-amber-600/60 shadow-inner">
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-[10px] font-serif text-amber-200/90 uppercase font-bold">Gold:</span>
          </div>
          <span className="text-xs font-mono font-bold text-yellow-300">{hero.gold} GP</span>
        </div>

        <div className="flex items-center justify-between bg-[#1b1226] px-2.5 py-1.5 rounded-lg border border-purple-500/60 shadow-inner">
          <div className="flex items-center gap-1.5">
            <Dices className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[10px] font-serif text-purple-200/90 uppercase font-bold">Fate:</span>
          </div>
          <span className="text-xs font-mono font-bold text-purple-200">{hero.rerollTokens} Tokens</span>
        </div>
      </div>

      {/* Backpack Storage & Physical Items */}
      <div className="border-t border-[#44301d] pt-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-mono text-amber-300 font-bold uppercase tracking-wider">
              Backpack Storage
            </span>
          </div>
          <span className="text-[11px] font-mono text-stone-300 font-bold">
            {hero.inventory.length} / {hero.maxInventorySlots} Slots
          </span>
        </div>

        {/* Backpack Capacity Bar */}
        <div className="w-full h-1.5 bg-[#140e0a] rounded-full overflow-hidden border border-[#382618] mb-2">
          <div
            className={`h-full transition-all duration-300 ${
              hero.inventory.length >= hero.maxInventorySlots
                ? 'bg-red-500'
                : hero.inventory.length >= hero.maxInventorySlots - 2
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
            }`}
            style={{ width: `${Math.min(100, (hero.inventory.length / hero.maxInventorySlots) * 100)}%` }}
          />
        </div>

        {/* Backpack Items List Preview */}
        <div className="grid grid-cols-2 gap-1 mb-2 max-h-36 overflow-y-auto pr-0.5">
          {hero.inventory.map((inv, idx) => (
            <div
              key={idx}
              className="bg-[#181109] border border-[#3b2716] hover:border-[#634529] p-1.5 rounded flex items-center justify-between text-[10px] text-stone-300 transition-colors"
              title={`${inv.item.name} (${inv.item.type})`}
            >
              <div className="flex items-center gap-1.5 truncate mr-1">
                {inv.item.id === 'dungeon_ration' ? (
                  <Utensils className="w-3 h-3 text-amber-500 shrink-0" />
                ) : inv.item.id === 'iron_lockpick' ? (
                  <Key className="w-3 h-3 text-cyan-400 shrink-0" />
                ) : inv.item.id === 'dungeon_torch' ? (
                  <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                ) : inv.item.type === 'potion' ? (
                  <Heart className="w-3 h-3 text-red-400 shrink-0" />
                ) : inv.item.type === 'scroll' ? (
                  <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                ) : inv.item.type === 'weapon' ? (
                  <Sword className="w-3 h-3 text-red-300 shrink-0" />
                ) : (
                  <Shield className="w-3 h-3 text-blue-300 shrink-0" />
                )}
                <span className="font-serif truncate font-bold text-amber-100/90">{inv.item.name}</span>
              </div>
              <span className="text-[9px] font-mono text-yellow-400/80 shrink-0">
                {inv.item.value}g
              </span>
            </div>
          ))}

          {hero.inventory.length === 0 && (
            <div className="col-span-2 text-center py-2 text-stone-500 font-serif text-[11px]">
              Backpack empty
            </div>
          )}
        </div>

        <button
          id="btn-manage-backpack"
          onClick={onOpenInventory}
          className="w-full py-1.5 bg-[#3a2818] hover:bg-[#4f3621] text-amber-200 border border-[#6b4b2c] rounded text-xs font-serif font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Package className="w-3.5 h-3.5 text-amber-400" />
          <span>Manage Backpack & Equip Gear</span>
        </button>
      </div>
    </div>
  );
};
