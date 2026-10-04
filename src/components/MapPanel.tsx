/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Compass,
  ChevronLeft,
  ChevronRight,
  Tent,
  ArrowDownCircle,
  Store,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { DungeonFloor, DungeonRoom, GameItem, HeroCharacter } from '../types/game';
import { DungeonMap } from './DungeonMap';
import { isRoomPassedThrough, getRoomDisplayInfo } from '../utils/generator';

interface MapPanelProps {
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
  onOpenCurrentRoom: () => void;
  onDescendFloor: () => void;
  onGoToAdventurer: () => void;
  onGoToBackpack: () => void;
  onGoToCodex?: () => void;
}

export const MapPanel: React.FC<MapPanelProps> = ({
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
  onGoToAdventurer,
  onGoToBackpack,
  onGoToCodex,
}) => {
  const currentRoom = floor.rooms[currentRoomId];

  return (
    <div className="w-full flex flex-col gap-3.5">
      {/* Floor Overview Header Banner */}
      <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3 sm:p-4 text-stone-200 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#171008] border border-amber-600/70 rounded-lg text-amber-300 shadow-inner">
              <Compass className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-serif font-black text-[#f5e4c6] leading-tight">
                  Floor {floor.floorNumber}: {floor.floorName}
                </h2>
              </div>
              <span className="text-[11px] font-serif text-stone-400 block">
                Tap adjacent chambers or doors to explore the 4x4 dungeon grid
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 4x4 Dungeon Map */}
      <DungeonMap
        floor={floor}
        currentRoomId={currentRoomId}
        hero={hero}
        activeMapAction={activeMapAction}
        onClearMapAction={onClearMapAction}
        onSelectAdjacentRoom={onSelectAdjacentRoom}
        onSmashWall={onSmashWall}
        onPhaseThroughWall={onPhaseThroughWall}
        onUseTorch={onUseTorch}
        onUseClairvoyance={onUseClairvoyance}
        onUseSpyglass={onUseSpyglass}
        onOpenCurrentRoom={onOpenCurrentRoom}
        onDescendFloor={onDescendFloor}
      />

      {/* Active Chamber Quick Action Card */}
      {currentRoom && (() => {
        const currentInfo = getRoomDisplayInfo(currentRoom);
        const isCurrentPassed = isRoomPassedThrough(currentRoom);

        return (
          <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3.5 sm:p-4 text-stone-200 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs bg-[#19110a] text-amber-300 px-2 py-0.5 rounded border border-[#4d341f]">
                  Chamber [{currentRoom.gridX + 1},{currentRoom.gridY + 1}]
                </span>
                <h3 className="font-serif font-bold text-base text-[#f5e4c6]">{currentInfo.title}</h3>
              </div>
              <p className="text-xs text-stone-300 font-serif line-clamp-2">
                {currentInfo.description}
              </p>
            </div>

            {currentRoom.type === 'CAMPFIRE' ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-[11px] text-amber-300 font-serif bg-[#1a120b] px-3 py-1.5 rounded-lg border border-amber-700/60 shadow flex items-center gap-2">
                  <Tent className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-200 block">Entrance Sanctuary</span>
                    <span className="block text-[10px] text-amber-300/70">Restored on descent</span>
                  </div>
                </div>
                <button
                  id="btn-map-open-backpack"
                  onClick={onGoToBackpack}
                  className="py-2 px-3 bg-[#382617] hover:bg-[#4d3521] text-amber-200 border border-[#6b4c2b] rounded-lg text-xs font-serif font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow transition-all hover:scale-105 active:scale-95"
                  title="Switch to Backpack to eat rations or manage gear"
                >
                  <Package className="w-4 h-4 text-amber-300" />
                  <span>Backpack ➔</span>
                </button>
              </div>
            ) : currentRoom.isBossRoom && currentRoom.isStairsUnlocked ? (
              <button
                id="btn-main-descend-stairs"
                onClick={onDescendFloor}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-serif font-black text-xs rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95 transition-all"
              >
                <ArrowDownCircle className="w-4 h-4 text-stone-950" />
                <span>Descend Stairs to Floor {floor.floorNumber + 1} ➔</span>
              </button>
            ) : currentRoom.type === 'MERCHANT' ? (
              <button
                id="btn-main-trade-merchant"
                onClick={onOpenCurrentRoom}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-emerald-100 font-serif font-bold text-xs rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95 transition-all"
              >
                <Store className="w-4 h-4 text-emerald-300" />
                <span>Trade with Merchant ➔</span>
              </button>
            ) : isCurrentPassed ? (
              <div className="flex items-center gap-2 bg-[#172417] text-emerald-300 border border-emerald-700/60 px-3.5 py-2 rounded-lg text-xs font-serif font-bold shrink-0 shadow">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Chamber Cleared & Secure</span>
              </div>
            ) : (
              <button
                id="btn-main-open-chamber-modal"
                onClick={onOpenCurrentRoom}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-serif font-black text-xs rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95 transition-all"
              >
                <span>Enter Chamber Pop-Up ➔</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* Bottom Navigation Cue */}
      <div className="flex items-center justify-between text-xs font-serif pt-1 gap-2">
        <button
          onClick={onGoToAdventurer}
          className="py-2 px-3 bg-[#241a12] hover:bg-[#382618] border border-[#6b4c2b] text-amber-200 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow"
        >
          <ChevronLeft className="w-4 h-4 text-amber-400" />
          <span>Swipe Left for Adventurer Details</span>
        </button>

        {onGoToCodex && (
          <button
            onClick={onGoToCodex}
            className="py-2 px-3 bg-[#241a12] hover:bg-[#382618] border border-[#6b4c2b] text-amber-200 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow"
          >
            <span>Swipe Right for Rules Codex</span>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </button>
        )}
      </div>
    </div>
  );
};
