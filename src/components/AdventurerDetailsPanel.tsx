/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Heart,
  Zap,
  Shield,
  Coins,
  Dices,
  BookOpen,
  Sword,
  Sparkles,
  Wand2,
  Package,
  Compass,
  ChevronLeft,
  ChevronRight,
  Flame,
  Info,
  Scroll,
} from 'lucide-react';
import { GameItem, HeroCharacter, StatType } from '../types/game';
import { getStatModifier } from '../utils/dice';

interface AdventurerDetailsPanelProps {
  hero: HeroCharacter;
  historyLog: string[];
  onOpenInventory: () => void;
  onOpenJournal: () => void;
  onGoToBackpack: () => void;
  onGoToMap: () => void;
}

export const AdventurerDetailsPanel: React.FC<AdventurerDetailsPanelProps> = ({
  hero,
  historyLog,
  onOpenInventory,
  onOpenJournal,
  onGoToBackpack,
  onGoToMap,
}) => {
  const [activeTab, setActiveTab] = useState<'STATS_ABILITIES' | 'EXPEDITION_LOG'>('STATS_ABILITIES');

  // Compute total stats including equipment bonuses
  const computedStats = { ...hero.stats };
  let computedArmor = 10 + getStatModifier(computedStats.DEX);

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

  // Find equipped weapon for quick combat display
  const equippedWeapon = hero.equipment.weapon;

  return (
    <div className="w-full flex flex-col gap-3.5">
      {/* Hero Core Identity & Quick Panel Navigator Banner */}
      <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3 sm:p-4 text-stone-200 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#4d3723] pb-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#171008] border-2 border-amber-600/70 rounded-xl text-amber-300 shadow-inner flex items-center justify-center">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-serif font-black text-[#f5e4c6] tracking-wide">
                  {hero.name}
                </h2>
                <span className="text-[10px] font-mono font-bold bg-[#382717] text-[#e5b967] px-2 py-0.5 rounded border border-[#5c3e23] uppercase">
                  Lv. {hero.level} {hero.classId}
                </span>
                <span className="text-[10px] font-mono text-amber-300/80 bg-[#171008] px-2 py-0.5 rounded border border-[#3b2717] hidden xs:inline">
                  Panel 2 of 4
                </span>
              </div>
              <div className="text-xs text-stone-400 font-serif flex items-center gap-2 mt-0.5">
                <span className="text-amber-200 font-bold">AC {computedArmor} Defense</span>
                <span>•</span>
                <span>
                  Weapon:{' '}
                  <span className="text-amber-100 font-bold">
                    {equippedWeapon ? equippedWeapon.name : 'Unarmed Strike (1d4)'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Panel Jump Affordances */}
          <div className="flex items-center gap-2">
            <button
              onClick={onGoToBackpack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3a2818] hover:bg-[#523922] text-amber-200 border border-[#6e4e2d] rounded-lg text-xs font-serif transition-colors cursor-pointer"
              title="Swipe left or click to view Backpack"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Backpack ({hero.inventory.length})</span>
            </button>

            <button
              onClick={onGoToMap}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3a2818] hover:bg-[#523922] text-amber-200 border border-[#6e4e2d] rounded-lg text-xs font-serif transition-colors cursor-pointer"
              title="Swipe right or click to view Dungeon Map"
            >
              <span>Dungeon Map</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Vitals Bars: HP, Energy/Mana, XP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#181109] border border-[#442d1b] p-2.5 rounded-lg mb-3">
          {/* Health */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-red-300 flex items-center gap-1 font-bold">
                <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> HP (Health)
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
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-cyan-300 flex items-center gap-1 font-bold">
                <Zap className="w-3.5 h-3.5 text-cyan-400" /> EP (Energy / MP)
              </span>
              <span className="font-bold text-cyan-200">
                {hero.currentMana} / {hero.maxMana}
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#140e0a] rounded-full overflow-hidden border border-[#442e1d]">
              <div
                className="h-full bg-gradient-to-r from-blue-700 to-cyan-500 transition-all duration-300"
                style={{ width: `${manaPercent}%` }}
              />
            </div>
          </div>

          {/* XP Progress */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-amber-300 flex items-center gap-1 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Experience
              </span>
              <span className="font-bold text-amber-200">
                {hero.xp} / {hero.xpToNextLevel} XP
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#140e0a] rounded-full overflow-hidden border border-[#442e1d]">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-300"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 5 Core Attributes Bar */}
        <div className="grid grid-cols-5 gap-2 text-center bg-[#17100a] p-2 rounded-lg border border-[#422e1d]">
          {(
            [
              { stat: 'STR', label: 'Strength' },
              { stat: 'DEX', label: 'Dexterity' },
              { stat: 'CON', label: 'Constitution' },
              { stat: 'INT', label: 'Intelligence' },
              { stat: 'LCK', label: 'Luck' },
            ] as const
          ).map(({ stat, label }) => {
            const val = computedStats[stat];
            const mod = getStatModifier(val);
            return (
              <div key={stat} className="flex flex-col items-center">
                <span className="text-[10px] font-mono text-stone-400 uppercase font-bold">{stat}</span>
                <span className="text-sm font-mono font-bold text-[#f5dfb8]">{val}</span>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    mod >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {mod >= 0 ? `+${mod}` : mod}
                </span>
                <span className="text-[8px] text-stone-500 font-serif hidden sm:inline">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Buffs / Spell Modifiers */}
      {hero.activeEffects && hero.activeEffects.length > 0 && (
        <div className="p-3 bg-[#1b1526] border border-purple-500/70 rounded-xl shadow-md">
          <div className="flex items-center gap-1.5 text-purple-300 font-serif font-bold text-xs mb-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Active Magical Modifiers & Buffs ({hero.activeEffects.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {hero.activeEffects.map((effect) => (
              <div
                key={effect.id}
                className="bg-[#120c1c] p-2 rounded-lg border border-purple-900/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-purple-200">{effect.name}: </span>
                  <span className="text-stone-300 font-serif text-[11px]">{effect.description}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300 font-mono font-bold shrink-0 text-[10px] ml-2">
                  {effect.durationTurns} turns
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spells, Abilities & Adventure Log Tabs */}
      <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3.5 text-stone-200 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#4d3723] pb-2.5">
          <div className="flex items-center gap-1 bg-[#171008] p-0.5 rounded-lg border border-[#442d1b]">
            <button
              onClick={() => setActiveTab('STATS_ABILITIES')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-serif transition-colors cursor-pointer ${
                activeTab === 'STATS_ABILITIES'
                  ? 'bg-[#4a321e] text-amber-100 font-bold shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Spells & Abilities ({hero.skills.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('EXPEDITION_LOG')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-serif transition-colors cursor-pointer ${
                activeTab === 'EXPEDITION_LOG'
                  ? 'bg-[#4a321e] text-amber-100 font-bold shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Scroll className="w-3.5 h-3.5 text-amber-400" />
              <span>Recent Adventure Log</span>
            </button>
          </div>

          {activeTab === 'EXPEDITION_LOG' && (
            <button
              onClick={onOpenJournal}
              className="text-xs font-serif text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              Full Journal ➔
            </button>
          )}
        </div>

        {activeTab === 'STATS_ABILITIES' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {hero.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="bg-[#181220] p-2.5 rounded-lg border border-[#3b2d54] flex flex-col justify-between text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-serif font-bold text-cyan-200 text-xs">{skill.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                      {skill.manaCost} EP
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-300 font-serif leading-relaxed mb-1">
                    {skill.description}
                  </p>
                  {skill.diceFormula && (
                    <div className="text-[10px] font-mono text-purple-300 bg-[#120a1c] px-2 py-0.5 rounded border border-purple-900/60 inline-block self-start">
                      Formula: {skill.diceFormula}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Spell Scrolls in backpack */}
            {hero.inventory.some((i) => i.item.type === 'scroll') && (
              <div className="pt-2 border-t border-[#442e1d] mt-2">
                <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider block mb-1.5">
                  Carried Spell Scrolls in Backpack:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {hero.inventory
                    .filter((inv) => inv.item.type === 'scroll')
                    .map((inv, idx) => (
                      <div
                        key={`scroll-${idx}`}
                        className="bg-[#18111e] p-2 rounded-lg border border-purple-900/60 flex items-center justify-between text-xs"
                      >
                        <div className="truncate mr-1">
                          <span className="font-serif font-bold text-purple-200 block truncate">
                            {inv.item.name} {inv.quantity > 1 ? `(x${inv.quantity})` : ''}
                          </span>
                          <span className="text-[10px] text-stone-400 font-serif block truncate">
                            {inv.item.description}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-purple-400 bg-purple-950 px-1 py-0.5 rounded border border-purple-800 shrink-0">
                          Single-use
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Recent Expedition Log */
          <div className="bg-[#140e08] border border-[#3d2716] rounded-lg p-3 max-h-64 overflow-y-auto space-y-1.5 font-serif text-xs">
            {historyLog && historyLog.length > 0 ? (
              historyLog.slice(0, 15).map((log, idx) => (
                <div
                  key={idx}
                  className={`p-1.5 rounded text-stone-300 leading-snug border-l-2 ${
                    idx === 0
                      ? 'bg-[#22160d] border-amber-500 text-amber-100 font-medium'
                      : 'border-stone-700/60 bg-[#17100a]/50 text-stone-400'
                  }`}
                >
                  <span className="font-mono text-[10px] text-stone-500 mr-1.5">
                    #{historyLog.length - idx}
                  </span>
                  <span>{log}</span>
                </div>
              ))
            ) : (
              <div className="text-stone-500 italic text-center py-4">No logged events yet.</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Buttons to Adjacent Panels */}
      <div className="flex items-center justify-between gap-3 text-xs font-serif pt-1">
        <button
          onClick={onGoToBackpack}
          className="flex-1 py-2 px-3 bg-[#241a12] hover:bg-[#382618] border border-[#6b4c2b] text-amber-200 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
        >
          <ChevronLeft className="w-4 h-4 text-amber-400" />
          <span>Swipe Left for Backpack & Equipment</span>
        </button>

        <button
          onClick={onGoToMap}
          className="flex-1 py-2 px-3 bg-[#241a12] hover:bg-[#382618] border border-[#6b4c2b] text-amber-200 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
        >
          <span>Swipe Right for Dungeon Map & Chambers</span>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </button>
      </div>
    </div>
  );
};
