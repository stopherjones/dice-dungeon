/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CharacterStats,
  Equipment,
  GameItem,
  HeroCharacter,
  InventoryItem,
  StatType,
} from '../types/game';

/**
 * Ensures:
 * 1. Dice of Fate / Fate Reroll Tokens are separated out into hero.rerollTokens (never in backpack slots).
 * 2. Every single physical item takes up exactly 1 inventory slot.
 * 3. Supply counters (rations, lockpicks, torches) accurately mirror backpack contents.
 */
export function syncHeroSupplies(hero: HeroCharacter): void {
  if (!hero || !hero.inventory) return;

  // Migrate any legacy dice_of_fate items out of backpack into hero.rerollTokens
  let migratedTokens = 0;
  const filteredInventory: InventoryItem[] = [];

  for (const inv of hero.inventory) {
    if (inv.item.id === 'dice_of_fate') {
      migratedTokens += inv.quantity || 1;
    } else if (inv.quantity && inv.quantity > 1) {
      // Unstack any multi-quantity items so each item occupies 1 individual slot
      for (let i = 0; i < inv.quantity; i++) {
        filteredInventory.push({ ...inv, quantity: 1 });
      }
    } else {
      filteredInventory.push({ ...inv, quantity: 1 });
    }
  }

  if (migratedTokens > 0) {
    hero.rerollTokens = (hero.rerollTokens || 0) + migratedTokens;
  }

  hero.inventory = filteredInventory;

  // Derive supply counters strictly from individual physical items in backpack
  let totalRations = 0;
  let totalLockpicks = 0;
  let totalTorches = 0;

  for (const inv of hero.inventory) {
    if (inv.item.id === 'dungeon_ration') {
      totalRations += 1;
    } else if (inv.item.id === 'iron_lockpick') {
      totalLockpicks += 1;
    } else if (inv.item.id === 'dungeon_torch') {
      totalTorches += 1;
    }
  }

  hero.rations = totalRations;
  hero.lockpicks = totalLockpicks;
  hero.torches = totalTorches;
}

/**
 * Returns the total count of an item ID in the hero's backpack
 */
export function getItemCount(hero: HeroCharacter, itemId: string): number {
  if (!hero || !hero.inventory) return 0;
  return hero.inventory.filter((inv) => inv.item.id === itemId).length;
}

/**
 * Adds items to the hero's backpack inventory.
 * Each item occupies exactly 1 slot.
 * Dice of Fate tokens do not occupy backpack slots and are routed to hero.rerollTokens.
 */
export function addItemToHero(
  hero: HeroCharacter,
  item: GameItem,
  quantity = 1
): { success: boolean; message: string; addedCount: number } {
  if (!hero || !item) return { success: false, message: 'Invalid item or hero', addedCount: 0 };

  // Dice of Fate is a special currency / token (separated from backpack slots)
  if (item.id === 'dice_of_fate') {
    hero.rerollTokens = (hero.rerollTokens || 0) + quantity;
    return {
      success: true,
      message: `+${quantity} Fate Reroll Token${quantity > 1 ? 's' : ''} added to your purse!`,
      addedCount: quantity,
    };
  }

  // Reusable Tools: If hero already owns a lockpick kit, convert duplicates to Gold to prevent slot clutter
  if (item.id === 'iron_lockpick' && getItemCount(hero, 'iron_lockpick') > 0) {
    const goldBonus = (item.value || 15) * quantity;
    hero.gold += goldBonus;
    return {
      success: true,
      message: `Already own a ${item.name}! Converted duplicate into +${goldBonus} Gold.`,
      addedCount: quantity,
    };
  }

  const freeSlots = Math.max(0, hero.maxInventorySlots - hero.inventory.length);
  if (freeSlots <= 0) {
    return {
      success: false,
      message: `Backpack is full! (${hero.inventory.length}/${hero.maxInventorySlots} slots used). Drop an item first.`,
      addedCount: 0,
    };
  }

  const toAdd = Math.min(quantity, freeSlots);
  for (let i = 0; i < toAdd; i++) {
    hero.inventory.push({ item, quantity: 1 });
  }

  syncHeroSupplies(hero);

  if (toAdd < quantity) {
    return {
      success: true,
      message: `Added ${toAdd}x ${item.name}. Backpack reached full capacity (${hero.maxInventorySlots}/${hero.maxInventorySlots} slots)!`,
      addedCount: toAdd,
    };
  }

  return {
    success: true,
    message: `Added ${toAdd > 1 ? `${toAdd}x ` : ''}${item.name} into backpack.`,
    addedCount: toAdd,
  };
}

/**
 * Removes an item or quantity of individual items from the hero's backpack
 */
export function removeItemFromHero(
  hero: HeroCharacter,
  itemId: string,
  quantity = 1
): boolean {
  if (!hero || !hero.inventory) return false;

  let removed = 0;
  for (let i = hero.inventory.length - 1; i >= 0 && removed < quantity; i--) {
    if (hero.inventory[i].item.id === itemId) {
      hero.inventory.splice(i, 1);
      removed++;
    }
  }

  syncHeroSupplies(hero);
  return removed > 0;
}

/**
 * Consumes 1 ration from the backpack to restore HP & Energy
 */
export function consumeHeroRation(hero: HeroCharacter): { success: boolean; hpHealed: number; energyHealed: number } {
  const hasRation = removeItemFromHero(hero, 'dungeon_ration', 1);
  if (!hasRation) return { success: false, hpHealed: 0, energyHealed: 0 };

  const hpHealed = 8;
  const energyHealed = 6;
  hero.currentHp = Math.min(hero.maxHp, hero.currentHp + hpHealed);
  hero.currentMana = Math.min(hero.maxMana, hero.currentMana + energyHealed);
  return { success: true, hpHealed, energyHealed };
}

/**
 * Consumes 1 torch from the backpack
 */
export function consumeHeroTorch(hero: HeroCharacter): boolean {
  return removeItemFromHero(hero, 'dungeon_torch', 1);
}

/**
 * Consumes 1 Fate Reroll Token (currency)
 */
export function consumeHeroFateToken(hero: HeroCharacter): boolean {
  if (hero.rerollTokens > 0) {
    hero.rerollTokens -= 1;
    return true;
  }
  return false;
}

/**
 * Drops an item completely from backpack inventory to free up 1 slot space
 */
export function dropItemFromHero(hero: HeroCharacter, inventoryIdx: number): boolean {
  if (!hero || !hero.inventory || inventoryIdx < 0 || inventoryIdx >= hero.inventory.length) {
    return false;
  }
  hero.inventory.splice(inventoryIdx, 1);
  syncHeroSupplies(hero);
  return true;
}

/**
 * Calculates the hero's effective attributes taking into account equipped items (amulets, rings, armor, etc.)
 * If excludeSlot is provided (e.g. 'weapon'), that slot is omitted so an item being evaluated doesn't count its own bonus.
 */
export function getHeroEffectiveStats(
  hero: HeroCharacter,
  excludeSlot?: keyof Equipment
): CharacterStats {
  const effective: CharacterStats = { ...hero.stats };
  if (!hero.equipment) return effective;

  (Object.keys(hero.equipment) as (keyof Equipment)[]).forEach((slot) => {
    if (slot === excludeSlot) return;
    const item = hero.equipment[slot];
    if (item && item.statBonuses) {
      if (item.statBonuses.STR) effective.STR += item.statBonuses.STR;
      if (item.statBonuses.DEX) effective.DEX += item.statBonuses.DEX;
      if (item.statBonuses.CON) effective.CON += item.statBonuses.CON;
      if (item.statBonuses.INT) effective.INT += item.statBonuses.INT;
      if (item.statBonuses.LCK) effective.LCK += item.statBonuses.LCK;
    }
  });

  return effective;
}

export interface EquipCheckResult {
  canEquip: boolean;
  reasons: string[];
  requirementBadges: { label: string; met: boolean }[];
}

/**
 * Checks if a hero can equip a specific item based on stat requirements, class, and race.
 */
export function canHeroEquipItem(
  hero: HeroCharacter,
  item: GameItem,
  slotKey?: keyof Equipment
): EquipCheckResult {
  const req = item.requirements;
  if (!req) {
    return { canEquip: true, reasons: [], requirementBadges: [] };
  }

  const reasons: string[] = [];
  const badges: { label: string; met: boolean }[] = [];

  const effectiveStats = getHeroEffectiveStats(hero, slotKey);
  const heroRace = hero.destinyProfile?.race || 'Human';
  const heroClass = hero.classId;

  // 1. Minimum stat requirements
  if (req.minStats) {
    (Object.entries(req.minStats) as [StatType, number][]).forEach(([stat, minVal]) => {
      const currentVal = effectiveStats[stat] || 0;
      const met = currentVal >= minVal;
      badges.push({
        label: `Requires ${stat} ${minVal}`,
        met,
      });
      if (!met) {
        reasons.push(`Requires ${stat} ${minVal} (Current: ${currentVal})`);
      }
    });
  }

  // 2. Allowed classes
  if (req.allowedClasses && req.allowedClasses.length > 0) {
    const met = req.allowedClasses.includes(heroClass);
    const classNames = req.allowedClasses.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(' / ');
    badges.push({
      label: `Class: ${classNames}`,
      met,
    });
    if (!met) {
      reasons.push(`Restricted to class: ${classNames}`);
    }
  }

  // 3. Restricted classes
  if (req.restrictedClasses && req.restrictedClasses.length > 0) {
    const isRestricted = req.restrictedClasses.includes(heroClass);
    if (isRestricted) {
      badges.push({
        label: `Cannot be used by ${heroClass}`,
        met: false,
      });
      reasons.push(`Cannot be used by ${heroClass}`);
    }
  }

  // 4. Allowed races
  if (req.allowedRaces && req.allowedRaces.length > 0) {
    const met = heroRace ? req.allowedRaces.includes(heroRace) : false;
    const raceNames = req.allowedRaces.join(' / ');
    badges.push({
      label: `Race: ${raceNames}`,
      met,
    });
    if (!met) {
      reasons.push(`Requires race: ${raceNames}`);
    }
  }

  // 5. Restricted races
  if (req.restrictedRaces && req.restrictedRaces.length > 0) {
    const isRestricted = heroRace ? req.restrictedRaces.includes(heroRace) : false;
    if (isRestricted) {
      const restrictedNames = req.restrictedRaces.join(', ');
      badges.push({
        label: `Cannot be wielded by ${restrictedNames}`,
        met: false,
      });
      reasons.push(`Too heavy or unsuitable for ${heroRace}`);
    }
  }

  return {
    canEquip: reasons.length === 0,
    reasons,
    requirementBadges: badges,
  };
}

/**
 * Checks if a hero can use an item or tool based on class, race, and stat requirements.
 */
export function canHeroUseItem(
  hero: HeroCharacter,
  item: GameItem
): { canUse: boolean; reasons: string[]; requirementBadges: { label: string; met: boolean }[] } {
  if (!item) return { canUse: true, reasons: [], requirementBadges: [] };
  const equipCheck = canHeroEquipItem(hero, item);
  return {
    canUse: equipCheck.canEquip,
    reasons: equipCheck.reasons,
    requirementBadges: equipCheck.requirementBadges,
  };
}

/**
 * Computes enemy AC reduction for a weapon, factoring in flat reduction and per-level scaling.
 */
export function getWeaponAcReduction(item?: GameItem, heroLevel = 1): number {
  if (!item) return 0;
  return (item.enemyAcReduction || 0) + (item.enemyAcReductionPerLevel || 0) * heroLevel;
}

/**
 * Descriptive label for item categories.
 */
export function getItemCategoryLabel(item: GameItem): string {
  if (item.id === 'dungeon_ration') return 'Ration / Food';
  if (item.id === 'iron_lockpick') return 'Lockpick Tool';
  if (item.id === 'dungeon_torch') return 'Torch Tool';
  if (item.id === 'brass_spyglass') return 'Scouting Scope';
  if (item.id === 'dice_of_fate') return 'Relic / Fate';
  if (item.type === 'potion') return 'Potion / Draught';
  if (item.type === 'scroll') return 'Spell Scroll';
  if (item.type === 'weapon') return 'Weapon';
  if (item.type === 'shield') return 'Shield / Offhand';
  if (item.type === 'armor') return 'Armour';
  if (item.type === 'helmet') return 'Helmet';
  if (item.type === 'boots') return 'Footwear';
  if (item.type === 'ring') return 'Ring';
  if (item.type === 'amulet') return 'Amulet';
  if (item.type === 'treasure') return 'Treasure / Gem';
  if (item.type === 'tool') return 'Tool';
  return item.type;
}

/**
 * Returns badge label and styling for an item. Tags specific equipment types (Weapon, Shield, Armour, Helmet, Footwear, Ring, Amulet)
 * rather than a generic 'Equipment' tag.
 */
export function getItemUsageBadge(item: GameItem): { label: string; bg: string } {
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
  if (item.id === 'iron_lockpick' || item.id === 'brass_spyglass') {
    return { label: 'Reusable Tool', bg: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/70' };
  }
  if (item.type === 'weapon') {
    return { label: 'Weapon', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  }
  if (item.type === 'shield') {
    return { label: 'Shield', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  }
  if (item.type === 'armor') {
    return { label: 'Armour', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  }
  if (item.type === 'helmet') {
    return { label: 'Helmet', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  }
  if (item.type === 'boots') {
    return { label: 'Footwear', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  }
  if (item.type === 'ring') {
    return { label: 'Ring', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  }
  if (item.type === 'amulet') {
    return { label: 'Amulet', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
  }
  if (item.type === 'treasure') {
    return { label: 'Treasure', bg: 'bg-yellow-950/80 text-yellow-300 border-yellow-500/70' };
  }
  if (item.type === 'tool') {
    return { label: 'Tool', bg: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/70' };
  }
  return { label: 'Item', bg: 'bg-stone-800 text-stone-300 border-stone-600' };
}

/**
 * Checks if an item restores or boosts HP or EP (Energy Points / Mana).
 */
export function isHpOrEpBoostingItem(item: GameItem): boolean {
  if (!item) return false;
  return Boolean(
    (typeof item.healHp === 'number' && item.healHp > 0) ||
    (typeof item.healMana === 'number' && item.healMana > 0) ||
    (typeof item.healEnergy === 'number' && item.healEnergy > 0)
  );
}


