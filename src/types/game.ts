/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StatType = 'STR' | 'DEX' | 'CON' | 'INT' | 'LCK';

export interface CharacterStats {
  STR: number; // Strength (Melee attack, physical checks, encumbrance)
  DEX: number; // Agility / Dexterity (Defense / AC, ranged / sneak, trap disarm)
  CON: number; // Constitution (Max HP, resistance, stamina)
  INT: number; // Intelligence (Magic damage, energy capacity, lore checks, scroll casting)
  LCK: number; // Luck (Critical chance, loot rolls, flee checks, event bonuses)
}

export type HeroClassId = 'warrior' | 'rogue' | 'wizard' | 'cleric' | 'paladin' | 'ranger' | 'hero' | 'jester';

export interface ClassDefinition {
  id: HeroClassId;
  name: string;
  title: string;
  description: string;
  primaryStat: StatType;
  primaryStatBoost: number; // e.g. +3 or +4 to top 3 of 4d6 roll
  statBonuses: Partial<CharacterStats>; // Archetype bonuses applied to rolled attributes
  baseStats: CharacterStats;
  hpFormula: { base: number; perLevel: number };
  manaFormula: { base: number; perLevel: number };
  energyFormula?: { base: number; perLevel: number };
  startingGold: number;
  startingEquipment: string[]; // Item IDs
  gearHighlights: { name: string; type: string; bonus: string; icon: string }[];
  skills: HeroSkill[];
  icon: string;
}

export interface HeroSkill {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  energyCost?: number;
  cooldownTurns: number;
  currentCooldown?: number;
  type: 'attack' | 'buff' | 'heal' | 'utility';
  diceFormula?: string; // e.g. "2d6+STR"
  effectValue?: number;
  icon: string;
  level?: number;
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemType = 'weapon' | 'shield' | 'armor' | 'helmet' | 'boots' | 'ring' | 'amulet' | 'potion' | 'scroll' | 'tool' | 'treasure';

export type ItemSpecialEffect =
  | 'SMASH_WALL'
  | 'PHASE_WALL'
  | 'PEEK_ALL_ADJACENT'
  | 'PEEK_ANY_ROOM'
  | 'HEAL_FULL'
  | 'TELEPORT_START';

export interface GameItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  value: number; // Gold value
  statBonuses?: Partial<CharacterStats>;
  armorBonus?: number;
  damageDice?: string; // e.g. "1d8", "2d6"
  bonusDamage?: number;
  healHp?: number;
  healMana?: number;
  healEnergy?: number;
  charges?: number;
  maxCharges?: number;
  specialEffect?: ItemSpecialEffect;
  effectDescription?: string;
  icon: string;
  usableInCombat?: boolean;
  usableOutOfCombat?: boolean;
}

export interface InventoryItem {
  item: GameItem;
  quantity: number;
  chargesLeft?: number;
}

export interface Equipment {
  weapon?: GameItem;
  offhand?: GameItem;
  armor?: GameItem;
  helmet?: GameItem;
  boots?: GameItem;
  ring?: GameItem;
  amulet?: GameItem;
}

export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  durationTurns: number;
  type: 'buff' | 'debuff';
  statModifiers?: Partial<CharacterStats>;
  armorModifier?: number;
  damageReduction?: number; // e.g. 4 for Aura of Protection, 3 for Iron Guard
  attackModifier?: number; // e.g. +3 for Divine Favor
  critModifier?: number; // e.g. 0.15 for Hunter's Focus
  evasionBonus?: number; // e.g. 0.75 for Smoke Bomb
  shieldHp?: number; // e.g. 20 for Arcane Barrier
  maxShieldHp?: number;
  damagePerTurn?: number; // e.g. for poison DoT
  icon: string;
}

export interface HeroCharacter {
  name: string;
  classId: HeroClassId;
  level: number;
  xp: number;
  xpToNextLevel: number;
  currentHp: number;
  maxHp: number;
  currentMana: number; // Represents hero's Current Energy
  maxMana: number; // Represents hero's Max Energy
  currentEnergy?: number;
  maxEnergy?: number;
  stats: CharacterStats;
  baseStats: CharacterStats; // Raw stats rolled at creation
  equipment: Equipment;
  inventory: InventoryItem[];
  maxInventorySlots: number;
  gold: number;
  rerollTokens: number;
  rations: number;
  torches: number;
  lockpicks: number;
  skills: HeroSkill[];
  activeEffects: StatusEffect[];
  // Journal & stats
  statsHistory: {
    roomsExplored: number;
    monstersSlain: number;
    chestsOpened: number;
    trapsDisarmed: number;
    goldCollected: number;
    highestDamageDealt: number;
    critsRolled: number;
    turnsSurvived: number;
  };
}

export type RoomType =
  | 'MONSTER'
  | 'TREASURE'
  | 'MERCHANT'
  | 'TRAP'
  | 'SHRINE'
  | 'CAMPFIRE'
  | 'SECRET'
  | 'STAIRS'
  | 'BOSS_ROOM';

export interface MonsterAction {
  name: string;
  description: string;
  damageDice: string; // e.g. "1d8+2"
  chance: number; // 0-1 weighting
  statusEffect?: StatusEffect;
}

export interface Monster {
  id: string;
  name: string;
  title: string;
  description: string;
  level: number;
  hp: number;
  maxHp: number;
  armorClass: number;
  dexterity?: number;
  attackBonus: number;
  actions: MonsterAction[];
  xpReward: number;
  goldMin: number;
  goldMax: number;
  lootDropChance: number;
  possibleLootIds: string[];
  icon: string;
  isBoss?: boolean;
  bossPhase?: number;
  maxBossPhases?: number;
}

export interface RoomDoor {
  targetRoomId: string;
  direction: 'north' | 'east' | 'south' | 'west';
  isLocked?: boolean;
  isTrapped?: boolean;
  lockDifficulty?: number;
  hint?: string;
}

export interface DungeonWall {
  id: string; // e.g. "wall_x0_y0_to_x1_y0"
  type: 'vertical' | 'horizontal';
  roomA: { x: number; y: number };
  roomB: { x: number; y: number };
  isBroken?: boolean;
}

export interface DungeonRoom {
  id: string;
  floor: number;
  roomNumber: number;
  gridX: number;
  gridY: number;
  type: RoomType;
  title: string;
  description: string;
  flavorText: string;
  isRevealed: boolean; // Face-up vs Face-down (Burgle Bros tile flipping)
  isExplored: boolean; // Has hero visited this tile
  isCleared: boolean;
  isBossRoom?: boolean; // Contains the floor boss and the descent stairs
  hasStairs?: boolean; // Stairs to descend to next floor
  isStairsUnlocked?: boolean; // Unlocked once boss is defeated
  doors: RoomDoor[];
  // Room contents
  monster?: Monster;
  chest?: {
    isLocked: boolean;
    lockDifficulty: number;
    isTrapped: boolean;
    trapDifficulty: number;
    isOpened: boolean;
    gold: number;
    items: GameItem[];
    isFailed?: boolean;
    isJammed?: boolean;
  };
  trap?: {
    id: string;
    name: string;
    description: string;
    difficulty: number;
    damageDice: string;
    disarmed: boolean;
    triggered: boolean;
  };
  shrine?: {
    id: string;
    name: string;
    description: string;
    god: string;
    used: boolean;
    buffGranted?: string;
  };
  secret?: {
    discovered: boolean;
    difficulty: number;
    rewardDescription: string;
    rewardClaimed: boolean;
    isFailed?: boolean;
  };
}

export interface CombatLogEntry {
  id: string;
  turn: number;
  sender: 'hero' | 'monster' | 'system';
  actionName: string;
  rollDetails?: {
    diceType: string;
    rolls: number[];
    modifier: number;
    total: number;
    targetValue?: number;
    isCrit?: boolean;
    isFumble?: boolean;
  };
  message: string;
  damageDealt?: number;
  hpRemainingTarget?: number;
}

export interface CombatState {
  isActive: boolean;
  turnNumber: number;
  monster: Monster;
  isHeroTurn: boolean;
  initiative: {
    hero: number;
    monster: number;
  };
  combatLogs: CombatLogEntry[];
  heroDefending: boolean;
  heroCatchingBreath?: boolean;
  heroStumbled?: boolean;
  monsterStumbled?: boolean;
  fledSuccessfully?: boolean;
  pendingReward?: {
    xp: number;
    gold: number;
    items: GameItem[];
  };
}

export interface DungeonFloor {
  floorNumber: number;
  floorName: string;
  theme: string;
  gridWidth: number; // 4
  gridHeight: number; // 4
  rooms: Record<string, DungeonRoom>;
  walls: DungeonWall[];
  startRoomId: string;
  stairsRoomId: string;
  currentRoomId: string;
  bossDefeated: boolean;
}

export interface GameState {
  phase: 'CHARACTER_CREATION' | 'EXPLORATION' | 'COMBAT' | 'CAMPFIRE' | 'MERCHANT' | 'GAME_OVER' | 'VICTORY';
  hero: HeroCharacter;
  currentFloor: number;
  maxFloors: number;
  floors: Record<number, DungeonFloor>;
  currentRoomId: string;
  combat: CombatState | null;
  selectedMerchantItem?: GameItem | null;
  historyLog: string[];
  highScores: ScoreRecord[];
  soundEnabled: boolean;
}

export interface ScoreRecord {
  id: string;
  heroName: string;
  heroClass: string;
  level: number;
  score: number;
  victory: boolean;
  date: string;
  floorsCleared: number;
  monstersSlain: number;
  goldAccumulated: number;
}
