/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Tent,
  ArrowDownCircle,
  Store,
  CheckCircle2,
  Package,
  Flame,
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
  onToggleMapAction?: (action: 'TORCH' | 'CLAIRVOYANCE' | 'SPYGLASS' | 'SMASH_WALL' | 'PHASE_WALL') => void;
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
  onToggleMapAction,
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
      {/* Top Room & Status Banner (No Coordinates, Room Name on Row 1, Status & Torch on Row 2) */}
      {currentRoom && (() => {
        const currentInfo = getRoomDisplayInfo(currentRoom);
        const isCurrentPassed = isRoomPassedThrough(currentRoom);

        return (
          <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3 sm:p-3.5 text-stone-200 shadow-xl flex flex-col gap-2.5">
            {/* Row 1: Room Tile Name & Hint */}
            <div>
              <h2 className="text-base sm:text-lg font-serif font-black text-[#f5e4c6] leading-tight">
                {currentInfo.title}
              </h2>
              <span className="text-[11px] font-serif text-stone-400 block mt-0.5">
                Tap adjacent chambers or doors to explore the 4x4 dungeon grid
              </span>
            </div>

            {/* Row 2: Status Element on Left + Torch Button on Right */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {/* Room Status Element */}
              {currentRoom.type === 'CAMPFIRE' ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-serif bg-[#1a120b] px-2.5 sm:px-3 py-1.5 rounded-lg border border-amber-700/60 shadow">
                  <Tent className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-bold text-amber-200 whitespace-nowrap">Entrance Sanctuary</span>
                </div>
              ) : currentRoom.isBossRoom && currentRoom.isStairsUnlocked ? (
                <button
                  id="btn-main-descend-stairs"
                  onClick={onDescendFloor}
                  className="px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-stone-950 font-serif font-black text-xs rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                >
                  <ArrowDownCircle className="w-4 h-4 text-stone-950" />
                  <span>Descend Floor {floor.floorNumber + 1} ➔</span>
                </button>
              ) : currentRoom.type === 'MERCHANT' ? (
                <button
                  id="btn-main-trade-merchant"
                  onClick={onOpenCurrentRoom}
                  className="px-3 sm:px-4 py-1.5 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 text-emerald-100 font-serif font-bold text-xs rounded-lg shadow flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                >
                  <Store className="w-4 h-4 text-emerald-300" />
                  <span>Trade ➔</span>
                </button>
              ) : isCurrentPassed ? (
                <div className="flex items-center gap-1.5 bg-[#172417] text-emerald-300 border border-emerald-700/60 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-serif font-bold shadow whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Chamber Cleared & Secure</span>
                </div>
              ) : (
                <button
                  id="btn-main-open-chamber-modal"
                  onClick={onOpenCurrentRoom}
                  className="px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-stone-950 font-serif font-black text-xs rounded-lg shadow flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                >
                  <span>Enter Chamber ➔</span>
                </button>
              )}

              {/* Torch (x) Button moved right next to the status element */}
              {hero.torches > 0 && (
                <button
                  id="btn-top-use-torch"
                  onClick={() => {
                    if (activeMapAction === 'TORCH') {
                      if (onClearMapAction) onClearMapAction();
                    } else if (onToggleMapAction) {
                      onToggleMapAction('TORCH');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-serif flex items-center gap-1.5 transition-all cursor-pointer shadow border ${
                    activeMapAction === 'TORCH'
                      ? 'bg-orange-900 border-orange-400 text-orange-100 ring-2 ring-orange-500 animate-pulse font-bold'
                      : 'bg-[#3b2715] hover:bg-[#52371d] text-orange-200 border-[#7d4d23]'
                  }`}
                  title="Light a torch to reveal an adjacent unrevealed room (Uses 1 Torch)"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>{activeMapAction === 'TORCH' ? 'Torch Mode ✕' : `Torch (${hero.torches})`}</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

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
    </div>
  );
};
