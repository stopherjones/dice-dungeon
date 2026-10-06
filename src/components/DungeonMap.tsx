/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Compass,
  Flame,
  Skull,
  Package,
  Store,
  Tent,
  Sun,
  AlertTriangle,
  HelpCircle,
  Footprints,
  Eye,
  Hammer,
  Sparkles,
  ShieldAlert,
  Crown,
  ChevronRight,
  Info,
  Maximize2,
  CheckCircle2,
  ArrowDownCircle,
  X,
  Ghost,
} from 'lucide-react';
import { DungeonFloor, DungeonRoom, GameItem, HeroCharacter, RoomType } from '../types/game';
import { sounds } from '../utils/audio';
import {
  areCoordinatesAdjacent,
  hasWallBetween,
  isBossCandidatePosition,
  isRoomPassedThrough,
  getRoomDisplayInfo,
} from '../utils/generator';

interface DungeonMapProps {
  floor: DungeonFloor;
  currentRoomId: string;
  hero: HeroCharacter;
  activeMapAction?: 'TORCH' | 'CLAIRVOYANCE' | 'SPYGLASS' | 'SMASH_WALL' | 'PHASE_WALL' | null;
  onClearMapAction?: () => void;
  onSelectAdjacentRoom: (targetRoomId: string) => void;
  onSmashWall: (wallId: string, item: GameItem) => void;
  onPhaseThroughWall: (targetRoomId: string, item?: GameItem) => void;
  onUseTorch: (targetRoomId: string) => void;
  onUseClairvoyance: (targetRoomId: string) => void;
  onUseSpyglass?: (targetRoomId: string) => void;
  onOpenCurrentRoom?: () => void;
  onDescendFloor?: () => void;
}

export const DungeonMap: React.FC<DungeonMapProps> = ({
  floor,
  currentRoomId,
  hero,
  activeMapAction,
  onClearMapAction,
  onSelectAdjacentRoom,
  onSmashWall,
  onPhaseThroughWall,
  onUseTorch,
  onUseClairvoyance,
  onUseSpyglass,
  onOpenCurrentRoom,
  onDescendFloor,
}) => {
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [localMapAction, setLocalMapAction] = useState<
    'TORCH' | 'CLAIRVOYANCE' | 'SPYGLASS' | 'SMASH_WALL' | 'PHASE_WALL' | null
  >(null);
  const [showChamberMix, setShowChamberMix] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Synchronize incoming activeMapAction
  useEffect(() => {
    if (activeMapAction) {
      setLocalMapAction(activeMapAction);
    }
  }, [activeMapAction]);

  // Clear temporary alert message after 4 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  const currentMode = activeMapAction || localMapAction;

  const handleClearMode = () => {
    setLocalMapAction(null);
    if (onClearMapAction) onClearMapAction();
    setAlertMessage(null);
  };

  const currentRoom = floor.rooms[currentRoomId] || floor.rooms[floor.startRoomId];
  const allRooms: DungeonRoom[] = Object.values(floor.rooms);

  // Calculate chamber mix stats for this floor
  const totalRooms = allRooms.length;
  const revealedCount = allRooms.filter((r) => r.isRevealed).length;
  const exploredCount = allRooms.filter((r) => r.isExplored).length;
  const hiddenCount = totalRooms - revealedCount;

  const monsters = allRooms.filter((r) => r.type === 'MONSTER' && !r.isBossRoom);
  const bossRoom = allRooms.find((r) => r.isBossRoom);
  const treasures = allRooms.filter((r) => r.type === 'TREASURE');
  const traps = allRooms.filter((r) => r.type === 'TRAP');
  const shrines = allRooms.filter((r) => r.type === 'SHRINE');
  const campfires = allRooms.filter((r) => r.type === 'CAMPFIRE');
  const merchants = allRooms.filter((r) => r.type === 'MERCHANT');
  const secrets = allRooms.filter((r) => r.type === 'SECRET');

  // Check inventory for special wall tools
  const hasBreachingTool = hero.inventory.find(
    (i) => i.item.specialEffect === 'SMASH_WALL' && (i.chargesLeft ?? i.item.charges ?? 1) > 0
  );
  const hasPhasingPotion = hero.inventory.find((i) => i.item.id === 'potion_of_phasing' && i.quantity > 0);
  const isWearingEtherealRing = hero.equipment.ring?.id === 'ethereal_ring';
  const hasClairvoyanceScroll = hero.inventory.find(
    (i) => i.item.id === 'scroll_of_clairvoyance' && i.quantity > 0
  );
  const hasSpyglass = hero.inventory.find((i) => i.item.id === 'brass_spyglass');

  // Build 4x4 matrix
  const gridMatrix: (DungeonRoom | null)[][] = [];
  for (let y = 0; y < 4; y++) {
    const row: (DungeonRoom | null)[] = [];
    for (let x = 0; x < 4; x++) {
      const match = allRooms.find((r) => r.gridX === x && r.gridY === y) || null;
      row.push(match);
    }
    gridMatrix.push(row);
  }

  // Get Room Type Icon
  const getRoomIcon = (type: RoomType, isCleared: boolean, isBoss: boolean = false) => {
    if (isBoss) {
      return <Crown className="w-4 h-4 text-amber-300 animate-pulse" />;
    }
    switch (type) {
      case 'MONSTER':
        return <Skull className={`w-3.5 h-3.5 ${isCleared ? 'text-stone-500' : 'text-red-400'}`} />;
      case 'BOSS_ROOM':
        return <Crown className="w-4 h-4 text-amber-300 animate-pulse" />;
      case 'TREASURE':
        return <Package className={`w-3.5 h-3.5 ${isCleared ? 'text-stone-500' : 'text-amber-400'}`} />;
      case 'MERCHANT':
        return <Store className="w-3.5 h-3.5 text-emerald-400" />;
      case 'CAMPFIRE':
        return <Tent className="w-3.5 h-3.5 text-amber-500" />;
      case 'SHRINE':
        return <Sun className="w-3.5 h-3.5 text-cyan-400" />;
      case 'TRAP':
        return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />;
      case 'SECRET':
        return <HelpCircle className="w-3.5 h-3.5 text-purple-400" />;
      case 'STAIRS':
        return <Footprints className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getRoomTypeLabel = (room: DungeonRoom) => {
    if (room.isBossRoom) return 'Boss & Stairs';
    return room.type.replace('_', ' ');
  };

  // Find wall between two rooms
  const findWallBetween = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    return (floor.walls || []).find(
      (w) =>
        (w.roomA.x === a.x && w.roomA.y === a.y && w.roomB.x === b.x && w.roomB.y === b.y) ||
        (w.roomA.x === b.x && w.roomA.y === b.y && w.roomB.x === a.x && w.roomB.y === a.y)
    );
  };

  const isCurrentRoomBlockedByMonster = Boolean(currentRoom?.monster && currentRoom.monster.hp > 0);
  const isCurrentRoomBlockedByTrap = Boolean(
    currentRoom?.trap && !currentRoom.trap.disarmed && !currentRoom.trap.triggered
  );
  const isCurrentRoomMovementBlocked = isCurrentRoomBlockedByMonster || isCurrentRoomBlockedByTrap;

  // Handle tile interactions
  const handleTileClick = (targetRoom: DungeonRoom) => {
    if (!currentRoom) return;

    // 1. CLAIRVOYANCE MODE (can reveal ANY room card on the 4x4 board, ignoring walls)
    if (currentMode === 'CLAIRVOYANCE') {
      if (!targetRoom.isRevealed) {
        sounds.playSpell();
        onUseClairvoyance(targetRoom.id);
        handleClearMode();
        setSelectedCellId(targetRoom.id);
      } else {
        setSelectedCellId(targetRoom.id);
        handleClearMode();
      }
      return;
    }

    // 2. TORCH MODE (can only illuminate an adjacent room NOT BLOCKED by solid unbroken wall)
    if (currentMode === 'TORCH') {
      const isAdjacent = areCoordinatesAdjacent(
        { x: currentRoom.gridX, y: currentRoom.gridY },
        { x: targetRoom.gridX, y: targetRoom.gridY }
      );

      if (!isAdjacent) {
        sounds.playBlock();
        setAlertMessage('A Pitch Torch can only illuminate an adjacent room.');
        return;
      }

      // Check wall between current room and target room
      const wall = findWallBetween(
        { x: currentRoom.gridX, y: currentRoom.gridY },
        { x: targetRoom.gridX, y: targetRoom.gridY }
      );
      const isWallBlocked = wall && !wall.isBroken;

      if (isWallBlocked) {
        sounds.playBlock();
        setAlertMessage('Solid Stone Wall blocks the torchlight! You cannot peek through solid stone walls. Break the wall or cast Clairvoyance.');
        return;
      }

      if (!targetRoom.isRevealed) {
        sounds.playDiceRoll();
        onUseTorch(targetRoom.id);
        handleClearMode();
        setSelectedCellId(targetRoom.id);
      } else {
        setSelectedCellId(targetRoom.id);
        handleClearMode();
      }
      return;
    }

    // 3. SPYGLASS MODE (peeks adjacent unobstructed room without consuming torch)
    if (currentMode === 'SPYGLASS') {
      const isAdjacent = areCoordinatesAdjacent(
        { x: currentRoom.gridX, y: currentRoom.gridY },
        { x: targetRoom.gridX, y: targetRoom.gridY }
      );

      if (!isAdjacent) {
        sounds.playBlock();
        setAlertMessage("The Burglar's Spyglass can only scout adjacent rooms.");
        return;
      }

      const wall = findWallBetween(
        { x: currentRoom.gridX, y: currentRoom.gridY },
        { x: targetRoom.gridX, y: targetRoom.gridY }
      );
      const isWallBlocked = wall && !wall.isBroken;

      if (isWallBlocked) {
        sounds.playBlock();
        setAlertMessage('Solid Stone Wall blocks line of sight! The spyglass cannot see through stone walls.');
        return;
      }

      if (!targetRoom.isRevealed) {
        sounds.playDiceRoll();
        if (onUseSpyglass) onUseSpyglass(targetRoom.id);
        else onUseTorch(targetRoom.id);
        handleClearMode();
        setSelectedCellId(targetRoom.id);
      } else {
        setSelectedCellId(targetRoom.id);
        handleClearMode();
      }
      return;
    }

    // 4. PHASE WALL MODE
    if (currentMode === 'PHASE_WALL') {
      const isAdjacent = areCoordinatesAdjacent(
        { x: currentRoom.gridX, y: currentRoom.gridY },
        { x: targetRoom.gridX, y: targetRoom.gridY }
      );

      if (!isAdjacent) {
        sounds.playBlock();
        setAlertMessage('Phasing only allows slipping through into an adjacent chamber.');
        return;
      }

      sounds.playSpell();
      onPhaseThroughWall(targetRoom.id, hasPhasingPotion?.item);
      handleClearMode();
      return;
    }

    // 5. SMASH WALL MODE (clicking cell adjacent with wall)
    if (currentMode === 'SMASH_WALL') {
      const isAdjacent = areCoordinatesAdjacent(
        { x: currentRoom.gridX, y: currentRoom.gridY },
        { x: targetRoom.gridX, y: targetRoom.gridY }
      );

      if (isAdjacent && hasBreachingTool) {
        const wall = findWallBetween(
          { x: currentRoom.gridX, y: currentRoom.gridY },
          { x: targetRoom.gridX, y: targetRoom.gridY }
        );
        if (wall && !wall.isBroken) {
          sounds.playHit();
          onSmashWall(wall.id, hasBreachingTool.item);
          handleClearMode();
          setSelectedCellId(targetRoom.id);
          return;
        }
      }
    }

    // Standard Tile Selection & Navigation
    if (targetRoom.id === currentRoomId) {
      setSelectedCellId(targetRoom.id);
      if (onOpenCurrentRoom && targetRoom.type !== 'CAMPFIRE') {
        onOpenCurrentRoom();
      }
      return;
    }

    const isAdjacent = areCoordinatesAdjacent(
      { x: currentRoom.gridX, y: currentRoom.gridY },
      { x: targetRoom.gridX, y: targetRoom.gridY }
    );

    if (isAdjacent) {
      if (isCurrentRoomMovementBlocked) {
        if (isCurrentRoomBlockedByTrap) sounds.playTrap();
        else sounds.playBlock();
        setSelectedCellId(targetRoom.id);
        return;
      }

      const wall = findWallBetween(
        { x: currentRoom.gridX, y: currentRoom.gridY },
        { x: targetRoom.gridX, y: targetRoom.gridY }
      );

      const isWallBlocked = wall && !wall.isBroken;

      if (!isWallBlocked) {
        sounds.playBlock();
        onSelectAdjacentRoom(targetRoom.id);
      } else {
        sounds.playBlock();
        setSelectedCellId(targetRoom.id);
      }
    } else {
      setSelectedCellId(targetRoom.id);
    }
  };

  // Selected cell data for action drawer
  const selectedRoom = selectedCellId ? floor.rooms[selectedCellId] : null;
  const isSelectedAdjacent =
    selectedRoom && currentRoom
      ? areCoordinatesAdjacent(
          { x: currentRoom.gridX, y: currentRoom.gridY },
          { x: selectedRoom.gridX, y: selectedRoom.gridY }
        )
      : false;

  const wallToSelected =
    isSelectedAdjacent && selectedRoom && currentRoom
      ? findWallBetween(
          { x: currentRoom.gridX, y: currentRoom.gridY },
          { x: selectedRoom.gridX, y: selectedRoom.gridY }
        )
      : null;

  return (
    <div
      id="dungeon-map-container"
      className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3.5 text-stone-200 shadow-2xl relative"
    >
      {/* Quick Scout Tools & Actions (Special inventory tools) */}
      {(hasClairvoyanceScroll || hasSpyglass || hasBreachingTool || isWearingEtherealRing || hasPhasingPotion) && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 pb-2 mb-2 border-b border-[#4d3723]">
          {/* Clairvoyance Scroll Button */}
          {hasClairvoyanceScroll && (
            <button
              id="btn-clairvoyance-mode"
              onClick={() => {
                if (currentMode === 'CLAIRVOYANCE') {
                  handleClearMode();
                } else {
                  setLocalMapAction('CLAIRVOYANCE');
                  setAlertMessage(null);
                }
              }}
              className={`px-2 py-1 rounded text-[11px] font-serif flex items-center gap-1 transition-all cursor-pointer shadow-sm border ${
                currentMode === 'CLAIRVOYANCE'
                  ? 'bg-purple-900 border-purple-300 text-purple-100 ring-2 ring-purple-400 animate-pulse font-bold'
                  : 'bg-[#3b2347] hover:bg-[#4f2f5e] border-[#78468f] text-purple-200'
              }`}
              title="Cast Clairvoyance to reveal any card on the 4x4 board"
            >
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              <span>{currentMode === 'CLAIRVOYANCE' ? 'Clairvoyance ✕' : 'Clairvoyance'}</span>
            </button>
          )}

          {/* Spyglass Button */}
          {hasSpyglass && (
            <button
              id="btn-spyglass-mode"
              onClick={() => {
                if (currentMode === 'SPYGLASS') {
                  handleClearMode();
                } else {
                  setLocalMapAction('SPYGLASS');
                  setAlertMessage(null);
                }
              }}
              className={`px-2 py-1 rounded text-[11px] font-serif flex items-center gap-1 transition-all cursor-pointer shadow-sm border ${
                currentMode === 'SPYGLASS'
                  ? 'bg-amber-900 border-amber-400 text-amber-100 ring-2 ring-amber-400 animate-pulse font-bold'
                  : 'bg-[#382b19] hover:bg-[#4d3a22] border-[#73532c] text-amber-200'
              }`}
              title="Scout an adjacent unobstructed room with your brass spyglass"
            >
              <Compass className="w-3.5 h-3.5 text-amber-300" />
              <span>{currentMode === 'SPYGLASS' ? 'Spyglass ✕' : 'Spyglass'}</span>
            </button>
          )}

          {/* Wall Breaching Tool Button */}
          {hasBreachingTool && (
            <button
              id="btn-breach-mode"
              onClick={() => {
                if (currentMode === 'SMASH_WALL') {
                  handleClearMode();
                } else {
                  setLocalMapAction('SMASH_WALL');
                  setAlertMessage(null);
                }
              }}
              className={`px-2 py-1 rounded text-[11px] font-serif flex items-center gap-1 transition-all cursor-pointer shadow-sm border ${
                currentMode === 'SMASH_WALL'
                  ? 'bg-red-950 border-red-400 text-red-100 ring-2 ring-red-500 animate-pulse font-bold'
                  : 'bg-[#401d18] hover:bg-[#572720] border-[#8a3c31] text-red-200'
              }`}
              title="Smash adjacent solid stone wall into an archway"
            >
              <Hammer className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentMode === 'SMASH_WALL' ? 'Smash Wall ✕' : 'Smash Wall'}</span>
            </button>
          )}

          {/* Phasing Button */}
          {(isWearingEtherealRing || hasPhasingPotion) && (
            <button
              id="btn-phasing-mode"
              onClick={() => {
                if (currentMode === 'PHASE_WALL') {
                  handleClearMode();
                } else {
                  setLocalMapAction('PHASE_WALL');
                  setAlertMessage(null);
                }
              }}
              className={`px-2 py-1 rounded text-[11px] font-serif flex items-center gap-1 transition-all cursor-pointer shadow-sm border ${
                currentMode === 'PHASE_WALL'
                  ? 'bg-indigo-950 border-indigo-400 text-indigo-100 ring-2 ring-indigo-400 animate-pulse font-bold'
                  : 'bg-[#291b3d] hover:bg-[#3b2757] border-[#654394] text-indigo-200'
              }`}
              title="Slip through a solid stone wall into an adjacent room"
            >
              <Ghost className="w-3.5 h-3.5 text-indigo-300" />
              <span>{currentMode === 'PHASE_WALL' ? 'Phase ✕' : 'Phase Wall'}</span>
            </button>
          )}
        </div>
      )}

      {/* Alert Warning Toast if Wall Blocks Action */}
      {alertMessage && (
        <div className="mb-2.5 p-2.5 bg-red-950/95 border-2 border-red-500 rounded-lg text-center text-xs font-serif text-red-200 animate-shake flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2 text-left">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>{alertMessage}</span>
          </div>
          <button
            onClick={() => setAlertMessage(null)}
            className="text-stone-400 hover:text-stone-100 text-xs px-1.5 py-0.5 rounded bg-[#331111] border border-red-700 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Targeting Mode Notification Banners */}
      {currentMode === 'TORCH' && (
        <div className="mb-2.5 p-2.5 bg-gradient-to-r from-orange-950/90 via-[#3d1e0a] to-orange-950/90 border-2 border-orange-500 rounded-lg text-xs font-serif text-orange-200 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400 animate-bounce shrink-0" />
            <span>
              <strong>Pitch Torch Lit:</strong> Click any pulsing orange adjacent room to reveal it. (Solid stone walls block torchlight!)
            </span>
          </div>
          <button
            id="btn-cancel-torch-mode"
            onClick={handleClearMode}
            className="px-2 py-0.5 bg-orange-900 hover:bg-orange-800 text-orange-100 rounded border border-orange-400 text-[11px] font-bold cursor-pointer shrink-0"
          >
            Cancel [✕]
          </button>
        </div>
      )}

      {currentMode === 'CLAIRVOYANCE' && (
        <div className="mb-2.5 p-2.5 bg-gradient-to-r from-purple-950/90 via-[#311742] to-purple-950/90 border-2 border-purple-400 rounded-lg text-xs font-serif text-purple-200 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-300 animate-pulse shrink-0" />
            <span>
              <strong>Arcane Clairvoyance Active:</strong> Click ANY room card on the 4x4 grid (pulsing violet) to reveal it through arcane sight! (Spans through walls)
            </span>
          </div>
          <button
            id="btn-cancel-clairvoyance-mode"
            onClick={handleClearMode}
            className="px-2 py-0.5 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded border border-purple-300 text-[11px] font-bold cursor-pointer shrink-0"
          >
            Cancel [✕]
          </button>
        </div>
      )}

      {currentMode === 'SPYGLASS' && (
        <div className="mb-2.5 p-2.5 bg-gradient-to-r from-amber-950/90 via-[#3b2b13] to-amber-950/90 border-2 border-amber-400 rounded-lg text-xs font-serif text-amber-200 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-300 animate-spin shrink-0" />
            <span>
              <strong>Burglar's Spyglass Active:</strong> Click an unobstructed adjacent room (pulsing amber) to scout it without spending a torch.
            </span>
          </div>
          <button
            id="btn-cancel-spyglass-mode"
            onClick={handleClearMode}
            className="px-2 py-0.5 bg-amber-900 hover:bg-amber-800 text-amber-100 rounded border border-amber-300 text-[11px] font-bold cursor-pointer shrink-0"
          >
            Cancel [✕]
          </button>
        </div>
      )}

      {currentMode === 'SMASH_WALL' && (
        <div className="mb-2.5 p-2.5 bg-gradient-to-r from-red-950/90 via-[#3b1712] to-red-950/90 border-2 border-red-500 rounded-lg text-xs font-serif text-red-200 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <Hammer className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
            <span>
              <strong>Breaching Tool Ready:</strong> Click an adjacent solid wall or room separated by stone to smash it into an archway!
            </span>
          </div>
          <button
            id="btn-cancel-smash-mode"
            onClick={handleClearMode}
            className="px-2 py-0.5 bg-red-900 hover:bg-red-800 text-red-100 rounded border border-red-400 text-[11px] font-bold cursor-pointer shrink-0"
          >
            Cancel [✕]
          </button>
        </div>
      )}

      {currentMode === 'PHASE_WALL' && (
        <div className="mb-2.5 p-2.5 bg-gradient-to-r from-indigo-950/90 via-[#26173d] to-indigo-950/90 border-2 border-indigo-400 rounded-lg text-xs font-serif text-indigo-200 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <Ghost className="w-4 h-4 text-indigo-300 animate-pulse shrink-0" />
            <span>
              <strong>Phasing Active:</strong> Click an adjacent room across a solid stone wall to slip right through the stone!
            </span>
          </div>
          <button
            id="btn-cancel-phase-mode"
            onClick={handleClearMode}
            className="px-2 py-0.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-100 rounded border border-indigo-300 text-[11px] font-bold cursor-pointer shrink-0"
          >
            Cancel [✕]
          </button>
        </div>
      )}

      {/* 4x4 Burgle Bros Board with Interactive Tiles & Walls */}
      <div className="bg-[#170f09] p-3 rounded-lg border-2 border-[#422c19] relative overflow-hidden bg-[radial-gradient(#382414_1px,transparent_1px)] [background-size:14px_14px] flex justify-center">
        {/* Grid Container - Tightly Clustered and Centered */}
        <div className="inline-flex flex-col gap-1 sm:gap-1.5 mx-auto max-w-full overflow-x-auto py-1">
          {gridMatrix.map((row, rIdx) => (
            <div key={`row-${rIdx}`} className="flex flex-col gap-1 sm:gap-1.5">
              {/* Horizontal Wall Row Above (between rIdx-1 and rIdx) */}
              {rIdx > 0 && (
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 h-1.5 relative">
                  {row.map((cell, cIdx) => {
                    const aboveCell = gridMatrix[rIdx - 1][cIdx];
                    const hWall =
                      cell && aboveCell
                        ? findWallBetween(
                            { x: cell.gridX, y: cell.gridY },
                            { x: aboveCell.gridX, y: aboveCell.gridY }
                          )
                        : null;

                    const isWallTargetInSmash =
                      currentMode === 'SMASH_WALL' &&
                      hWall &&
                      !hWall.isBroken &&
                      currentRoom &&
                      ((cell.id === currentRoom.id && aboveCell.id) ||
                        (aboveCell.id === currentRoom.id && cell.id));

                    return (
                      <React.Fragment key={`hwall-${rIdx}-${cIdx}`}>
                        <div
                          onClick={() => {
                            if (hWall && !hWall.isBroken && hasBreachingTool) {
                              sounds.playHit();
                              onSmashWall(hWall.id, hasBreachingTool.item);
                              handleClearMode();
                            }
                          }}
                          className={`w-14 sm:w-16 flex items-center justify-center shrink-0 ${
                            hWall && !hWall.isBroken && hasBreachingTool ? 'cursor-pointer' : ''
                          }`}
                        >
                          {hWall ? (
                            hWall.isBroken ? (
                              <div
                                className="w-full h-1 bg-amber-800/40 border-t border-b border-dashed border-amber-500/60 rounded"
                                title="Broken Wall (Passable Archway)"
                              />
                            ) : (
                              <div
                                className={`w-full h-2 bg-gradient-to-r from-[#8a5d3b] via-[#b58156] to-[#8a5d3b] border-y border-[#ffd29d] rounded-sm shadow-md ring-1 ring-[#3b2413] transition-all ${
                                  isWallTargetInSmash
                                    ? 'ring-2 ring-red-400 bg-red-800 animate-pulse scale-110'
                                    : ''
                                }`}
                                title="Solid Stone Wall (Blocks Movement & Torchlight)"
                              />
                            )
                          ) : (
                            <div className="w-full h-1 border-t border-stone-800/40" />
                          )}
                        </div>
                        {cIdx < 3 && <div className="w-2 shrink-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Room Cards Row with Vertical Walls Between */}
              <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                {row.map((room, cIdx) => {
                  if (!room) return <div key={cIdx} className="w-14 h-14 sm:w-16 sm:h-16 opacity-0 shrink-0" />;

                  const isCurrent = room.id === currentRoomId;
                  const isRevealed = room.isRevealed;
                  const isExplored = room.isExplored;
                  const isBossCandidate = isBossCandidatePosition(room.gridX, room.gridY);
                  const isRoomPassed = isRoomPassedThrough(room);
                  const roomInfo = getRoomDisplayInfo(room);

                  const isAdjacent =
                    currentRoom &&
                    areCoordinatesAdjacent(
                      { x: currentRoom.gridX, y: currentRoom.gridY },
                      { x: room.gridX, y: room.gridY }
                    );

                  const wall =
                    isAdjacent && currentRoom
                      ? findWallBetween(
                          { x: currentRoom.gridX, y: currentRoom.gridY },
                          { x: room.gridX, y: room.gridY }
                        )
                      : null;

                  const isBlockedByWall = wall && !wall.isBroken;
                  const isSelected = selectedCellId === room.id;

                  // Target mode highlight indicators
                  const isTorchTargetCandidate =
                    currentMode === 'TORCH' && isAdjacent && !isRevealed && !isBlockedByWall;
                  const isTorchBlockedCandidate =
                    currentMode === 'TORCH' && isAdjacent && !isRevealed && isBlockedByWall;
                  const isClairvoyanceTargetCandidate =
                    currentMode === 'CLAIRVOYANCE' && !isRevealed;
                  const isSpyglassTargetCandidate =
                    currentMode === 'SPYGLASS' && isAdjacent && !isRevealed && !isBlockedByWall;
                  const isPhaseTargetCandidate =
                    currentMode === 'PHASE_WALL' && isAdjacent && isBlockedByWall;

                  // Vertical wall to the right of this cell
                  const rightCell = row[cIdx + 1];
                  const vWall =
                    rightCell &&
                    findWallBetween(
                      { x: room.gridX, y: room.gridY },
                      { x: rightCell.gridX, y: rightCell.gridY }
                    );

                  const isVWallTargetInSmash =
                    currentMode === 'SMASH_WALL' &&
                    vWall &&
                    !vWall.isBroken &&
                    currentRoom &&
                    ((room.id === currentRoom.id && rightCell.id) ||
                      (rightCell.id === currentRoom.id && room.id));

                  return (
                    <React.Fragment key={room.id}>
                      {/* Room Card Tile */}
                      <button
                        id={`map-card-tile-${room.id}`}
                        onClick={() => handleTileClick(room)}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 text-xs font-serif flex flex-col items-center justify-between p-1 relative transition-all duration-200 cursor-pointer shadow-md shrink-0 ${
                          isTorchTargetCandidate
                            ? 'bg-[#3d2411] border-orange-400 ring-2 ring-orange-400 animate-pulse text-orange-200 scale-105 z-20 shadow-orange-900/60'
                            : isClairvoyanceTargetCandidate
                            ? 'bg-[#2d1742] border-purple-400 ring-2 ring-purple-400 animate-pulse text-purple-200 scale-105 z-20 shadow-purple-900/60'
                            : isSpyglassTargetCandidate
                            ? 'bg-[#3b2b13] border-amber-400 ring-2 ring-amber-400 animate-pulse text-amber-200 scale-105 z-20 shadow-amber-900/60'
                            : isPhaseTargetCandidate
                            ? 'bg-[#29183d] border-indigo-400 ring-2 ring-indigo-400 animate-pulse text-indigo-200 scale-105 z-20'
                            : isCurrent
                            ? 'bg-[#523315] border-[#fae498] ring-2 ring-amber-400 text-amber-100 shadow-amber-950/80 scale-105 z-20'
                            : isSelected
                            ? 'bg-[#3b2818] border-amber-400 ring-1 ring-amber-300 text-amber-200'
                            : isRevealed
                            ? room.isBossRoom
                              ? 'bg-[#361d18] border-red-500/80 text-amber-100 hover:border-red-400'
                              : isRoomPassed
                              ? 'bg-[#1b1712] border-[#4a3a2a] text-stone-300 hover:border-stone-400'
                              : 'bg-[#291c13] border-[#5e432b] text-stone-200 hover:border-amber-600'
                            : isAdjacent
                            ? isBossCandidate
                              ? 'bg-[#2b170c] border-[#9e5b29] border-dashed text-amber-300 hover:bg-[#381f10] hover:border-amber-400 bg-[radial-gradient(#9a3412_1px,transparent_1px)] [background-size:6px_6px]'
                              : 'bg-[#21150c] border-[#7d5329] border-dashed text-amber-300 hover:bg-[#332012] hover:border-amber-400'
                            : isBossCandidate
                            ? 'bg-[#20130a] border-[#6b3a16] text-amber-500/80 hover:border-amber-600 bg-[radial-gradient(#7c2d12_1px,transparent_1px)] [background-size:6px_6px]'
                            : 'bg-[#150e08] border-[#382516] text-stone-600 hover:border-stone-500'
                        }`}
                      >
                        {/* Pawn / Hero Marker */}
                        {isCurrent && (
                          <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-amber-400 border border-black rounded-full flex items-center justify-center text-[9px] font-black text-black shadow-md z-30 animate-bounce">
                            ★
                          </div>
                        )}

                        {/* Top Coordinate and Status Pin */}
                        <div className="w-full flex items-center justify-between text-[9px] font-mono leading-none">
                          <span className={`font-bold flex items-center gap-0.5 ${isBossCandidate && !isRevealed ? 'text-amber-400' : 'text-stone-400'}`}>
                            {room.gridX + 1},{room.gridY + 1}
                            {isBossCandidate && !isRevealed && (
                              <span className="text-amber-500 font-sans text-[8px]" title="Boss/Stairs Candidate Spot">★</span>
                            )}
                          </span>

                          {room.isBossRoom && isRevealed && (
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                          )}
                          {!isRevealed && isAdjacent && !isBlockedByWall && (
                            <span className="text-amber-400 text-[8px] font-serif">Open</span>
                          )}
                          {!isRevealed && isAdjacent && isBlockedByWall && (
                            <span className="text-stone-500 text-[8px] font-serif">Wall</span>
                          )}
                          {isRevealed && isRoomPassed && (
                            <span className="text-emerald-400 text-[8px] font-mono">✓</span>
                          )}
                        </div>

                        {/* Card Center Content */}
                        <div className="my-auto flex flex-col items-center justify-center">
                          {isRevealed ? (
                            <>
                              <div className="mb-0.5">{getRoomIcon(room.type, isRoomPassed, room.isBossRoom)}</div>
                              <span className="text-[9px] font-serif font-bold text-center leading-tight truncate max-w-[54px]">
                                {room.isBossRoom
                                  ? (isRoomPassed ? 'Stairs' : 'Boss')
                                  : room.type === 'CAMPFIRE'
                                  ? 'Hearth'
                                  : room.type.toLowerCase()}
                              </span>
                            </>
                          ) : isTorchTargetCandidate ? (
                            <div className="flex flex-col items-center justify-center text-orange-400 animate-bounce">
                              <Flame className="w-4 h-4" />
                              <span className="text-[7.5px] font-bold uppercase mt-0.5">Torch</span>
                            </div>
                          ) : isTorchBlockedCandidate ? (
                            <div className="flex flex-col items-center justify-center opacity-60 text-stone-500">
                              <ShieldAlert className="w-4 h-4 text-red-500/70" />
                              <span className="text-[6.5px] font-bold text-red-400/80">Wall</span>
                            </div>
                          ) : isClairvoyanceTargetCandidate ? (
                            <div className="flex flex-col items-center justify-center text-purple-300 animate-pulse">
                              <Eye className="w-4 h-4" />
                              <span className="text-[7.5px] font-bold uppercase mt-0.5">Scout</span>
                            </div>
                          ) : isSpyglassTargetCandidate ? (
                            <div className="flex flex-col items-center justify-center text-amber-300 animate-pulse">
                              <Compass className="w-4 h-4" />
                              <span className="text-[7.5px] font-bold uppercase mt-0.5">Scout</span>
                            </div>
                          ) : isBossCandidate ? (
                            /* Unrevealed Boss / Stairs Candidate Card Back */
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-5 h-5 rounded border border-amber-600/70 bg-[#2c170a] flex items-center justify-center text-amber-300 font-serif font-bold text-[10px] shadow-sm">
                                ?
                              </div>
                              <div className="text-[6.5px] font-mono font-bold text-amber-400 flex items-center gap-0.5 mt-0.5 leading-none">
                                <Crown className="w-2 h-2 text-amber-400" />
                                <span>Stairs?</span>
                              </div>
                            </div>
                          ) : (
                            /* Standard Unrevealed Card Back (Burgle Bros Face-Down Tile) */
                            <div className="flex flex-col items-center justify-center opacity-80">
                              <div className="w-5 h-5 rounded border border-[#543b22] bg-[#1a1109] flex items-center justify-center text-amber-600 font-serif font-bold text-[10px]">
                                ?
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Bottom Tag */}
                        <div className="w-full text-center text-[8px] font-mono text-stone-400 leading-none">
                          {isRevealed ? (
                            isRoomPassed ? (
                              <span className="text-emerald-400/80">Cleared</span>
                            ) : room.isExplored ? (
                              <span className="text-stone-500">Seen</span>
                            ) : (
                              <span className="text-cyan-300">Scouted</span>
                            )
                          ) : isBossCandidate ? (
                            <span className="text-amber-500/90 font-serif">Candidate</span>
                          ) : (
                            <span className="text-stone-600">Hidden</span>
                          )}
                        </div>
                      </button>

                      {/* Vertical Wall Between Columns */}
                      {cIdx < 3 && (
                        <div
                          onClick={() => {
                            if (vWall && !vWall.isBroken && hasBreachingTool) {
                              sounds.playHit();
                              onSmashWall(vWall.id, hasBreachingTool.item);
                              handleClearMode();
                            }
                          }}
                          className={`w-2 flex items-center justify-center relative shrink-0 ${
                            vWall && !vWall.isBroken && hasBreachingTool ? 'cursor-pointer' : ''
                          }`}
                        >
                          {vWall ? (
                            vWall.isBroken ? (
                              <div
                                className="w-1.5 h-10 sm:h-12 bg-amber-800/40 border-l border-r border-dashed border-amber-500/60 rounded"
                                title="Broken Wall (Passable Archway)"
                              />
                            ) : (
                              <div
                                className={`w-2 h-12 sm:h-14 bg-gradient-to-b from-[#8a5d3b] via-[#b58156] to-[#8a5d3b] border-x border-[#ffd29d] rounded-sm shadow-md ring-1 ring-[#3b2413] transition-all ${
                                  isVWallTargetInSmash
                                    ? 'ring-2 ring-red-400 bg-red-800 animate-pulse scale-110'
                                    : ''
                                }`}
                                title="Solid Stone Wall (Blocks Movement & Torchlight)"
                              />
                            )
                          ) : (
                            <div className="w-0.5 h-10 sm:h-12 border-l border-stone-800/40" />
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chamber Mix Action & Breakdown Directly Underneath 4x4 Grid Map */}
      <div className="mt-2.5">
        <button
          id="btn-floor-chamber-mix-info"
          onClick={() => setShowChamberMix(!showChamberMix)}
          className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-[#2a1a10] via-[#352214] to-[#2a1a10] hover:from-[#3a2517] hover:via-[#472f1c] hover:to-[#3a2517] text-amber-300 hover:text-amber-200 border border-[#6b4724] transition-all flex items-center justify-between gap-2 cursor-pointer font-serif text-xs font-bold shadow-md active:scale-[0.99]"
          title="View Chamber Distribution & Deck Mix for Floor"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Floor {floor.floorNumber} Chamber Mix</span>
            <span className="text-[10px] font-mono text-stone-400 font-normal">
              (16 Cards: {revealedCount} Revealed, {hiddenCount} Hidden)
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-400 bg-[#1a100a] px-2 py-0.5 rounded border border-[#523821]">
            {showChamberMix ? '▲ Hide Breakdown' : '▼ View Breakdown'}
          </span>
        </button>

        {/* Chamber Mix Info Breakdown Panel */}
        {showChamberMix && (
          <div className="mt-2 p-3 bg-[#19110a] border-2 border-amber-600/70 rounded-lg text-stone-200 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#4d3622] pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="font-serif font-bold text-xs text-amber-200 uppercase tracking-wider">
                  Floor {floor.floorNumber} Deck Composition (16 Total Tiles)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-amber-400">
                1 Hearth • 1 Boss • 14 Dungeon Encounters
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-serif">
              <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                <div className="flex items-center gap-1.5 text-red-300 font-bold mb-1">
                  <Skull className="w-3.5 h-3.5 text-red-400" />
                  <span>Monsters ({monsters.length})</span>
                </div>
                <p className="text-[10px] text-stone-400">
                  {monsters.filter((m) => m.isCleared).length} Cleared •{' '}
                  {monsters.filter((m) => m.isRevealed && !m.isCleared).length} Active
                </p>
              </div>

              <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Boss & Stairs (1)</span>
                </div>
                <p className="text-[10px] text-stone-400">
                  {bossRoom?.isRevealed ? (bossRoom.isCleared ? 'Defeated' : 'Located') : 'In 1 of 8 Candidate Spots'}
                </p>
              </div>

              <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                <div className="flex items-center gap-1.5 text-yellow-300 font-bold mb-1">
                  <Package className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Vaults ({treasures.length})</span>
                </div>
                <p className="text-[10px] text-stone-400">
                  {treasures.filter((t) => t.isCleared).length} Looted •{' '}
                  {treasures.filter((t) => !t.isCleared).length} Unopened
                </p>
              </div>

              <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                <div className="flex items-center gap-1.5 text-orange-300 font-bold mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Traps ({traps.length})</span>
                </div>
                <p className="text-[10px] text-stone-400">
                  {traps.filter((t) => t.trap?.disarmed || t.trap?.triggered).length} Neutralized
                </p>
              </div>

              <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold mb-1">
                  <Sun className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Shrines ({shrines.length})</span>
                </div>
                <p className="text-[10px] text-stone-400">Stat Blessings & Boons</p>
              </div>

              {campfires.length > 0 && (
                <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1">
                    <Tent className="w-3.5 h-3.5 text-amber-500" />
                    <span>Hearth ({campfires.length})</span>
                  </div>
                  <p className="text-[10px] text-stone-400">Floor Sanctuary</p>
                </div>
              )}

              <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold mb-1">
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Shop ({merchants.length})</span>
                </div>
                <p className="text-[10px] text-stone-400">Merchant Goods [1,1]</p>
              </div>

              <div className="bg-[#24170e] p-2 rounded border border-[#442b1a]">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                  <span>Secrets ({secrets.length})</span>
                </div>
                <p className="text-[10px] text-stone-400">Hidden Relic Chamber</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Tile Inspector / Actions Panel */}
      {selectedRoom && (() => {
        const selectedInfo = getRoomDisplayInfo(selectedRoom);
        const isSelectedPassed = isRoomPassedThrough(selectedRoom);
        const isSelectedBossCandidate = isBossCandidatePosition(selectedRoom.gridX, selectedRoom.gridY);

        return (
          <div className="mt-3 p-3 bg-[#1c140c] border border-[#5e4228] rounded-lg shadow-inner text-xs font-serif animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#3d2a19] pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-300 font-bold bg-[#120c07] px-1.5 py-0.5 rounded border border-[#442f1b]">
                  Tile [{selectedRoom.gridX + 1},{selectedRoom.gridY + 1}]
                </span>
                <span className="font-bold text-[#f5e4c6]">
                  {selectedRoom.isRevealed ? selectedInfo.title : 'Unrevealed Room Card'}
                </span>
              </div>
              <span className="text-[10px] text-stone-400 capitalize">
                {selectedRoom.isRevealed ? getRoomTypeLabel(selectedRoom) : isSelectedBossCandidate ? 'Stairs Candidate' : 'Hidden Face-Down'}
              </span>
            </div>

            {/* Candidate Spot Callout */}
            {!selectedRoom.isRevealed && isSelectedBossCandidate && (
              <div className="mb-2 p-2 bg-amber-950/40 border border-amber-600/50 rounded flex items-center gap-1.5 text-[11px] text-amber-200 font-serif">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Candidate Boss & Stairs Chamber:</strong> This deep perimeter alcove is one of 8 potential locations where the floor guardian and descent stairway could be stationed.
                </span>
              </div>
            )}

            <p className="text-[11px] text-stone-300 mb-2.5">
              {selectedRoom.isRevealed
                ? selectedInfo.description
                : 'This room card lies face down. Scout it with a Torch, Spyglass, or Clairvoyance spell, or enter directly to explore.'}
            </p>

            {/* Action Buttons for Selected Tile */}
            <div className="flex flex-wrap gap-2">
              {/* If Selected Room is Current Room */}
              {selectedRoom.id === currentRoomId && (
                selectedRoom.type === 'CAMPFIRE' ? (
                  <div className="text-[11px] text-amber-300 font-serif font-bold bg-[#26170d] px-2.5 py-1.5 rounded border border-[#5a3619] flex items-center gap-1.5">
                    <Tent className="w-3.5 h-3.5 text-amber-400" />
                    <span>Floor Sanctuary (Vitals Restored on Descent)</span>
                  </div>
                ) : selectedRoom.isBossRoom && selectedRoom.isStairsUnlocked ? (
                  <button
                    id="btn-descend-from-inspector"
                    onClick={() => {
                      if (onDescendFloor) onDescendFloor();
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-serif font-black text-xs rounded border border-amber-300 flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                  >
                    <ArrowDownCircle className="w-4 h-4 text-stone-950" />
                    <span>Descend Stairs to Floor {floor.floorNumber + 1} ➔</span>
                  </button>
                ) : selectedRoom.type === 'MERCHANT' ? (
                  <button
                    id="btn-inspect-selected-current-room"
                    onClick={() => {
                      if (onOpenCurrentRoom) onOpenCurrentRoom();
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-emerald-100 font-serif font-bold text-xs rounded border border-emerald-500 flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                  >
                    <Store className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Trade with Merchant ➔</span>
                  </button>
                ) : isSelectedPassed ? (
                  <div className="text-[11px] text-emerald-400 font-serif font-bold bg-[#142214] px-2.5 py-1.5 rounded border border-emerald-700/60 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Chamber Cleared & Secure</span>
                  </div>
                ) : (
                  <button
                    id="btn-inspect-selected-current-room"
                    onClick={() => {
                      if (onOpenCurrentRoom) onOpenCurrentRoom();
                    }}
                    className="px-3 py-1.5 bg-gradient-to-b from-[#8f6333] to-[#5a3b1c] hover:from-[#a6753d] hover:to-[#6d4722] text-amber-100 font-serif font-bold text-xs rounded border border-[#dfb15b] flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Enter & Inspect Chamber (Open Pop-Up) ➔</span>
                  </button>
                )
              )}

              {/* If unrevealed & adjacent -> Torch Reveal Option (CHECKING SOLID WALL) */}
              {!selectedRoom.isRevealed && isSelectedAdjacent && (
                !wallToSelected || wallToSelected.isBroken ? (
                  hero.torches > 0 ? (
                    <button
                      id="btn-torch-selected-room"
                      onClick={() => {
                        sounds.playDiceRoll();
                        onUseTorch(selectedRoom.id);
                      }}
                      className="px-3 py-1.5 bg-[#472a14] hover:bg-[#5e381b] text-orange-200 border border-[#915828] rounded text-xs font-serif font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                      title="Use 1 Torch to reveal this adjacent room without entering"
                    >
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span>Light Torch to Reveal ({hero.torches} left)</span>
                    </button>
                  ) : (
                    <div className="text-[11px] font-serif text-stone-400 bg-[#140e09] px-2.5 py-1.5 rounded border border-[#3d2716] flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-stone-600" />
                      <span>Hidden Face-Down (Torch required to scout without entering)</span>
                    </div>
                  )
                ) : (
                  /* Solid stone wall blocks torchlight! */
                  <div className="text-[11px] font-serif text-red-300 bg-[#241310] px-2.5 py-1.5 rounded border border-red-800/70 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>Solid Stone Wall blocks torchlight. (Smash wall or use Clairvoyance)</span>
                  </div>
                )
              )}

              {/* If adjacent & NO unbroken wall -> Enter Room */}
              {isSelectedAdjacent && (!wallToSelected || wallToSelected.isBroken) && (
                isCurrentRoomMovementBlocked ? (
                  <div className="text-[11px] text-yellow-400 bg-[#281c12] px-2.5 py-1.5 rounded border border-yellow-800/60 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                    <span>
                      {isCurrentRoomBlockedByMonster
                        ? 'Defeat the monster in your chamber to proceed.'
                        : 'Deactivate the trap in your chamber before leaving.'}
                    </span>
                  </div>
                ) : (
                  <button
                    id="btn-move-to-selected"
                    onClick={() => {
                      sounds.playBlock();
                      onSelectAdjacentRoom(selectedRoom.id);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-b from-[#7a5526] to-[#473014] hover:from-[#94682f] hover:to-[#5e401b] text-amber-100 font-serif font-bold text-xs rounded border border-amber-500 flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Footprints className="w-3.5 h-3.5 text-amber-300" />
                    <span>Enter Room</span>
                  </button>
                )
              )}

              {/* If adjacent & BLOCKED by Wall -> Smash Wall or Phase Options */}
              {isSelectedAdjacent && wallToSelected && !wallToSelected.isBroken && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-red-400 text-[11px] flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Blocked by Solid Stone Wall
                  </span>

                  {hasBreachingTool && (
                    <button
                      id="btn-smash-wall"
                      onClick={() => {
                        sounds.playHit();
                        onSmashWall(wallToSelected.id, hasBreachingTool.item);
                      }}
                      className="px-2.5 py-1.5 bg-[#54231b] hover:bg-[#6e2e23] text-amber-200 border border-red-500 rounded text-xs font-serif font-bold flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <Hammer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Smash Wall ({hasBreachingTool.item.name})</span>
                    </button>
                  )}

                  {(isWearingEtherealRing || hasPhasingPotion) && (
                    <button
                      id="btn-phase-wall"
                      onClick={() => {
                        sounds.playSpell();
                        onPhaseThroughWall(selectedRoom.id, hasPhasingPotion?.item);
                      }}
                      className="px-2.5 py-1.5 bg-[#3f2252] hover:bg-[#532d6b] text-purple-200 border border-purple-400 rounded text-xs font-serif font-bold flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                      <span>Phase Through Wall</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Goal & Stairs Status Tracker */}
      <div className="mt-3 p-2.5 bg-[#17100a] border border-[#4d3622] rounded-lg flex items-center justify-between text-xs font-serif">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-stone-300">
            Goal: <strong className="text-amber-200">Defeat Boss & Take Stairs</strong>{' '}
            {(() => {
              const bossRoom = (Object.values(floor.rooms) as DungeonRoom[]).find((r) => r.isBossRoom);
              if (!bossRoom) return '';
              return bossRoom.isRevealed
                ? `[${bossRoom.gridX + 1},${bossRoom.gridY + 1}]`
                : '(Hidden)';
            })()}
          </span>
        </div>

        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
            floor.bossDefeated
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
              : 'bg-red-950/80 text-red-300 border border-red-800'
          }`}
        >
          {floor.bossDefeated ? '✓ Stairs Unlocked' : '✖ Boss Guards Stairs'}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[10px] font-serif text-stone-400 border-t border-[#44301d] mt-2.5">
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-1 bg-[#b58156] border border-[#ffd29d] rounded-sm" /> Wall
        </span>
        <span className="flex items-center gap-1">
          <Crown className="w-3 h-3 text-amber-300" /> Boss & Stairs
        </span>
        <span className="flex items-center gap-1">
          <Skull className="w-3 h-3 text-red-400" /> Monster
        </span>
        <span className="flex items-center gap-1">
          <Package className="w-3 h-3 text-amber-400" /> Vault
        </span>
        <span className="flex items-center gap-1">
          <Store className="w-3 h-3 text-emerald-400" /> Shop
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> Trap
        </span>
      </div>
    </div>
  );
};
