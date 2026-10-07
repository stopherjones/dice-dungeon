/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Store, Coins, X, Heart, Shield, Sword, Package, Sparkles, Wand2, Utensils, Zap } from 'lucide-react';
import { GameItem, HeroCharacter } from '../types/game';
import { generateMerchantStock } from '../utils/generator';
import { MERCHANT_QUOTES } from '../data/events';
import { sounds } from '../utils/audio';
import {
  addItemToHero,
  canHeroEquipItem,
  getItemUsageBadge,
  getWeaponAcReduction,
  syncHeroSupplies,
  isHpOrEpBoostingItem,
} from '../utils/inventory';

interface MerchantModalProps {
  hero: HeroCharacter;
  floorNumber: number;
  onUpdateHero: (hero: HeroCharacter) => void;
  onClose: () => void;
}

export const MerchantModal: React.FC<MerchantModalProps> = ({
  hero,
  floorNumber,
  onUpdateHero,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'wares' | 'tavern' | 'sell'>('wares');
  const [stock] = useState<GameItem[]>(() => generateMerchantStock(floorNumber));
  const [merchantQuote] = useState(
    () => MERCHANT_QUOTES[Math.floor(Math.random() * MERCHANT_QUOTES.length)]
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  // Split wares stock: Tavern sells HP/EP items, Wares sells equipment/tools/scrolls
  const tavernStock = stock.filter(isHpOrEpBoostingItem);
  const waresStock = stock.filter((item) => !isHpOrEpBoostingItem(item));

  // Buy Item
  const handleBuy = (item: GameItem) => {
    if (hero.gold < item.value) {
      setFeedback('“Not enough gold in your purse for that fine item, adventurer!”');
      sounds.playBlock();
      return;
    }

    if (item.id !== 'dice_of_fate' && hero.inventory.length >= hero.maxInventorySlots) {
      setFeedback(`“Your backpack is stuffed to the brim! (${hero.inventory.length}/${hero.maxInventorySlots} slots used). Make room first.”`);
      sounds.playBlock();
      return;
    }

    sounds.playCoins();
    hero.gold -= item.value;

    const res = addItemToHero(hero, item, 1);
    if (!res.success) {
      // Refund if adding failed
      hero.gold += item.value;
      setFeedback(`“${res.message}”`);
      sounds.playBlock();
      return;
    }

    setFeedback(`“A fine choice! The ${item.name} has been stowed in your pack.”`);
    onUpdateHero({ ...hero });
  };

  // Sell Item
  const handleSell = (inventoryIdx: number) => {
    const invItem = hero.inventory[inventoryIdx];
    if (!invItem) return;

    const sellPrice = Math.max(1, Math.floor(invItem.item.value * 0.6));
    sounds.playCoins();
    hero.gold += sellPrice;

    hero.inventory.splice(inventoryIdx, 1);

    syncHeroSupplies(hero);
    setFeedback(`“Pleasure doing business! +${sellPrice} Gold paid for ${invItem.item.name}.”`);
    onUpdateHero({ ...hero });
  };

  // Backpack Upgrade Service
  const getBackpackUpgradeCost = () => {
    if (hero.maxInventorySlots < 20) return 25;
    if (hero.maxInventorySlots < 25) return 45;
    if (hero.maxInventorySlots < 30) return 75;
    return null; // Max reached
  };

  const handleUpgradeBackpack = () => {
    const cost = getBackpackUpgradeCost();
    if (cost === null) {
      setFeedback('“Your rucksack has already reached maximum reinforced capacity (30 Slots)!”');
      sounds.playBlock();
      return;
    }

    if (hero.gold < cost) {
      setFeedback(`“Reinforcing and expanding your backpack with leather straps costs ${cost} Gold.”`);
      sounds.playBlock();
      return;
    }

    sounds.playLevelUp();
    hero.gold -= cost;
    hero.maxInventorySlots += 5;
    setFeedback(`“Backpack expanded! Capacity increased to ${hero.maxInventorySlots} Slots (+5 Slots).”`);
    onUpdateHero({ ...hero });
  };

  const upgradeCost = getBackpackUpgradeCost();

  return (
    <div
      id="merchant-modal-overlay"
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[#241a12] border-4 border-[#8c6b45] rounded-xl max-w-2xl w-full p-4 md:p-6 text-stone-200 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#523924] pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-700">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-serif font-black text-[#f5e4c6]">
                Olaf's Wandering Trading Post
              </h2>
              <p className="text-xs text-stone-400 font-serif italic">{merchantQuote}</p>
            </div>
          </div>

          <button
            id="btn-close-merchant"
            onClick={onClose}
            className="p-1.5 hover:bg-[#3d2a1c] rounded-md text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currency & Tabs */}
        <div className="flex items-center justify-between bg-[#19110a] p-2.5 rounded-lg border border-[#4d341f] mb-3">
          <div className="flex gap-2">
            <button
              id="btn-merchant-tab-buy"
              onClick={() => {
                setActiveTab('wares');
                sounds.playBlock();
              }}
              className={`px-3 py-1 rounded text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'wares'
                  ? 'bg-[#dfb15b] text-[#241a12] shadow'
                  : 'bg-[#291c12] text-stone-300 hover:bg-[#3d2a1b]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Wares ({waresStock.length})</span>
            </button>
            <button
              id="btn-merchant-tab-tavern"
              onClick={() => {
                setActiveTab('tavern');
                sounds.playBlock();
              }}
              className={`px-3 py-1 rounded text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tavern'
                  ? 'bg-[#dfb15b] text-[#241a12] shadow'
                  : 'bg-[#291c12] text-stone-300 hover:bg-[#3d2a1b]'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Tavern ({tavernStock.length})</span>
            </button>
            <button
              id="btn-merchant-tab-sell"
              onClick={() => {
                setActiveTab('sell');
                sounds.playBlock();
              }}
              className={`px-3 py-1 rounded text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sell'
                  ? 'bg-[#dfb15b] text-[#241a12] shadow'
                  : 'bg-[#291c12] text-stone-300 hover:bg-[#3d2a1b]'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Sell Loot ({hero.inventory.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-yellow-300 bg-[#120c07] px-3 py-1 rounded border border-[#3b2716]">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span>{hero.gold} Gold</span>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div className="mb-3 p-2 bg-[#17120a] border border-[#785934] rounded text-xs font-serif text-amber-200">
            {feedback}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: GENERAL WARES (Equipment, Weapons, Armor, Tools, Scrolls) */}
          {activeTab === 'wares' && (
            <div className="space-y-3">
              {/* Featured Backpack Upgrade Card inside Buy Wares */}
              <div className="bg-gradient-to-r from-[#24160d] to-[#1c120a] border-2 border-amber-600/80 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-950/80 rounded-lg border border-amber-600/80 text-amber-400 shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-sm text-[#f5e4c6]">
                        Reinforced Leather Rucksack
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-500 text-amber-300">
                        Backpack Upgrade
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 font-serif leading-tight mt-0.5">
                      Expands your backpack capacity by +5 item slots (Current: {hero.inventory.length}/{hero.maxInventorySlots} slots used).
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
                  {upgradeCost !== null ? (
                    <button
                      id="btn-buy-backpack-upgrade-main"
                      disabled={hero.gold < upgradeCost}
                      onClick={handleUpgradeBackpack}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-serif font-bold text-xs rounded border border-amber-400 shadow cursor-pointer disabled:opacity-40 whitespace-nowrap"
                    >
                      Expand +5 Slots ({upgradeCost} Gold)
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-emerald-400 font-bold px-3 py-1 bg-[#120b07] border border-[#3b2716] rounded">
                      ✓ Max Capacity (30 Slots)
                    </span>
                  )}
                </div>
              </div>

              {/* Standard Item Cards Grid for General Wares */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {waresStock.map((item) => {
                  const canAfford = hero.gold >= item.value;
                  const badge = getItemUsageBadge(item);
                  return (
                    <div
                      key={item.id}
                      className="bg-[#1b130c] border border-[#4d3623] p-2.5 rounded-lg flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-serif font-bold text-xs text-amber-200">{item.name}</span>
                          <span className="text-xs font-mono font-bold text-yellow-400">{item.value} G</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 mb-1.5">
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          {item.type === 'weapon' && getWeaponAcReduction(item, hero.level) > 0 && (
                            <span
                              className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-950 border border-amber-600 text-amber-200"
                              title="Reduces monster Armor Class on attack rolls"
                            >
                              -{getWeaponAcReduction(item, hero.level)} Enemy AC
                            </span>
                          )}
                          {item.armorBonus && item.armorBonus > 0 && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-stone-900 border border-stone-600 text-amber-300">
                              +{item.armorBonus} AC
                            </span>
                          )}
                        </div>

                        {/* Requirements preview if equipment */}
                        {['weapon', 'shield', 'armor', 'helmet', 'boots', 'ring', 'amulet'].includes(item.type) &&
                          item.requirements &&
                          Object.keys(item.requirements).length > 0 && (() => {
                            const check = canHeroEquipItem(hero, item);
                            return (
                              <div className="mb-1.5 flex flex-wrap gap-1">
                                {check.requirementBadges.map((rb, i) => (
                                  <span
                                    key={i}
                                    className={`text-[8px] font-mono px-1 py-0.2 rounded border ${
                                      rb.met
                                        ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                                        : 'bg-red-950/70 border-red-800 text-red-300'
                                    }`}
                                  >
                                    {rb.label} {rb.met ? '✓' : '✗'}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}

                        <p className="text-[11px] text-stone-300 font-serif leading-tight mb-2">
                          {item.description}
                        </p>
                      </div>

                      <button
                        id={`btn-buy-${item.id}`}
                        disabled={!canAfford}
                        onClick={() => handleBuy(item)}
                        className="w-full py-1 bg-[#3a2818] hover:bg-[#523922] text-amber-100 rounded text-xs font-serif font-bold border border-[#6b4b2b] transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {canAfford ? `Buy (${item.value}G)` : 'Not enough Gold'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TAVERN (HP & EP Provisions, Potions, Draughts, Rations) */}
          {activeTab === 'tavern' && (
            <div className="space-y-3">
              {/* Tavern Intro Header Banner */}
              <div className="bg-gradient-to-r from-[#29170a] via-[#1f130b] to-[#170e08] border-2 border-amber-700/60 p-3 rounded-lg shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-950/90 rounded-lg border border-amber-600 text-amber-300 shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-sm text-[#f5e4c6]">
                        Tavern Hearth & Provisions
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300">
                        HP & EP Supplies
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 font-serif leading-tight mt-0.5">
                      Warm restorative rations, healing elixirs, and energy draughts prepared by Olaf.
                    </p>
                  </div>
                </div>

                {/* Hero current HP / EP indicator */}
                <div className="flex items-center gap-2.5 font-mono text-xs shrink-0 bg-[#120b06] px-3 py-1.5 rounded border border-[#3b2716]">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold" title="Current Hit Points">
                    <Heart className="w-3.5 h-3.5 fill-emerald-500/30 text-emerald-400" />
                    <span>{hero.currentHp}/{hero.maxHp} HP</span>
                  </div>
                  <span className="text-stone-600">•</span>
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold" title="Current Energy Points">
                    <Zap className="w-3.5 h-3.5 fill-cyan-500/30 text-cyan-400" />
                    <span>{hero.currentMana}/{hero.maxMana} EP</span>
                  </div>
                </div>
              </div>

              {/* Tavern Stock Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tavernStock.map((item) => {
                  const canAfford = hero.gold >= item.value;
                  const badge = getItemUsageBadge(item);
                  return (
                    <div
                      key={item.id}
                      className="bg-[#1b130c] border border-amber-900/50 p-2.5 rounded-lg flex flex-col justify-between hover:border-amber-700/70 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-serif font-bold text-xs text-amber-200">{item.name}</span>
                          <span className="text-xs font-mono font-bold text-yellow-400">{item.value} G</span>
                        </div>

                        {/* Restorative power badges: HP / EP */}
                        <div className="flex flex-wrap items-center gap-1 mb-1.5">
                          {item.healHp && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-600 text-emerald-300 flex items-center gap-1">
                              <Heart className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" />
                              +{item.healHp} HP
                            </span>
                          )}
                          {(item.healMana || item.healEnergy) && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-600 text-cyan-300 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5 fill-cyan-400 text-cyan-400" />
                              +{item.healMana || item.healEnergy} EP
                            </span>
                          )}
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          {item.usableInCombat ? (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-stone-900 border border-stone-700 text-stone-400">
                              Combat & Camp
                            </span>
                          ) : (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-950/60 border border-amber-800 text-amber-300">
                              Camp Only
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-stone-300 font-serif leading-tight mb-2">
                          {item.description}
                        </p>
                      </div>

                      <button
                        id={`btn-buy-${item.id}`}
                        disabled={!canAfford}
                        onClick={() => handleBuy(item)}
                        className="w-full py-1.5 bg-gradient-to-b from-[#4a3420] to-[#342416] hover:from-[#5d4128] hover:to-[#452f1d] text-amber-100 rounded text-xs font-serif font-bold border border-[#7a5530] shadow transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {canAfford ? `Buy (${item.value} Gold)` : 'Not enough Gold'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SELL LOOT */}
          {activeTab === 'sell' && (
            <div className="space-y-2">
              {hero.inventory.length === 0 ? (
                <div className="text-center py-8 text-stone-400 font-serif text-xs">
                  Your backpack is empty. Defeat monsters and loot chests to find items to trade!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {hero.inventory.map((inv, idx) => {
                    const sellPrice = Math.max(1, Math.floor(inv.item.value * 0.6));
                    const badge = getItemUsageBadge(inv.item);
                    return (
                      <div
                        key={idx}
                        className="bg-[#1b130c] border border-[#4d3623] p-2.5 rounded-lg flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-serif font-bold text-xs text-amber-200 block">
                              {inv.item.name}
                            </span>
                            <span className={`text-[8px] font-mono px-1 py-0.2 rounded border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-serif">
                            Value: {sellPrice} Gold (1 Slot)
                          </span>
                        </div>

                        <button
                          id={`btn-sell-${inv.item.id}-${idx}`}
                          onClick={() => handleSell(idx)}
                          className="px-3 py-1 bg-[#472d17] hover:bg-[#613e20] text-amber-100 rounded text-xs font-serif font-bold border border-[#784e27] transition-colors cursor-pointer shrink-0"
                        >
                          Sell (+{sellPrice}G)
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
