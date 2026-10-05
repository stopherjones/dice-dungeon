/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Package,
  X,
  Sword,
  Shield,
  Sparkles,
  Heart,
  Wand2,
  Coins,
  Flame,
  Key,
  Utensils,
  Dices,
  Compass,
  Hammer,
  Trash2,
  ArrowRight,
  Eye,
  Check,
  ChevronRight,
} from 'lucide-react';
import { GameItem, HeroCharacter, StatType } from '../types/game';
import { sounds } from '../utils/audio';
import { dropItemFromHero, syncHeroSupplies } from '../utils/inventory';
import { getStatModifier } from '../utils/dice';

interface BackpackPanelProps {
  hero: HeroCharacter;
  onUpdateHero: (hero: HeroCharacter) => void;
  onActivateMapAction: (
    action: 'TORCH' | 'CLAIRVOYANCE' | 'SPYGLASS' | 'SMASH_WALL' | 'PHASE_WALL'
  ) => void;
  onGoToMap: () => void;
  onGoToAdventurer: () => void;
}

type InspectTarget =
  | { type: 'inventory'; index: number; item: GameItem }
  | { type: 'equipment'; slot: keyof HeroCharacter['equipment']; item: GameItem }
  | null;

type ItemFilter = 'ALL' | 'GEAR' | 'CONSUMABLES' | 'TOOLS';

export const BackpackPanel: React.FC<BackpackPanelProps> = ({
  hero,
  onUpdateHero,
  onActivateMapAction,
  onGoToMap,
  onGoToAdventurer,
}) => {
  const [inspectTarget, setInspectTarget] = useState<InspectTarget>(null);
  const [filter, setFilter] = useState<ItemFilter>('ALL');

  // Equip Item
  const handleEquipItem = (invIdx: number) => {
    const inv = hero.inventory[invIdx];
    if (!inv) return;
    const item = inv.item;
    sounds.playBlock();

    let slotKey: keyof HeroCharacter['equipment'] | null = null;
    if (item.type === 'weapon') slotKey = 'weapon';
    else if (item.type === 'shield') slotKey = 'offhand';
    else if (item.type === 'armor') slotKey = 'armor';
    else if (item.type === 'helmet') slotKey = 'helmet';
    else if (item.type === 'boots') slotKey = 'boots';
    else if (item.type === 'ring') slotKey = 'ring';
    else if (item.type === 'amulet') slotKey = 'amulet';

    if (!slotKey) return;

    // Swap old item into inventory
    const oldItem = hero.equipment[slotKey];
    hero.equipment[slotKey] = item;

    // Remove from inventory
    hero.inventory.splice(invIdx, 1);

    if (oldItem) {
      hero.inventory.push({ item: oldItem, quantity: 1 });
    }

    syncHeroSupplies(hero);
    setInspectTarget(null);
    onUpdateHero({ ...hero });
  };

  // Unequip slot
  const handleUnequipSlot = (slotKey: keyof HeroCharacter['equipment']) => {
    const item = hero.equipment[slotKey];
    if (!item) return;
    if (hero.inventory.length >= hero.maxInventorySlots) {
      sounds.playBlock();
      return;
    }

    sounds.playBlock();
    hero.equipment[slotKey] = undefined;
    hero.inventory.push({ item, quantity: 1 });
    syncHeroSupplies(hero);
    setInspectTarget(null);
    onUpdateHero({ ...hero });
  };

  // Use consumable item outside combat
  const handleUseItem = (invIdx: number) => {
    const inv = hero.inventory[invIdx];
    if (!inv || !inv.item.usableOutOfCombat) return;
    const item = inv.item;

    if (item.healHp) {
      sounds.playHeal();
      hero.currentHp = Math.min(hero.maxHp, hero.currentHp + item.healHp);
    }
    if (item.healMana) {
      sounds.playSpell();
      hero.currentMana = Math.min(hero.maxMana, hero.currentMana + item.healMana);
    }

    hero.inventory.splice(invIdx, 1);
    setInspectTarget(null);

    syncHeroSupplies(hero);
    onUpdateHero({ ...hero });
  };

  // Drop / Discard item to free backpack slot
  const handleDropItem = (invIdx: number) => {
    sounds.playTrap();
    dropItemFromHero(hero, invIdx);
    setInspectTarget(null);
    onUpdateHero({ ...hero });
  };

  const getItemCategoryLabel = (item: GameItem) => {
    if (item.id === 'dungeon_ration') return 'Ration / Food';
    if (item.id === 'iron_lockpick') return 'Lockpick Tool';
    if (item.id === 'dungeon_torch') return 'Torch Tool';
    if (item.id === 'brass_spyglass') return 'Scouting Scope';
    if (item.id === 'dice_of_fate') return 'Relic / Fate';
    if (item.type === 'potion') return 'Potion / Draught';
    if (item.type === 'scroll') return 'Spell Scroll';
    if (item.type === 'weapon') return 'Weapon';
    if (item.type === 'shield') return 'Shield / Offhand';
    if (item.type === 'armor') return 'Armor';
    if (item.type === 'helmet') return 'Headgear';
    if (item.type === 'boots') return 'Footwear';
    if (item.type === 'ring') return 'Ring';
    if (item.type === 'amulet') return 'Amulet';
    if (item.type === 'treasure') return 'Treasure / Gem';
    return item.type;
  };

  const getItemUsageBadge = (item: GameItem) => {
    if (
      item.type === 'potion' ||
      item.type === 'scroll' ||
      item.id === 'dungeon_torch' ||
      item.id === 'dungeon_ration' ||
      item.id === 'miner_pickaxe'
    ) {
      return { label: 'Single-use', bg: 'bg-amber-950/80 text-amber-300 border-amber-600/70' };
    }
    if (item.id === 'dwarven_sledgehammer') {
      return { label: '2 Uses', bg: 'bg-orange-950/80 text-orange-300 border-orange-600/70' };
    }
    if (item.id === 'iron_lockpick' || item.id === 'brass_spyglass' || item.id === 'ethereal_ring') {
      return { label: 'Reusable Tool', bg: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/70' };
    }
    if (['weapon', 'shield', 'armor', 'helmet', 'boots', 'ring', 'amulet'].includes(item.type)) {
      return { label: 'Equipment', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
    }
    if (item.type === 'treasure') {
      return { label: 'Treasure', bg: 'bg-yellow-950/80 text-yellow-300 border-yellow-500/70' };
    }
    return { label: 'Item', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  };

  const getItemIcon = (item: GameItem) => {
    if (item.id === 'dungeon_ration') return <Utensils className="w-4 h-4 text-amber-500 shrink-0" />;
    if (item.id === 'iron_lockpick') return <Key className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (item.id === 'dungeon_torch') return <Flame className="w-4 h-4 text-orange-400 shrink-0" />;
    if (item.id === 'brass_spyglass') return <Compass className="w-4 h-4 text-cyan-300 shrink-0" />;
    if (item.id === 'dice_of_fate') return <Dices className="w-4 h-4 text-purple-400 shrink-0" />;
    if (item.type === 'potion') return <Heart className="w-4 h-4 text-red-400 shrink-0" />;
    if (item.type === 'scroll') return <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />;
    if (item.type === 'weapon') return <Sword className="w-4 h-4 text-red-300 shrink-0" />;
    if (item.type === 'shield') return <Shield className="w-4 h-4 text-blue-300 shrink-0" />;
    if (item.specialEffect === 'SMASH_WALL') return <Hammer className="w-4 h-4 text-amber-400 shrink-0" />;
    return <Package className="w-4 h-4 text-stone-400 shrink-0" />;
  };

  // Filter items
  const filteredInventory = hero.inventory
    .map((inv, originalIdx) => ({ ...inv, originalIdx }))
    .filter(({ item }) => {
      if (filter === 'GEAR') {
        return ['weapon', 'shield', 'armor', 'helmet', 'boots', 'ring', 'amulet'].includes(item.type);
      }
      if (filter === 'CONSUMABLES') {
        return item.type === 'potion' || item.type === 'scroll' || item.id === 'dungeon_ration';
      }
      if (filter === 'TOOLS') {
        return (
          item.id === 'dungeon_torch' ||
          item.id === 'iron_lockpick' ||
          item.id === 'brass_spyglass' ||
          item.id === 'dice_of_fate' ||
          item.specialEffect === 'SMASH_WALL' ||
          item.type === 'treasure'
        );
      }
      return true;
    });

  // Calculate equipment bonuses
  let totalEquippedArmor = 0;
  let totalEquippedDamage = '';
  (Object.values(hero.equipment) as (GameItem | undefined)[]).forEach((item) => {
    if (!item) return;
    if (item.armorBonus) totalEquippedArmor += item.armorBonus;
    if (item.damageDice) totalEquippedDamage = item.damageDice + (item.bonusDamage ? `+${item.bonusDamage}` : '');
  });

  return (
    <div className="w-full flex flex-col gap-3.5">
      {/* Top Backpack Header & Wealth Summary */}
      <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3 sm:p-4 text-stone-200 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#4d3723] pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#171008] border border-amber-600/70 rounded-lg text-amber-300 shadow-inner">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-serif font-black text-[#f5e4c6] leading-tight">
                  Adventurer's Backpack
                </h2>
              </div>
              <span className="text-[11px] font-serif text-stone-400 block">
                Manage inventory, equip weapons & activate dungeon tools
              </span>
            </div>
          </div>

          {/* Gold & Fate Tokens */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 bg-[#171008] px-3 py-1.5 rounded-lg border border-amber-500/70 text-amber-300 font-mono shadow-inner text-xs"
              title="Gold pieces for trading with dungeon merchants"
            >
              <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] text-amber-400/80 uppercase font-bold">Gold</span>
                <span className="font-bold text-yellow-300">{hero.gold} GP</span>
              </div>
            </div>

            <div
              className="flex items-center gap-2 bg-[#1b1226] px-3 py-1.5 rounded-lg border border-purple-500/70 text-purple-200 font-mono shadow-inner text-xs"
              title="Fate Reroll Tokens for retrying d20 rolls"
            >
              <Dices className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] text-purple-400 uppercase font-bold">Fate</span>
                <span className="font-bold text-purple-200">{hero.rerollTokens} Tokens</span>
              </div>
            </div>
          </div>
        </div>

        {/* Capacity Bar & Quick Supply Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono bg-[#181109] border border-[#442d1b] p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-stone-300 font-serif font-bold">Pack Capacity:</span>
            <span className="font-bold text-amber-300">
              {hero.inventory.length} / {hero.maxInventorySlots} Slots
            </span>
            <div className="w-24 sm:w-32 h-2 bg-[#120b07] rounded-full overflow-hidden border border-[#3d2817]">
              <div
                className={`h-full transition-all duration-300 ${
                  hero.inventory.length >= hero.maxInventorySlots
                    ? 'bg-red-500'
                    : hero.inventory.length >= hero.maxInventorySlots - 2
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, (hero.inventory.length / hero.maxInventorySlots) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Quick Rations and Torches */}
          <div className="flex items-center gap-2">
            {hero.rations > 0 && (
              <button
                id="btn-panel-quick-ration"
                onClick={() => {
                  const idx = hero.inventory.findIndex((i) => i.item.id === 'dungeon_ration');
                  if (idx !== -1) handleUseItem(idx);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#24160d] hover:bg-[#382315] border border-[#52331d] text-amber-200 transition-colors cursor-pointer text-xs"
                title="Consume 1 Ration (+8 HP & +6 Energy)"
              >
                <Utensils className="w-3.5 h-3.5 text-amber-500" />
                <span>Eat Ration ({hero.rations})</span>
              </button>
            )}

            {hero.torches > 0 && (
              <button
                id="btn-panel-quick-torch"
                onClick={() => {
                  onActivateMapAction('TORCH');
                  onGoToMap();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2a170a] hover:bg-[#42230e] border border-[#6b3814] text-orange-200 transition-colors cursor-pointer text-xs"
                title="Light 1 Torch and target an adjacent room on the Map"
              >
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Light Torch ({hero.torches}) ➔</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Equipped Gear & Weapons */}
        <div className="lg:col-span-5 bg-[#241a12] border-2 border-[#735438] rounded-xl p-3.5 text-stone-200 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#4d3723] pb-2">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-serif font-bold text-[#f5e4c6] uppercase tracking-wider">
                Equipped Gear & Arms
              </h3>
            </div>
            {totalEquippedArmor > 0 && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1.5 py-0.5 rounded">
                +{totalEquippedArmor} AC Bonus
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {(
              [
                { slot: 'weapon', label: 'Main Hand (Weapon)' },
                { slot: 'offhand', label: 'Offhand (Shield / Tome)' },
                { slot: 'armor', label: 'Body Armor' },
                { slot: 'helmet', label: 'Headgear' },
                { slot: 'boots', label: 'Footwear' },
                { slot: 'ring', label: 'Finger Ring' },
                { slot: 'amulet', label: 'Necklace / Amulet' },
              ] as const
            ).map(({ slot, label }) => {
              const item = hero.equipment[slot];
              return (
                <div
                  key={slot}
                  onClick={() => {
                    if (item) {
                      sounds.playBlock();
                      setInspectTarget({ type: 'equipment', slot, item });
                    }
                  }}
                  className={`p-2 bg-[#181109] border border-[#442e1d] rounded-lg flex items-center justify-between transition-all ${
                    item ? 'hover:bg-[#2c1d11] hover:border-amber-600/70 cursor-pointer shadow-sm' : 'opacity-65'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    <div className="p-1 bg-[#120c08] rounded border border-[#3b2717] text-amber-400 shrink-0">
                      {slot === 'weapon' ? (
                        <Sword className="w-3.5 h-3.5 text-red-400" />
                      ) : slot === 'offhand' ? (
                        <Shield className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Package className="w-3.5 h-3.5 text-amber-300" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className="text-[9px] font-mono text-stone-500 block uppercase leading-none mb-0.5">
                        {label}
                      </span>
                      <span className="text-xs font-serif font-bold text-amber-100 truncate block">
                        {item ? item.name : '— Empty Slot —'}
                      </span>
                    </div>
                  </div>

                  {item && (
                    <div className="flex items-center gap-1 shrink-0">
                      {item.damageDice && (
                        <span className="text-[9px] font-mono text-red-300 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800">
                          {item.damageDice}
                        </span>
                      )}
                      {item.armorBonus && (
                        <span className="text-[9px] font-mono text-blue-300 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800">
                          +{item.armorBonus} AC
                        </span>
                      )}
                      <span className="text-[10px] font-serif text-amber-400/90 underline ml-1">
                        Inspect
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#442e1d] text-[11px] font-serif text-stone-400 flex items-center justify-between">
            <span>Equipped gear adds passive AC & combat damage</span>
            <span className="text-amber-300 font-bold">7 Slots</span>
          </div>
        </div>

        {/* Right Column: Backpack Inventory Grid & Item Inspector */}
        <div className="lg:col-span-7 bg-[#241a12] border-2 border-[#735438] rounded-xl p-3.5 text-stone-200 shadow-xl flex flex-col gap-3">
          {/* Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#4d3723] pb-2.5">
            <div>
              <h3 className="text-xs font-serif font-bold text-[#f5e4c6] uppercase tracking-wider">
                Backpack Items ({hero.inventory.length} / {hero.maxInventorySlots})
              </h3>
              <span className="text-[10px] font-serif text-stone-400">
                Click any item to inspect, use, equip, or activate
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 p-0.5 bg-[#171008] rounded-lg border border-[#442d1b] text-[10px] font-serif">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'GEAR', label: 'Gear' },
                  { id: 'CONSUMABLES', label: 'Potions' },
                  { id: 'TOOLS', label: 'Tools' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    filter === tab.id
                      ? 'bg-[#4a321e] text-amber-100 font-bold shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Items */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredInventory.map((inv) => {
              const badge = getItemUsageBadge(inv.item);
              const isSelected =
                inspectTarget?.type === 'inventory' && inspectTarget.index === inv.originalIdx;

              return (
                <button
                  key={inv.originalIdx}
                  onClick={() => {
                    sounds.playBlock();
                    setInspectTarget({ type: 'inventory', index: inv.originalIdx, item: inv.item });
                  }}
                  className={`p-2 rounded-lg border text-left flex flex-col justify-between min-h-[76px] transition-all cursor-pointer shadow-sm group ${
                    isSelected
                      ? 'bg-[#3b2716] border-[#d4a86a] ring-1 ring-[#d4a86a]'
                      : 'bg-[#181109] border-[#442e1d] text-stone-300 hover:bg-[#2b1b10] hover:border-[#7a5530]'
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-1.5 mb-1">
                      {getItemIcon(inv.item)}
                      <span className="font-serif font-bold text-xs line-clamp-2 leading-tight text-amber-100 group-hover:text-amber-300">
                        {inv.item.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono pt-1 border-t border-[#362315]/60 mt-1">
                    <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-[9px] text-yellow-400/90 font-mono">{inv.item.value}g</span>
                  </div>
                </button>
              );
            })}

            {/* Empty slot placeholders */}
            {filter === 'ALL' &&
              Array.from({ length: Math.max(0, hero.maxInventorySlots - hero.inventory.length) }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="p-2 rounded-lg border border-dashed border-[#382618]/70 bg-[#120c08]/50 flex flex-col items-center justify-center min-h-[76px] text-[10px] font-mono text-stone-600 select-none"
                  >
                    <span>[ Empty Slot ]</span>
                  </div>
                )
              )}
          </div>

          {filteredInventory.length === 0 && (
            <div className="text-center py-6 text-stone-500 font-serif text-xs">
              No items matching this category filter.
            </div>
          )}

          {/* Quick Item Inspector within the Panel */}
          {inspectTarget && (
            <div className="mt-2 p-3 bg-[#19110a] border-2 border-[#946e3e] rounded-xl shadow-lg animate-fade-in flex flex-col gap-2.5">
              <div className="flex items-start justify-between border-b border-[#4d3521] pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#120c08] border border-amber-600/70 rounded text-amber-300">
                    {getItemIcon(inspectTarget.item)}
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-sm text-[#fae9cb] leading-tight">
                      {inspectTarget.item.name}
                    </h4>
                    <span className="text-[10px] font-mono text-amber-400/80">
                      {getItemCategoryLabel(inspectTarget.item)} • {inspectTarget.item.value} GP
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setInspectTarget(null)}
                  className="p-1 text-stone-400 hover:text-stone-200 cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats badges */}
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                {inspectTarget.item.damageDice && (
                  <span className="bg-[#2a170e] px-2 py-0.5 rounded border border-[#522d1b] text-red-300 font-bold">
                    ⚔ Damage: {inspectTarget.item.damageDice}
                    {inspectTarget.item.bonusDamage ? `+${inspectTarget.item.bonusDamage}` : ''}
                  </span>
                )}
                {inspectTarget.item.armorBonus && (
                  <span className="bg-[#121c2b] px-2 py-0.5 rounded border border-[#233b5c] text-blue-300 font-bold">
                    🛡 Armor: +{inspectTarget.item.armorBonus} AC
                  </span>
                )}
                {inspectTarget.item.healHp && (
                  <span className="bg-[#122b17] px-2 py-0.5 rounded border border-[#235c2e] text-emerald-300 font-bold">
                    ❤ Heals: +{inspectTarget.item.healHp} HP
                  </span>
                )}
                {inspectTarget.item.healMana && (
                  <span className="bg-[#1b142e] px-2 py-0.5 rounded border border-[#3b2a63] text-purple-300 font-bold">
                    ⚡ Restores: +{inspectTarget.item.healMana} EP
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-stone-300 font-serif leading-relaxed">
                {inspectTarget.item.description}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#3b2717]">
                {inspectTarget.type === 'inventory' && (
                  <>
                    {/* Equip button */}
                    {['weapon', 'shield', 'armor', 'helmet', 'boots', 'ring', 'amulet'].includes(
                      inspectTarget.item.type
                    ) && (
                      <button
                        onClick={() => handleEquipItem(inspectTarget.index)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-amber-100 font-serif font-bold text-xs rounded border border-amber-500/70 shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Equip Gear</span>
                      </button>
                    )}

                    {/* Consumable use button */}
                    {inspectTarget.item.usableOutOfCombat && (
                      <button
                        onClick={() => handleUseItem(inspectTarget.index)}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-800 to-emerald-900 hover:from-emerald-700 hover:to-emerald-800 text-emerald-100 font-serif font-bold text-xs rounded border border-emerald-600 shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Heart className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Use / Drink</span>
                      </button>
                    )}

                    {/* Tool trigger on map */}
                    {inspectTarget.item.id === 'dungeon_torch' && (
                      <button
                        onClick={() => {
                          onActivateMapAction('TORCH');
                          onGoToMap();
                        }}
                        className="px-3 py-1.5 bg-orange-900 hover:bg-orange-800 text-orange-100 font-serif font-bold text-xs rounded border border-orange-600 shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        <span>Light Torch on Map ➔</span>
                      </button>
                    )}

                    {inspectTarget.item.id === 'brass_spyglass' && (
                      <button
                        onClick={() => {
                          onActivateMapAction('SPYGLASS');
                          onGoToMap();
                        }}
                        className="px-3 py-1.5 bg-cyan-900 hover:bg-cyan-800 text-cyan-100 font-serif font-bold text-xs rounded border border-cyan-600 shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Scout on Map ➔</span>
                      </button>
                    )}

                    {inspectTarget.item.specialEffect === 'SMASH_WALL' && (
                      <button
                        onClick={() => {
                          onActivateMapAction('SMASH_WALL');
                          onGoToMap();
                        }}
                        className="px-3 py-1.5 bg-amber-900 hover:bg-amber-800 text-amber-100 font-serif font-bold text-xs rounded border border-amber-600 shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Hammer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Smash Wall on Map ➔</span>
                      </button>
                    )}

                    {inspectTarget.item.specialEffect === 'PHASE_WALL' && (
                      <button
                        onClick={() => {
                          onActivateMapAction('PHASE_WALL');
                          onGoToMap();
                        }}
                        className="px-3 py-1.5 bg-purple-900 hover:bg-purple-800 text-purple-100 font-serif font-bold text-xs rounded border border-purple-600 shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Phase Through Wall ➔</span>
                      </button>
                    )}

                    {/* Discard button */}
                    <button
                      onClick={() => handleDropItem(inspectTarget.index)}
                      className="px-2.5 py-1.5 bg-[#24130d] hover:bg-[#381a10] text-red-300 font-serif text-xs rounded border border-red-900/60 shadow flex items-center gap-1 cursor-pointer ml-auto"
                      title="Discard item to free backpack slot"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                      <span>Discard</span>
                    </button>
                  </>
                )}

                {inspectTarget.type === 'equipment' && (
                  <button
                    onClick={() => handleUnequipSlot(inspectTarget.slot)}
                    className="px-3 py-1.5 bg-[#3a2818] hover:bg-[#4f3621] text-amber-200 font-serif font-bold text-xs rounded border border-[#6b4c2b] shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Unequip to Pack</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
