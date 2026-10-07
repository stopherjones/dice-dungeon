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
  Eye,
  Compass,
  Hammer,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { GameItem, HeroCharacter } from '../types/game';
import { sounds } from '../utils/audio';
import { dropItemFromHero, getItemCategoryLabel, getItemUsageBadge, syncHeroSupplies } from '../utils/inventory';

interface InventoryModalProps {
  hero: HeroCharacter;
  onUpdateHero: (hero: HeroCharacter) => void;
  onClose: () => void;
  onActivateMapAction?: (
    action: 'TORCH' | 'CLAIRVOYANCE' | 'SPYGLASS' | 'SMASH_WALL' | 'PHASE_WALL'
  ) => void;
}

type InspectTarget =
  | { type: 'inventory'; index: number; item: GameItem }
  | { type: 'equipment'; slot: keyof HeroCharacter['equipment']; item: GameItem }
  | null;

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hero,
  onUpdateHero,
  onClose,
  onActivateMapAction,
}) => {
  const [inspectTarget, setInspectTarget] = useState<InspectTarget>(null);

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

  return (
    <div
      id="inventory-modal-overlay"
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[#241a12] border-4 border-[#8c6b45] rounded-xl max-w-3xl w-full p-4 md:p-6 text-stone-200 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header with Coin Purse */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#523924] pb-3 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg md:text-xl font-serif font-black text-[#f5e4c6] leading-tight">
                Adventurer's Backpack & Gear
              </h2>
              <span className="text-[11px] font-mono text-stone-400 block">
                {hero.name} • Level {hero.level} {hero.classId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dedicated Fate Reroll Tokens Display */}
            <div
              id="inv-fate-tokens-display"
              className="flex items-center gap-2 bg-[#1b1226] px-3 py-1.5 rounded-lg border-2 border-purple-500/80 text-purple-200 font-mono shadow-inner"
              title="Fate Reroll Tokens (Used for retrying d20 checks, attack rolls, and vault loot)"
            >
              <Dices className="w-4 h-4 text-purple-400" />
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] text-purple-400 uppercase font-sans font-bold">Fate Dice</span>
                <span className="text-sm font-bold text-purple-200">{hero.rerollTokens} Available</span>
              </div>
            </div>

            {/* Prominent Gold Coin Purse Display */}
            <div
              id="inv-gold-display"
              className="flex items-center gap-2 bg-[#171008] px-3 py-1.5 rounded-lg border-2 border-amber-500/80 text-amber-300 font-mono shadow-inner"
              title="Wealth Purse (Coins carry no slot weight)"
            >
              <Coins className="w-4 h-4 text-yellow-400 animate-pulse" />
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] text-amber-400/80 uppercase font-sans font-bold">Coin Purse</span>
                <span className="text-sm font-bold text-yellow-300">{hero.gold} GP</span>
              </div>
            </div>

            <button
              id="btn-close-inventory"
              onClick={onClose}
              className="p-1.5 hover:bg-[#3d2a1c] rounded-md text-stone-400 hover:text-stone-200 transition-colors cursor-pointer shrink-0"
              title="Close backpack (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Backpack Capacity & Quick Supplies Strip */}
        <div className="bg-[#181109] border border-[#4d321d] rounded-lg p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            <span className="text-stone-300 font-serif font-bold">Backpack Capacity:</span>
            <span className="font-mono font-bold text-amber-300">
              {hero.inventory.length} / {hero.maxInventorySlots} Slots
            </span>
            <div className="w-24 h-2 bg-[#120b07] rounded-full overflow-hidden border border-[#3d2817] hidden sm:block">
              <div
                className={`h-full ${
                  hero.inventory.length >= hero.maxInventorySlots
                    ? 'bg-red-500'
                    : hero.inventory.length >= hero.maxInventorySlots - 2
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (hero.inventory.length / hero.maxInventorySlots) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-stone-500 hidden md:inline">
              (1 item per slot • Click any item to inspect/use)
            </span>
          </div>

          <div className="flex items-center gap-2 text-stone-300">
            {hero.rations > 0 && (
              <button
                id="inv-quick-ration"
                onClick={() => {
                  const idx = hero.inventory.findIndex((i) => i.item.id === 'dungeon_ration');
                  if (idx !== -1) handleUseItem(idx);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#24160d] hover:bg-[#382315] border border-[#4d2f1b] transition-colors cursor-pointer text-amber-200"
                title="Eat 1 Ration from pack (+8 HP & +6 Energy)"
              >
                <Utensils className="w-3.5 h-3.5 text-amber-500" />
                <span>Eat Ration ({hero.rations})</span>
              </button>
            )}

            {hero.torches > 0 && (
              <button
                id="inv-quick-torch"
                onClick={() => {
                  onClose();
                  onActivateMapAction?.('TORCH');
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#2a170a] hover:bg-[#42230e] border border-[#5e3212] transition-colors cursor-pointer text-orange-200"
                title="Light 1 Torch from pack (Reveal adjacent room on map)"
              >
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Light Torch ({hero.torches})</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-y-auto pr-1">
          {/* Left Column: Equipped Slots */}
          <div className="md:col-span-5 space-y-2">
            <h3 className="text-xs font-serif font-bold text-[#e6c898] uppercase tracking-wider mb-2">
              Equipped Armor & Weapons
            </h3>

            <div className="space-y-1.5">
              {(
                [
                  { slot: 'weapon', label: 'Main Hand (Weapon)' },
                  { slot: 'offhand', label: 'Offhand (Shield/Tome)' },
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
                    className={`p-2 bg-[#19110a] border border-[#442e1d] rounded-md flex items-center justify-between transition-colors ${
                      item ? 'hover:bg-[#2c1d11] cursor-pointer' : 'opacity-70'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-stone-500 block uppercase">{label}</span>
                      <span className="text-xs font-serif font-bold text-amber-200">
                        {item ? item.name : '— Empty —'}
                      </span>
                    </div>

                    {item && (
                      <span className="text-[10px] font-serif text-amber-400/90 underline">
                        Inspect
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active Modifiers & Spells */}
            <div className="pt-2 border-t border-[#442e1d] mt-3">
              <div className="flex items-center gap-1.5 text-cyan-300 font-serif font-bold text-xs mb-1.5">
                <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Spellbook & Active Enchantments</span>
              </div>
              <div className="space-y-1">
                {hero.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-1.5 bg-[#161220] border border-[#3b2d54] rounded text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-200 font-serif">{skill.name}</span>
                      <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950 px-1 py-0.2 rounded border border-cyan-800">
                        {skill.manaCost} EP
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 font-serif">{skill.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Backpack Slots */}
          <div className="md:col-span-7 flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-serif font-bold text-[#e6c898] uppercase tracking-wider">
                  Backpack Storage ({hero.inventory.length} / {hero.maxInventorySlots} Slots)
                </h3>
                <span className="text-[10px] font-serif text-stone-400 italic">
                  Tap an item to open actions
                </span>
              </div>

              {/* Grid of items (each item occupies 1 slot) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {hero.inventory.map((inv, idx) => {
                  const badge = getItemUsageBadge(inv.item);
                  return (
                    <button
                      key={idx}
                      id={`btn-inv-item-${idx}`}
                      onClick={() => {
                        sounds.playBlock();
                        setInspectTarget({ type: 'inventory', index: idx, item: inv.item });
                      }}
                      className="p-2 rounded-lg border bg-[#19110a] border-[#442e1d] text-stone-300 hover:bg-[#332214] hover:border-[#8c6b45] text-left flex flex-col justify-between min-h-[74px] transition-all cursor-pointer shadow-sm group"
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

                {/* Empty slot indicators */}
                {Array.from({ length: Math.max(0, hero.maxInventorySlots - hero.inventory.length) }).map((_, i) => (
                  <div
                    key={`empty-slot-${i}`}
                    className="p-2 rounded-lg border border-dashed border-[#382618]/70 bg-[#120c08]/50 flex flex-col items-center justify-center min-h-[74px] text-[10px] font-mono text-stone-600 select-none"
                  >
                    <span>[ Empty Slot ]</span>
                  </div>
                ))}
              </div>

              {hero.inventory.length === 0 && (
                <div className="text-center py-6 text-stone-500 font-serif text-xs">
                  Your backpack is empty. Open chests and defeat dungeon beasts to find loot!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Focused Item Inspector Pop-up Dialog */}
        {inspectTarget && (
          <div
            id="item-inspector-popup"
            className="fixed inset-0 z-[80] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
            onClick={() => setInspectTarget(null)}
          >
            <div
              className="bg-[#241a12] border-4 border-[#c29653] rounded-xl max-w-md w-full p-5 text-stone-200 shadow-2xl relative animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Pop-up Header */}
              <div className="flex items-start justify-between border-b border-[#523924] pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#171008] border-2 border-amber-500/70 rounded-lg shadow-inner">
                    {getItemIcon(inspectTarget.item)}
                  </div>
                  <div>
                    <h3 className="font-serif font-black text-base text-[#f5e4c6] leading-tight">
                      {inspectTarget.item.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-amber-300 uppercase">
                        {getItemCategoryLabel(inspectTarget.item)}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          getItemUsageBadge(inspectTarget.item).bg
                        }`}
                      >
                        {getItemUsageBadge(inspectTarget.item).label}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  id="btn-close-inspect-popup"
                  onClick={() => setInspectTarget(null)}
                  className="p-1 hover:bg-[#3d2a1c] rounded text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Value & Slot Weight */}
              <div className="flex items-center justify-between bg-[#171008] px-3 py-1.5 rounded-lg border border-[#442e1d] mb-3 text-xs font-mono">
                <span className="text-yellow-400 font-bold">{inspectTarget.item.value} Gold Value</span>
                <span className="text-stone-400">Occupies 1 Backpack Slot</span>
              </div>

              {/* Stats & Attributes */}
              {(inspectTarget.item.damageDice ||
                inspectTarget.item.armorBonus ||
                inspectTarget.item.healHp ||
                inspectTarget.item.healMana ||
                inspectTarget.item.statBonuses) && (
                <div className="flex flex-wrap gap-2 text-xs font-mono mb-3">
                  {inspectTarget.item.damageDice && (
                    <span className="bg-[#2a170e] px-2 py-1 rounded border border-[#522d1b] text-red-300 font-bold">
                      ⚔ Damage: {inspectTarget.item.damageDice}
                      {inspectTarget.item.bonusDamage ? `+${inspectTarget.item.bonusDamage}` : ''}
                    </span>
                  )}
                  {inspectTarget.item.armorBonus && (
                    <span className="bg-[#121c2b] px-2 py-1 rounded border border-[#233b5c] text-blue-300 font-bold">
                      🛡 Armor: +{inspectTarget.item.armorBonus} AC
                    </span>
                  )}
                  {inspectTarget.item.healHp && (
                    <span className="bg-[#122b17] px-2 py-1 rounded border border-[#235c2e] text-emerald-300 font-bold">
                      ❤ Heals: +{inspectTarget.item.healHp} HP
                    </span>
                  )}
                  {inspectTarget.item.healMana && (
                    <span className="bg-[#1b142e] px-2 py-1 rounded border border-[#3b2a63] text-purple-300 font-bold">
                      ⚡ Restores: +{inspectTarget.item.healMana} EP
                    </span>
                  )}
                  {inspectTarget.item.statBonuses &&
                    Object.entries(inspectTarget.item.statBonuses).map(([stat, val]) => (
                      <span
                        key={stat}
                        className="bg-[#24170e] px-2 py-1 rounded border border-[#442d1b] text-amber-200"
                      >
                        +{val} {stat}
                      </span>
                    ))}
                </div>
              )}

              {/* Detailed Lore Description */}
              <div className="bg-[#19110a] border border-[#3d2716] p-3 rounded-lg text-xs font-serif text-stone-300 leading-relaxed mb-4">
                {inspectTarget.item.description}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {inspectTarget.type === 'inventory' && (
                  <>
                    {/* Equip action */}
                    {['weapon', 'shield', 'armor', 'helmet', 'boots', 'ring', 'amulet'].includes(
                      inspectTarget.item.type
                    ) && (
                      <button
                        id="btn-popup-equip-item"
                        onClick={() => handleEquipItem(inspectTarget.index)}
                        className="w-full py-2 bg-gradient-to-b from-[#8f6437] to-[#5e3b1c] hover:from-[#a67440] hover:to-[#6d4520] text-amber-100 font-serif font-bold text-xs rounded-lg border border-[#dfb15b] shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sword className="w-4 h-4 text-amber-300" />
                        <span>Equip to Active Gear Slot</span>
                      </button>
                    )}

                    {/* Consumable actions */}
                    {inspectTarget.item.id === 'dungeon_ration' && (
                      <button
                        id="btn-popup-eat-ration"
                        onClick={() => handleUseItem(inspectTarget.index)}
                        className="w-full py-2 bg-gradient-to-b from-[#2d5930] to-[#1d3d20] hover:from-[#386e3c] hover:to-[#244c27] text-emerald-100 font-serif font-bold text-xs rounded-lg border border-emerald-500 shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Utensils className="w-4 h-4 text-amber-400" />
                        <span>Eat Salted Ration (+8 HP / +6 Energy) [Single-use]</span>
                      </button>
                    )}

                    {(inspectTarget.item.type === 'potion' ||
                      (inspectTarget.item.healHp && inspectTarget.item.id !== 'dungeon_ration') ||
                      inspectTarget.item.healMana) && (
                      <button
                        id="btn-popup-drink-potion"
                        onClick={() => handleUseItem(inspectTarget.index)}
                        className="w-full py-2 bg-gradient-to-b from-[#2d5930] to-[#1d3d20] hover:from-[#386e3c] hover:to-[#244c27] text-emerald-100 font-serif font-bold text-xs rounded-lg border border-emerald-500 shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Heart className="w-4 h-4 text-emerald-300" />
                        <span>Drink Draught / Potion [Single-use]</span>
                      </button>
                    )}

                    {/* Pitch Torch */}
                    {inspectTarget.item.id === 'dungeon_torch' && (
                      <button
                        id="btn-popup-light-torch"
                        onClick={() => {
                          setInspectTarget(null);
                          onClose();
                          onActivateMapAction?.('TORCH');
                        }}
                        className="w-full py-2 bg-gradient-to-b from-[#784118] to-[#4d280d] hover:from-[#94511d] hover:to-[#613310] text-orange-100 font-serif font-bold text-xs rounded-lg border border-orange-500 shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span>Light Torch ➔ Reveal Adjacent Chamber [Single-use]</span>
                      </button>
                    )}

                    {/* Burglar's Spyglass */}
                    {inspectTarget.item.id === 'brass_spyglass' && (
                      <button
                        id="btn-popup-use-spyglass"
                        onClick={() => {
                          setInspectTarget(null);
                          onClose();
                          onActivateMapAction?.('SPYGLASS');
                        }}
                        className="w-full py-2 bg-gradient-to-b from-[#1b4352] to-[#0f2830] hover:from-[#255c70] hover:to-[#143540] text-cyan-100 font-serif font-bold text-xs rounded-lg border border-cyan-400 shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Compass className="w-4 h-4 text-cyan-300" />
                        <span>Scout Adjacent Chamber [Reusable Tool]</span>
                      </button>
                    )}

                    {/* Scroll of Clairvoyance */}
                    {(inspectTarget.item.id === 'scroll_of_clairvoyance' ||
                      inspectTarget.item.specialEffect === 'PEEK_ANY_ROOM') && (
                      <button
                        id="btn-popup-clairvoyance"
                        onClick={() => {
                          setInspectTarget(null);
                          onClose();
                          onActivateMapAction?.('CLAIRVOYANCE');
                        }}
                        className="w-full py-2 bg-gradient-to-b from-[#4d2566] to-[#2e143d] hover:from-[#663187] hover:to-[#3e1b52] text-purple-100 font-serif font-bold text-xs rounded-lg border border-purple-400 shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4 text-purple-300" />
                        <span>Cast Clairvoyance ➔ Scout Any Map Tile [Single-use]</span>
                      </button>
                    )}

                    {/* Wall Breaching Tools (Pickaxe / Sledge) */}
                    {inspectTarget.item.specialEffect === 'SMASH_WALL' && (
                      <button
                        id="btn-popup-smash-wall"
                        onClick={() => {
                          setInspectTarget(null);
                          onClose();
                          onActivateMapAction?.('SMASH_WALL');
                        }}
                        className="w-full py-2 bg-gradient-to-b from-[#5c2419] to-[#38150e] hover:from-[#752e1f] hover:to-[#4a1c12] text-amber-200 font-serif font-bold text-xs rounded-lg border border-red-500 shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Hammer className="w-4 h-4 text-amber-400" />
                        <span>Smash Wall ➔ Open Dungeon Map</span>
                      </button>
                    )}

                    {/* Wall Phasing Potion */}
                    {inspectTarget.item.specialEffect === 'PHASE_WALL' && (
                      <button
                        id="btn-popup-phase-wall"
                        onClick={() => {
                          setInspectTarget(null);
                          onClose();
                          onActivateMapAction?.('PHASE_WALL');
                        }}
                        className="w-full py-2 bg-gradient-to-b from-[#3f2252] to-[#251330] hover:from-[#532d6b] hover:to-[#331a42] text-purple-200 font-serif font-bold text-xs rounded-lg border border-purple-400 shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-purple-300" />
                        <span>Phase Through Wall ➔ Open Dungeon Map [Single-use]</span>
                      </button>
                    )}

                    {/* Drop and Cancel Row */}
                    <div className="flex gap-2 pt-1">
                      <button
                        id="btn-popup-drop-item"
                        onClick={() => handleDropItem(inspectTarget.index)}
                        className="flex-1 py-1.5 bg-[#2d1713] hover:bg-[#45221b] text-red-300 font-serif text-xs rounded-lg border border-red-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>Drop Item (Free 1 Slot)</span>
                      </button>

                      <button
                        id="btn-popup-cancel"
                        onClick={() => setInspectTarget(null)}
                        className="px-4 py-1.5 bg-[#291b10] hover:bg-[#3b2718] text-stone-300 font-serif text-xs rounded-lg border border-[#4d331f] transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}

                {inspectTarget.type === 'equipment' && (
                  <>
                    <button
                      id="btn-popup-unequip-item"
                      disabled={hero.inventory.length >= hero.maxInventorySlots}
                      onClick={() => handleUnequipSlot(inspectTarget.slot)}
                      className="w-full py-2 bg-[#422e1e] hover:bg-[#5c402a] text-amber-100 font-serif font-bold text-xs rounded-lg border border-[#785335] shadow transition-all cursor-pointer disabled:opacity-40"
                    >
                      {hero.inventory.length >= hero.maxInventorySlots
                        ? 'Backpack is Full (Cannot Unequip)'
                        : 'Unequip to Backpack'}
                    </button>

                    <button
                      id="btn-popup-cancel-equipped"
                      onClick={() => setInspectTarget(null)}
                      className="w-full py-1.5 bg-[#291b10] hover:bg-[#3b2718] text-stone-300 font-serif text-xs rounded-lg border border-[#4d331f] transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
