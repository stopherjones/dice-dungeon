/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Volume2,
  VolumeX,
  BookOpen,
  Trophy,
  RotateCcw,
  Sparkles,
  Flame,
  Package,
  Dices,
  Heart,
  Tent,
  CheckCircle2,
  ArrowDownCircle,
  Store,
  Compass,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  CombatState,
  DungeonFloor,
  DungeonRoom,
  GameItem,
  GameState,
  HeroCharacter,
  Monster,
  StatType,
} from './types/game';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterSheet } from './components/CharacterSheet';
import { DungeonMap } from './components/DungeonMap';
import { BackpackPanel } from './components/BackpackPanel';
import { AdventurerDetailsPanel } from './components/AdventurerDetailsPanel';
import { MapPanel } from './components/MapPanel';
import { RulesCodexPanel } from './components/RulesCodexPanel';
import { RuleTab } from './components/RulesCodexView';
import { RoomModal } from './components/RoomModal';
import { MerchantModal } from './components/MerchantModal';
import { InventoryModal } from './components/InventoryModal';
import { LevelUpModal } from './components/LevelUpModal';
import { GameOverModal } from './components/GameOverModal';
import { RulebookModal } from './components/RulebookModal';
import { HallOfFameModal } from './components/HallOfFameModal';
import { JournalModal } from './components/JournalModal';
import { TableInspectorModal } from './components/TableInspectorModal';
import { CombatVictoryModal } from './components/CombatVictoryModal';
import { generateDungeonFloor, isRoomPassedThrough, getRoomDisplayInfo } from './utils/generator';
import { saveGameState, loadGameState, clearGameState } from './utils/storage';
import { sounds } from './utils/audio';
import { rollDice, getStatModifier } from './utils/dice';
import { ITEMS_DATABASE } from './data/items';
import {
  addItemToHero,
  consumeHeroRation,
  consumeHeroTorch,
  syncHeroSupplies,
} from './utils/inventory';
import { getHeroSkillsForLevel } from './utils/skills';

type GamePanelId = 'backpack' | 'adventurer' | 'map' | 'codex';

const PANEL_NAV_CONFIG: Record<
  GamePanelId,
  {
    prev: { target: GamePanelId; label: string };
    next: { target: GamePanelId; label: string };
  }
> = {
  backpack: {
    prev: { target: 'codex', label: 'Rules' },
    next: { target: 'adventurer', label: 'Adventurer' },
  },
  adventurer: {
    prev: { target: 'backpack', label: 'Backpack' },
    next: { target: 'map', label: 'Map' },
  },
  map: {
    prev: { target: 'adventurer', label: 'Adventurer' },
    next: { target: 'codex', label: 'Rules' },
  },
  codex: {
    prev: { target: 'map', label: 'Map' },
    next: { target: 'backpack', label: 'Backpack' },
  },
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = loadGameState();
    if (saved && saved.hero && saved.floors) {
      return saved;
    }
    return {
      phase: 'CHARACTER_CREATION',
      hero: null as unknown as HeroCharacter,
      currentFloor: 1,
      maxFloors: 3,
      floors: {},
      currentRoomId: '',
      combat: null,
      historyLog: ['Game Initialized.'],
      highScores: [],
      soundEnabled: true,
    };
  });

  // Modal Dialog UI state
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showMerchant, setShowMerchant] = useState(false);
  const [showRulebook, setShowRulebook] = useState(false);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showTableInspector, setShowTableInspector] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState(false);
  const [combatVictoryReward, setCombatVictoryReward] = useState<{
    monster: Monster;
    reward: { xp: number; gold: number; items: GameItem[] };
  } | null>(null);

  // 4-Panel Swipe Navigation: Backpack (left), Adventurer (middle-left), Map (middle-right), Rules Codex (right)
  const [activePanel, setActivePanel] = useState<GamePanelId>('adventurer');
  const [codexTab, setCodexTab] = useState<RuleTab>('dice');
  const panelsContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Active Map Action (triggered from Backpack or Map UI)
  const [activeMapAction, setActiveMapAction] = useState<
    'TORCH' | 'CLAIRVOYANCE' | 'SPYGLASS' | 'SMASH_WALL' | 'PHASE_WALL' | null
  >(null);

  // Track previous room for fleeing
  const [previousRoomId, setPreviousRoomId] = useState<string>('');

  // Smoothly scroll container to target panel
  const handleNavigatePanel = (targetPanel: GamePanelId, targetTab?: RuleTab) => {
    setActivePanel(targetPanel);
    if (targetTab) {
      setCodexTab(targetTab);
    }
    const container = panelsContainerRef.current;
    if (!container) return;
    const panelIndex =
      targetPanel === 'backpack' ? 0 : targetPanel === 'adventurer' ? 1 : targetPanel === 'map' ? 2 : 3;
    container.scrollTo({
      left: panelIndex * container.clientWidth,
      behavior: 'smooth',
    });
  };

  // Sync scroll position with activePanel state during swipe/scroll
  const handlePanelsScroll = () => {
    const container = panelsContainerRef.current;
    if (!container) return;
    const { scrollLeft, clientWidth } = container;
    if (clientWidth === 0) return;
    const index = Math.round(scrollLeft / clientWidth);
    const panels: GamePanelId[] = ['backpack', 'adventurer', 'map', 'codex'];
    const resolved = panels[index];
    if (resolved && resolved !== activePanel) {
      setActivePanel(resolved);
    }
  };

  // Touch gesture swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Detect dominant horizontal swipe gesture
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        // Swiped left -> move right
        if (activePanel === 'backpack') handleNavigatePanel('adventurer');
        else if (activePanel === 'adventurer') handleNavigatePanel('map');
        else if (activePanel === 'map') handleNavigatePanel('codex');
      } else {
        // Swiped right -> move left
        if (activePanel === 'codex') handleNavigatePanel('map');
        else if (activePanel === 'map') handleNavigatePanel('adventurer');
        else if (activePanel === 'adventurer') handleNavigatePanel('backpack');
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Mouse drag gesture handling for desktop
  const mouseStartX = useRef<number | null>(null);
  const mouseStartY = useRef<number | null>(null);
  const isMouseDownPanels = useRef(false);

  const handlePanelMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [data-no-panel-drag]')) return;
    mouseStartX.current = e.clientX;
    mouseStartY.current = e.clientY;
    isMouseDownPanels.current = true;
  };

  const handlePanelMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDownPanels.current || mouseStartX.current === null) return;
    const deltaX = e.clientX - mouseStartX.current;
    const deltaY = e.clientY - (mouseStartY.current || e.clientY);
    isMouseDownPanels.current = false;
    mouseStartX.current = null;
    mouseStartY.current = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        // Dragged left -> advance right
        if (activePanel === 'backpack') handleNavigatePanel('adventurer');
        else if (activePanel === 'adventurer') handleNavigatePanel('map');
        else if (activePanel === 'map') handleNavigatePanel('codex');
      } else {
        // Dragged right -> advance left
        if (activePanel === 'codex') handleNavigatePanel('map');
        else if (activePanel === 'map') handleNavigatePanel('adventurer');
        else if (activePanel === 'adventurer') handleNavigatePanel('backpack');
      }
    }
  };

  // Keyboard navigation with Arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.phase === 'CHARACTER_CREATION') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        if (activePanel === 'codex') handleNavigatePanel('map');
        else if (activePanel === 'map') handleNavigatePanel('adventurer');
        else if (activePanel === 'adventurer') handleNavigatePanel('backpack');
      } else if (e.key === 'ArrowRight') {
        if (activePanel === 'backpack') handleNavigatePanel('adventurer');
        else if (activePanel === 'adventurer') handleNavigatePanel('map');
        else if (activePanel === 'map') handleNavigatePanel('codex');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, gameState.phase]);

  // Maintain panel alignment on window resize
  useEffect(() => {
    const handleResize = () => {
      const container = panelsContainerRef.current;
      if (!container) return;
      const idx =
        activePanel === 'backpack' ? 0 : activePanel === 'adventurer' ? 1 : activePanel === 'map' ? 2 : 3;
      container.scrollTo({
        left: idx * container.clientWidth,
        behavior: 'auto',
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activePanel]);

  // Persist state to localStorage on update
  useEffect(() => {
    if (gameState.phase !== 'CHARACTER_CREATION' && gameState.hero) {
      saveGameState(gameState);
    }
  }, [gameState]);

  // Sync sound setting
  useEffect(() => {
    sounds.setEnabled(gameState.soundEnabled);
  }, [gameState.soundEnabled]);

  // Check for Level-Up condition
  useEffect(() => {
    if (!gameState.hero) return;
    if (gameState.hero.xp >= gameState.hero.xpToNextLevel && !pendingLevelUp) {
      sounds.playLevelUp();
      setPendingLevelUp(true);
    }
  }, [gameState.hero?.xp, gameState.hero?.xpToNextLevel, pendingLevelUp]);

  // Check for Hero Death
  useEffect(() => {
    if (!gameState.hero) return;
    if (gameState.hero.currentHp <= 0 && gameState.phase !== 'GAME_OVER') {
      sounds.playDeath();
      setGameState((prev) => ({
        ...prev,
        phase: 'GAME_OVER',
        combat: null,
      }));
    }
  }, [gameState.hero?.currentHp, gameState.phase]);

  // Start new run from Character Creation
  const handleCharacterCreated = (hero: HeroCharacter) => {
    const floor1 = generateDungeonFloor(1);
    const startRoomId = floor1.startRoomId;

    setGameState({
      phase: 'EXPLORATION',
      hero,
      currentFloor: 1,
      maxFloors: 3,
      floors: { 1: floor1 },
      currentRoomId: startRoomId,
      combat: null,
      historyLog: [`${hero.name} entered Floor 1: ${floor1.floorName}`],
      highScores: [],
      soundEnabled: gameState.soundEnabled,
    });
    setPreviousRoomId(startRoomId);
    setShowRoomModal(false);
    setActivePanel('adventurer');
    setTimeout(() => {
      handleNavigatePanel('adventurer');
    }, 50);
  };

  // Toggle Sound FX
  const handleToggleSound = () => {
    const next = !gameState.soundEnabled;
    sounds.setEnabled(next);
    setGameState((prev) => ({ ...prev, soundEnabled: next }));
  };

  // Light Torch to reveal a single chosen adjacent room without entering it
  const handleUseTorch = (targetRoomId: string) => {
    if (!gameState.hero || gameState.hero.torches <= 0) return;
    const currentFloorObj = gameState.floors[gameState.currentFloor];
    if (!currentFloorObj || !currentFloorObj.rooms[targetRoomId]) return;

    const currentRoom = currentFloorObj.rooms[gameState.currentRoomId];
    if (currentRoom) {
      // Prevent peeking through unbroken solid wall
      const wall = (currentFloorObj.walls || []).find(
        (w) =>
          (w.roomA.x === currentRoom.gridX &&
            w.roomA.y === currentRoom.gridY &&
            w.roomB.x === currentFloorObj.rooms[targetRoomId].gridX &&
            w.roomB.y === currentFloorObj.rooms[targetRoomId].gridY) ||
          (w.roomA.x === currentFloorObj.rooms[targetRoomId].gridX &&
            w.roomA.y === currentFloorObj.rooms[targetRoomId].gridY &&
            w.roomB.x === currentRoom.gridX &&
            w.roomB.y === currentRoom.gridY)
      );
      if (wall && !wall.isBroken) {
        sounds.playBlock();
        return;
      }
    }

    const targetRoom = { ...currentFloorObj.rooms[targetRoomId], isRevealed: true };
    const hero = { ...gameState.hero, inventory: [...gameState.hero.inventory] };
    consumeHeroTorch(hero);

    setGameState((prev) => ({
      ...prev,
      hero,
      floors: {
        ...prev.floors,
        [prev.currentFloor]: {
          ...currentFloorObj,
          rooms: {
            ...currentFloorObj.rooms,
            [targetRoomId]: targetRoom,
          },
        },
      },
      historyLog: [
        ...prev.historyLog,
        `Lit Pitch Torch to illuminate Chamber [${targetRoom.gridX + 1}, ${targetRoom.gridY + 1}]!`,
      ],
    }));
  };

  // Cast Clairvoyance Scroll to peek any room card on the 4x4 board
  const handleUseClairvoyance = (targetRoomId: string) => {
    if (!gameState.hero) return;
    const hero = { ...gameState.hero };
    const scrollIdx = hero.inventory.findIndex((i) => i.item.id === 'scroll_of_clairvoyance');
    if (scrollIdx === -1) return;

    if (hero.inventory[scrollIdx].quantity > 1) {
      hero.inventory[scrollIdx].quantity -= 1;
    } else {
      hero.inventory.splice(scrollIdx, 1);
    }
    syncHeroSupplies(hero);

    const floorObj = gameState.floors[gameState.currentFloor];
    if (floorObj && floorObj.rooms[targetRoomId]) {
      floorObj.rooms[targetRoomId].isRevealed = true;
    }

    setGameState((prev) => ({
      ...prev,
      hero,
      floors: {
        ...prev.floors,
        [prev.currentFloor]: { ...floorObj },
      },
      historyLog: [
        ...prev.historyLog,
        `Cast Clairvoyance to reveal Chamber [${(floorObj?.rooms[targetRoomId]?.gridX ?? 0) + 1}, ${(floorObj?.rooms[targetRoomId]?.gridY ?? 0) + 1}]!`,
      ],
    }));
  };

  // Use Burglar's Spyglass to peek an adjacent room without consuming a torch
  const handleUseSpyglass = (targetRoomId: string) => {
    if (!gameState.hero) return;
    const currentFloorObj = gameState.floors[gameState.currentFloor];
    if (!currentFloorObj || !currentFloorObj.rooms[targetRoomId]) return;

    const targetRoom = { ...currentFloorObj.rooms[targetRoomId], isRevealed: true };

    setGameState((prev) => ({
      ...prev,
      floors: {
        ...prev.floors,
        [prev.currentFloor]: {
          ...currentFloorObj,
          rooms: {
            ...currentFloorObj.rooms,
            [targetRoomId]: targetRoom,
          },
        },
      },
      historyLog: [
        ...prev.historyLog,
        `Used Burglar's Spyglass to scout Chamber [${targetRoom.gridX + 1}, ${targetRoom.gridY + 1}]!`,
      ],
    }));
  };

  // Open Map and activate corresponding action from Backpack
  const handleActivateMapAction = (
    action: 'TORCH' | 'CLAIRVOYANCE' | 'SPYGLASS' | 'SMASH_WALL' | 'PHASE_WALL'
  ) => {
    setShowInventory(false);
    setShowRoomModal(false);
    setActiveMapAction(action);
    handleNavigatePanel('map');
  };

  // Smash an interior stone wall with sledgehammer or pickaxe
  const handleSmashWall = (wallId: string, item: GameItem) => {
    if (!gameState.hero) return;
    const hero = { ...gameState.hero };
    const floorObj = gameState.floors[gameState.currentFloor];
    if (!floorObj) return;

    const wall = (floorObj.walls || []).find((w) => w.id === wallId);
    if (!wall) return;

    wall.isBroken = true;

    // Deduct charge or item
    const itemInv = hero.inventory.find((i) => i.item.id === item.id);
    if (itemInv) {
      if (itemInv.chargesLeft !== undefined) {
        itemInv.chargesLeft -= 1;
        if (itemInv.chargesLeft <= 0) {
          hero.inventory = hero.inventory.filter((i) => i !== itemInv);
        }
      } else if (item.charges && item.charges > 1) {
        itemInv.chargesLeft = item.charges - 1;
      } else {
        if (itemInv.quantity > 1) itemInv.quantity -= 1;
        else hero.inventory = hero.inventory.filter((i) => i !== itemInv);
      }
    }

    // Recompute doors for affected rooms
    const roomAId = `floor_${gameState.currentFloor}_r${wall.roomA.x}_${wall.roomA.y}`;
    const roomBId = `floor_${gameState.currentFloor}_r${wall.roomB.x}_${wall.roomB.y}`;

    const roomA = floorObj.rooms[roomAId];
    const roomB = floorObj.rooms[roomBId];

    if (roomA && !roomA.doors.some((d) => d.targetRoomId === roomBId)) {
      roomA.doors.push({
        targetRoomId: roomBId,
        direction: wall.type === 'vertical' ? 'east' : 'south',
      });
    }
    if (roomB && !roomB.doors.some((d) => d.targetRoomId === roomAId)) {
      roomB.doors.push({
        targetRoomId: roomAId,
        direction: wall.type === 'vertical' ? 'west' : 'north',
      });
    }

    setGameState((prev) => ({
      ...prev,
      hero,
      floors: {
        ...prev.floors,
        [prev.currentFloor]: { ...floorObj },
      },
    }));
  };

  // Phase through a solid stone wall into adjacent room
  const handlePhaseThroughWall = (targetRoomId: string, item?: GameItem) => {
    if (!gameState.hero) return;
    const hero = { ...gameState.hero };

    if (item && item.id === 'potion_of_phasing') {
      const pIdx = hero.inventory.findIndex((i) => i.item.id === 'potion_of_phasing');
      if (pIdx !== -1) {
        if (hero.inventory[pIdx].quantity > 1) hero.inventory[pIdx].quantity -= 1;
        else hero.inventory.splice(pIdx, 1);
      }
    }

    handleNavigateToRoom(targetRoomId);
  };

  // Navigate to an adjacent room (reveals tile face-up and enters directly)
  const handleNavigateToRoom = (targetRoomId: string) => {
    const floorObj = gameState.floors[gameState.currentFloor];
    if (!floorObj || !floorObj.rooms[targetRoomId]) return;

    // Check if current room has undefeated monster or active trap blocking passage
    const currentRoom = floorObj.rooms[gameState.currentRoomId];
    if (currentRoom) {
      if (currentRoom.monster && currentRoom.monster.hp > 0) {
        sounds.playBlock();
        return;
      }
      if (currentRoom.trap && !currentRoom.trap.disarmed) {
        // Traps remain active until disarmed. Player can retreat back the way they came, but cannot progress forward to new rooms.
        if (previousRoomId && targetRoomId !== previousRoomId) {
          sounds.playTrap();
          return;
        }
      }
    }

    const targetRoom = { ...floorObj.rooms[targetRoomId] };
    const wasExplored = targetRoom.isExplored;
    
    targetRoom.isRevealed = true; // Turn over room card face-up!
    targetRoom.isExplored = true;
    sounds.playTileReveal();

    const updatedHero = { ...gameState.hero };
    if (!wasExplored) {
      updatedHero.statsHistory.roomsExplored += 1;
    }

    setPreviousRoomId(gameState.currentRoomId);
    const isTargetPassed = isRoomPassedThrough(targetRoom);
    if (!isTargetPassed && targetRoom.type !== 'CAMPFIRE') {
      setShowRoomModal(true);
    } else {
      setShowRoomModal(false);
    }

    setGameState((prev) => ({
      ...prev,
      hero: updatedHero,
      currentRoomId: targetRoomId,
      floors: {
        ...prev.floors,
        [prev.currentFloor]: {
          ...floorObj,
          currentRoomId: targetRoomId,
          rooms: {
            ...floorObj.rooms,
            [targetRoomId]: targetRoom,
          },
        },
      },
    }));
  };

  // Initiate Combat
  const handleEnterCombat = (room: DungeonRoom) => {
    if (!room.monster) return;
    sounds.playDiceRoll();
    setShowRoomModal(true);

    const heroInitiative = rollDice(1, 20, getStatModifier(gameState.hero.stats.DEX));
    const monsterInitiative = rollDice(1, 20, getStatModifier(room.monster.dexterity ?? 10));
    const isHeroTurn = heroInitiative.total >= monsterInitiative.total;

    const combatState: CombatState = {
      isActive: true,
      turnNumber: 1,
      monster: JSON.parse(JSON.stringify(room.monster)),
      isHeroTurn,
      initiative: {
        hero: heroInitiative.total,
        monster: monsterInitiative.total,
      },
      combatLogs: [
        {
          id: `log_init_${Date.now()}`,
          turn: 1,
          sender: 'system',
          actionName: 'Initiative Rolled',
          message: `You face ${room.monster.name} (${room.monster.title})! Initiative: You rolled [${heroInitiative.individualRolls[0]}] ${heroInitiative.modifier >= 0 ? '+' : ''}${heroInitiative.modifier} = ${heroInitiative.total}; ${room.monster.name} rolled [${monsterInitiative.individualRolls[0]}] ${monsterInitiative.modifier >= 0 ? '+' : ''}${monsterInitiative.modifier} = ${monsterInitiative.total}. ${isHeroTurn ? 'You act first.' : `${room.monster.name} acts first.`}`,
          rollDetails: {
            diceType: 'd20 initiative',
            rolls: [heroInitiative.individualRolls[0], monsterInitiative.individualRolls[0]],
            modifier: heroInitiative.modifier,
            total: heroInitiative.total,
          },
        },
      ],
      heroDefending: false,
    };

    setGameState((prev) => ({
      ...prev,
      phase: 'COMBAT',
      combat: combatState,
    }));
  };

  // Combat Victory
  const handleCombatVictory = (
    monster: Monster,
    reward: { xp: number; gold: number; items: GameItem[] }
  ) => {
    const currentFloorObj = gameState.floors[gameState.currentFloor];
    const currentRoom = currentFloorObj.rooms[gameState.currentRoomId];

    if (currentRoom) {
      currentRoom.isCleared = true;
      if (currentRoom.monster) {
        currentRoom.monster.hp = 0;
      }
      if (currentRoom.isBossRoom) {
        currentRoom.isStairsUnlocked = true;
        currentFloorObj.bossDefeated = true;
      }
    }

    // Exit combat mode and present the Combat Victory Loot Pop-Up!
    setGameState((prev) => ({
      ...prev,
      phase: 'EXPLORATION',
      combat: null,
      floors: {
        ...prev.floors,
        [prev.currentFloor]: { ...currentFloorObj },
      },
    }));

    setCombatVictoryReward({
      monster,
      reward,
    });
  };

  const handleClaimCombatVictoryLoot = () => {
    if (!combatVictoryReward || !gameState.hero) return;
    const { monster, reward } = combatVictoryReward;

    const updatedHero = { ...gameState.hero };
    updatedHero.xp += reward.xp;
    updatedHero.gold += reward.gold;
    updatedHero.statsHistory.goldCollected += reward.gold;

    reward.items.forEach((item) => {
      addItemToHero(updatedHero, item, 1);
    });
    syncHeroSupplies(updatedHero);

    setCombatVictoryReward(null);

    // Check if this was the Dragon boss on Floor 3 (Final Victory!)
    if (monster.id === 'crimson_dragon') {
      setGameState((prev) => ({
        ...prev,
        hero: updatedHero,
        phase: 'VICTORY',
        combat: null,
      }));
      return;
    }

    setGameState((prev) => ({
      ...prev,
      hero: updatedHero,
    }));
  };

  // Flee from Combat (Retreats to previous room or start room)
  const handleCombatFlee = () => {
    const floorObj = gameState.floors[gameState.currentFloor];
    const safeRoomId =
      previousRoomId && previousRoomId !== gameState.currentRoomId
        ? previousRoomId
        : floorObj.startRoomId;

    setGameState((prev) => ({
      ...prev,
      phase: 'EXPLORATION',
      combat: null,
      currentRoomId: safeRoomId,
    }));
  };

  // Descend to Next Floor
  const handleDescendFloor = () => {
    const nextFloorNumber = gameState.currentFloor + 1;
    if (nextFloorNumber > gameState.maxFloors) {
      // Completed Floor 3 Dragon
      setGameState((prev) => ({ ...prev, phase: 'VICTORY' }));
      return;
    }

    sounds.playLevelUp();
    sounds.playHeal();
    const nextFloorObj = generateDungeonFloor(nextFloorNumber);

    // Fully restore HP & Mana upon descending to the next floor's Hearth
    const updatedHero = gameState.hero
      ? {
          ...gameState.hero,
          currentHp: gameState.hero.maxHp,
          currentMana: gameState.hero.maxMana,
        }
      : gameState.hero;

    setGameState((prev) => ({
      ...prev,
      hero: updatedHero,
      currentFloor: nextFloorNumber,
      currentRoomId: nextFloorObj.startRoomId,
      floors: {
        ...prev.floors,
        [nextFloorNumber]: nextFloorObj,
      },
      phase: 'EXPLORATION',
      historyLog: [
        `Descended the spiral staircase into Floor ${nextFloorNumber}. The warm embers of the entrance Hearth fully revitalized your HP (${updatedHero?.maxHp}/${updatedHero?.maxHp}) & Energy (${updatedHero?.maxMana}/${updatedHero?.maxMana} EP)!`,
        ...prev.historyLog,
      ],
    }));
    setPreviousRoomId(nextFloorObj.startRoomId);
    setShowRoomModal(false);
  };

  // Confirm Level Up
  const handleConfirmLevelUp = (chosenStat: StatType) => {
    if (!gameState.hero) return;
    const hero = { ...gameState.hero };

    hero.level += 1;
    hero.xp -= hero.xpToNextLevel;
    hero.xpToNextLevel = Math.floor(hero.xpToNextLevel * 1.5);
    hero.maxHp += 8;
    hero.currentHp = hero.maxHp;
    hero.maxMana += 6;
    hero.currentMana = hero.maxMana;
    hero.stats[chosenStat] += 2;
    
    // Grant 1 Fate Reroll Token on level up
    hero.rerollTokens = (hero.rerollTokens || 0) + 1;

    // Upgrade Spells & Skills to match new Hero Level
    hero.skills = getHeroSkillsForLevel(hero.classId, hero.level);

    syncHeroSupplies(hero);

    setPendingLevelUp(false);
    setGameState((prev) => ({ ...prev, hero }));
  };

  // Restart Quest / Character Creation
  const handleRestartNewGame = () => {
    clearGameState();
    setGameState({
      phase: 'CHARACTER_CREATION',
      hero: null as unknown as HeroCharacter,
      currentFloor: 1,
      maxFloors: 3,
      floors: {},
      currentRoomId: '',
      combat: null,
      historyLog: [],
      highScores: [],
      soundEnabled: gameState.soundEnabled,
    });
  };

  const currentFloorObj = gameState.floors[gameState.currentFloor];
  const currentRoom = currentFloorObj?.rooms[gameState.currentRoomId];

  return (
    <div className="h-full h-dvh w-full max-w-full bg-[#140e08] text-[#f4ecd8] font-serif flex flex-col selection:bg-amber-800 selection:text-amber-100 overflow-hidden">
      {/* Top Medieval Header Bar */}
      <header className="bg-[#21170f] border-b-2 border-[#6d4f32] px-2 sm:px-3 py-1.5 sm:py-2 shadow-md flex items-center justify-between sticky top-0 z-40 shrink-0 w-full max-w-full overflow-hidden">
        {/* Left: Brand Wordmark */}
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-serif font-black text-[#fae9cb] tracking-wide leading-none truncate">
              DICE DUNGEON
            </h1>
            <span className="text-[9px] sm:text-[10px] text-[#c9a674] font-mono block mt-0.5 truncate">
              <span className="hidden sm:inline">Solo Paper RPG • </span>Floor {gameState.currentFloor}
            </span>
          </div>
        </div>

        {/* Center: Navigation Pill for 4 Game Panels (Backpack, Adventurer, Map, Rules Codex) */}
        {gameState.phase !== 'CHARACTER_CREATION' && gameState.hero && (
          <nav
            id="header-panel-navigation-pill"
            className="flex items-center p-0.5 bg-[#160f08] rounded-full border border-[#5a3f28] shadow-inner text-xs font-serif shrink-0 mx-1"
            aria-label="Panel Navigation"
          >
            <button
              id="btn-pill-backpack"
              onClick={() => handleNavigatePanel('backpack')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePanel === 'backpack'
                  ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 shadow-md border border-amber-500/60'
                  : 'text-stone-400 hover:text-amber-200'
              }`}
              title="View Backpack & Equipment (Panel 1)"
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Backpack</span>
            </button>

            <button
              id="btn-pill-adventurer"
              onClick={() => handleNavigatePanel('adventurer')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePanel === 'adventurer'
                  ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 shadow-md border border-amber-500/60'
                  : 'text-stone-400 hover:text-amber-200'
              }`}
              title="View Adventurer Details (Panel 2)"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Adventurer</span>
            </button>

            <button
              id="btn-pill-map"
              onClick={() => handleNavigatePanel('map')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePanel === 'map'
                  ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 shadow-md border border-amber-500/60'
                  : 'text-stone-400 hover:text-amber-200'
              }`}
              title="View Dungeon Map & Chambers (Panel 3)"
            >
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Map</span>
            </button>

            <button
              id="btn-pill-codex"
              onClick={() => handleNavigatePanel('codex')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePanel === 'codex'
                  ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 shadow-md border border-amber-500/60'
                  : 'text-stone-400 hover:text-amber-200'
              }`}
              title="View Rules Codex, Tables & Leaderboard (Panel 4)"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Codex</span>
            </button>
          </nav>
        )}

        {/* Right: Sound & Restart Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            id="btn-toggle-sound"
            onClick={handleToggleSound}
            className="p-1.5 bg-[#332214] hover:bg-[#4a321e] text-amber-200 border border-[#6b4a2b] rounded-lg text-xs transition-colors cursor-pointer shrink-0"
            title={gameState.soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {gameState.soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-stone-500" />
            )}
          </button>

          <button
            id="btn-restart-game-top"
            onClick={handleRestartNewGame}
            className="p-1.5 bg-[#332214] hover:bg-[#4a321e] text-stone-300 hover:text-amber-200 border border-[#6b4a2b] rounded-lg text-xs transition-colors cursor-pointer shrink-0"
            title="Restart New Quest / Character"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 w-full max-w-full overflow-hidden flex flex-col relative">
        {gameState.phase === 'CHARACTER_CREATION' && (
          <div className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col">
            <CharacterCreation onCharacterCreated={handleCharacterCreated} />
          </div>
        )}

        {gameState.phase !== 'CHARACTER_CREATION' && gameState.hero && currentFloorObj && (
          <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
            {/* Desktop Left/Right Quick Jump Floating Chevrons */}
            {activePanel !== 'backpack' && (
              <button
                onClick={() =>
                  handleNavigatePanel(
                    activePanel === 'codex'
                      ? 'map'
                      : activePanel === 'map'
                        ? 'adventurer'
                        : 'backpack'
                  )
                }
                className="hidden xl:flex fixed left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 bg-[#21170f]/90 hover:bg-[#382618] border border-[#6b4c2b] text-amber-200 rounded-full shadow-2xl backdrop-blur-sm cursor-pointer transition-all hover:scale-110 active:scale-95 items-center gap-1"
                title={`Jump to ${
                  activePanel === 'codex'
                    ? 'Dungeon Map'
                    : activePanel === 'map'
                      ? 'Adventurer Details'
                      : 'Backpack'
                }`}
              >
                <ChevronLeft className="w-5 h-5 text-amber-400" />
              </button>
            )}

            {activePanel !== 'codex' && (
              <button
                onClick={() =>
                  handleNavigatePanel(
                    activePanel === 'backpack'
                      ? 'adventurer'
                      : activePanel === 'adventurer'
                        ? 'map'
                        : 'codex'
                  )
                }
                className="hidden xl:flex fixed right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 bg-[#21170f]/90 hover:bg-[#382618] border border-[#6b4c2b] text-amber-200 rounded-full shadow-2xl backdrop-blur-sm cursor-pointer transition-all hover:scale-110 active:scale-95 items-center gap-1"
                title={`Jump to ${
                  activePanel === 'backpack'
                    ? 'Adventurer Details'
                    : activePanel === 'adventurer'
                      ? 'Dungeon Map'
                      : 'Rules Codex'
                }`}
              >
                <ChevronRight className="w-5 h-5 text-amber-400" />
              </button>
            )}

            {/* 4 Swipeable Panels: Backpack (Left), Adventurer Details (Middle-Left), Map (Middle-Right), Rules Codex (Right) */}
            <div
              ref={panelsContainerRef}
              onScroll={handlePanelsScroll}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handlePanelMouseDown}
              onMouseUp={handlePanelMouseUp}
              className="w-full h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth no-scrollbar cursor-grab active:cursor-grabbing select-none"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {/* Panel 1: Backpack (Left) */}
              <div
                id="panel-backpack"
                className="w-full shrink-0 snap-center snap-always h-full overflow-y-auto px-2.5 sm:px-4 py-3 sm:py-4 max-w-4xl mx-auto flex flex-col justify-start"
              >
                <BackpackPanel
                  hero={gameState.hero}
                  onUpdateHero={(updatedHero) =>
                    setGameState((prev) => ({ ...prev, hero: updatedHero }))
                  }
                  onActivateMapAction={(action) => {
                    handleActivateMapAction(action);
                    handleNavigatePanel('map');
                  }}
                  onGoToAdventurer={() => handleNavigatePanel('adventurer')}
                  onGoToMap={() => handleNavigatePanel('map')}
                />
              </div>

              {/* Panel 2: Adventurer Details (Middle-Left) */}
              <div
                id="panel-adventurer"
                className="w-full shrink-0 snap-center snap-always h-full overflow-y-auto px-2.5 sm:px-4 py-3 sm:py-4 max-w-4xl mx-auto flex flex-col justify-start"
              >
                <AdventurerDetailsPanel
                  hero={gameState.hero}
                  historyLog={gameState.historyLog}
                  onOpenInventory={() => handleNavigatePanel('backpack')}
                  onOpenJournal={() => setShowJournal(true)}
                  onGoToBackpack={() => handleNavigatePanel('backpack')}
                  onGoToMap={() => handleNavigatePanel('map')}
                />
              </div>

              {/* Panel 3: Map (Middle-Right) */}
              <div
                id="panel-map"
                className="w-full shrink-0 snap-center snap-always h-full overflow-y-auto px-2.5 sm:px-4 py-3 sm:py-4 max-w-4xl mx-auto flex flex-col justify-start"
              >
                <MapPanel
                  floor={currentFloorObj}
                  currentRoomId={gameState.currentRoomId}
                  hero={gameState.hero}
                  activeMapAction={activeMapAction}
                  onClearMapAction={() => setActiveMapAction(null)}
                  onToggleMapAction={(action) => setActiveMapAction((prev) => (prev === action ? null : action))}
                  onSelectAdjacentRoom={handleNavigateToRoom}
                  onSmashWall={handleSmashWall}
                  onPhaseThroughWall={handlePhaseThroughWall}
                  onUseTorch={handleUseTorch}
                  onUseClairvoyance={handleUseClairvoyance}
                  onUseSpyglass={handleUseSpyglass}
                  onOpenCurrentRoom={() => setShowRoomModal(true)}
                  onDescendFloor={handleDescendFloor}
                  onGoToAdventurer={() => handleNavigatePanel('adventurer')}
                  onGoToBackpack={() => handleNavigatePanel('backpack')}
                  onGoToCodex={() => handleNavigatePanel('codex')}
                />
              </div>

              {/* Panel 4: Rules Codex (Right of Map) */}
              <div
                id="panel-codex"
                className="w-full shrink-0 snap-center snap-always h-full overflow-y-auto px-2.5 sm:px-4 py-3 sm:py-4 max-w-4xl mx-auto flex flex-col justify-start"
              >
                <RulesCodexPanel
                  onGoToMap={() => handleNavigatePanel('map')}
                  initialTab={codexTab}
                  activeTab={codexTab}
                  onTabChange={(tab) => setCodexTab(tab)}
                />
              </div>
            </div>

            {/* Main Panels Sticky Navigation Footer */}
            <div className="shrink-0 z-30 w-full bg-[#160f09]/98 border-t-2 border-amber-800/80 shadow-[0_-8px_20px_rgba(0,0,0,0.85)] backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 w-full">
                <button
                  id="btn-footer-nav-prev"
                  onClick={() => handleNavigatePanel(PANEL_NAV_CONFIG[activePanel].prev.target)}
                  className="flex-1 py-2 sm:py-2.5 px-2 sm:px-3 bg-[#241a12] hover:bg-[#382618] active:bg-[#1a110a] border border-[#6b4c2b] text-amber-200 hover:text-amber-100 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow text-xs sm:text-sm font-serif font-bold"
                >
                  <ChevronLeft className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{PANEL_NAV_CONFIG[activePanel].prev.label}</span>
                </button>

                <button
                  id="btn-footer-nav-next"
                  onClick={() => handleNavigatePanel(PANEL_NAV_CONFIG[activePanel].next.target)}
                  className="flex-1 py-2 sm:py-2.5 px-2 sm:px-3 bg-[#241a12] hover:bg-[#382618] active:bg-[#1a110a] border border-[#6b4c2b] text-amber-200 hover:text-amber-100 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow text-xs sm:text-sm font-serif font-bold"
                >
                  <span className="truncate">{PANEL_NAV_CONFIG[activePanel].next.label}</span>
                  <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals & Overlays */}
      {/* Full-Screen Room Exploration & Combat Pop-Up Modal */}
      {currentFloorObj && currentRoom && gameState.hero && (
        <RoomModal
          isOpen={showRoomModal || gameState.phase === 'COMBAT'}
          onClose={() => setShowRoomModal(false)}
          floor={currentFloorObj}
          room={currentRoom}
          hero={gameState.hero}
          combat={gameState.combat}
          previousRoomId={previousRoomId}
          onUpdateHero={(updatedHero) =>
            setGameState((prev) => ({ ...prev, hero: updatedHero }))
          }
          onUpdateRoom={(updatedRoom) => {
            setGameState((prev) => ({
              ...prev,
              floors: {
                ...prev.floors,
                [prev.currentFloor]: {
                  ...currentFloorObj,
                  rooms: {
                    ...currentFloorObj.rooms,
                    [updatedRoom.id]: updatedRoom,
                  },
                },
              },
            }));
          }}
          onEnterCombat={handleEnterCombat}
          onUpdateCombat={(updatedCombat) =>
            setGameState((prev) => ({ ...prev, combat: updatedCombat }))
          }
          onCombatVictory={handleCombatVictory}
          onCombatFlee={handleCombatFlee}
          onOpenMerchant={() => setShowMerchant(true)}
          onNavigateToRoom={handleNavigateToRoom}
          onUseTorch={handleUseTorch}
          onSmashWall={handleSmashWall}
          onPhaseThroughWall={handlePhaseThroughWall}
          onDescendFloor={handleDescendFloor}
          onOpenInventory={() => setShowInventory(true)}
        />
      )}
      {showInventory && gameState.hero && (
        <InventoryModal
          hero={gameState.hero}
          onUpdateHero={(updatedHero) => setGameState((prev) => ({ ...prev, hero: updatedHero }))}
          onClose={() => setShowInventory(false)}
          onActivateMapAction={handleActivateMapAction}
        />
      )}

      {showMerchant && gameState.hero && (
        <MerchantModal
          hero={gameState.hero}
          floorNumber={gameState.currentFloor}
          onUpdateHero={(updatedHero) => setGameState((prev) => ({ ...prev, hero: updatedHero }))}
          onClose={() => setShowMerchant(false)}
        />
      )}

      {showRulebook && <RulebookModal onClose={() => setShowRulebook(false)} />}

      {showJournal && gameState.hero && (
        <JournalModal
          hero={gameState.hero}
          currentFloor={gameState.currentFloor}
          onClose={() => setShowJournal(false)}
        />
      )}

      {showTableInspector && (
        <TableInspectorModal
          isOpen={showTableInspector}
          onClose={() => setShowTableInspector(false)}
        />
      )}

      {pendingLevelUp && gameState.hero && (
        <LevelUpModal hero={gameState.hero} onConfirmLevelUp={handleConfirmLevelUp} />
      )}

      {combatVictoryReward && gameState.hero && (
        <CombatVictoryModal
          isOpen={true}
          monster={combatVictoryReward.monster}
          reward={combatVictoryReward.reward}
          hero={gameState.hero}
          onClaim={handleClaimCombatVictoryLoot}
        />
      )}

      {(gameState.phase === 'GAME_OVER' || gameState.phase === 'VICTORY') && gameState.hero && (
        <GameOverModal
          hero={gameState.hero}
          isVictory={gameState.phase === 'VICTORY'}
          floorsCleared={gameState.currentFloor}
          onRestartNewGame={handleRestartNewGame}
          onOpenHallOfFame={() => {
            setShowHallOfFame(true);
          }}
        />
      )}

      {showHallOfFame && <HallOfFameModal onClose={() => setShowHallOfFame(false)} />}
    </div>
  );
}
