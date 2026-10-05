/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import {
  CombatState,
  DungeonFloor,
  DungeonRoom,
  GameItem,
  HeroCharacter,
  Monster,
} from '../types/game';
import { RoomView } from './RoomView';
import type { RoomPrimaryAction } from './RoomView';
import { CombatView } from './CombatView';
import { getStatModifier } from '../utils/dice';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  floor: DungeonFloor;
  room: DungeonRoom;
  hero: HeroCharacter;
  combat: CombatState | null;
  onUpdateHero: (hero: HeroCharacter) => void;
  onUpdateRoom: (room: DungeonRoom) => void;
  onEnterCombat: (room: DungeonRoom) => void;
  onUpdateCombat: (combat: CombatState | null) => void;
  onCombatVictory: (monster: Monster, reward: { xp: number; gold: number; items: GameItem[] }) => void;
  onCombatFlee: () => void;
  onOpenMerchant: () => void;
  onUseTorch?: (targetRoomId: string) => void;
  onSmashWall: (wallId: string, item: GameItem) => void;
  onPhaseThroughWall: (targetRoomId: string, item?: GameItem) => void;
  onDescendFloor: () => void;
  onOpenInventory?: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  floor,
  room,
  hero,
  combat,
  onUpdateHero,
  onUpdateRoom,
  onEnterCombat,
  onUpdateCombat,
  onCombatVictory,
  onCombatFlee,
  onOpenMerchant,
  onUseTorch,
  onSmashWall,
  onPhaseThroughWall,
  onDescendFloor,
  onOpenInventory,
}) => {
  // Listen for Escape key to close modal if not in active attack animation (only when not in combat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !combat) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, combat]);

  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<RoomPrimaryAction | null>(null);
  const [primaryActionLabel, setPrimaryActionLabel] = useState<string | null>(null);
  const handlePrimaryActionChange = useCallback((action: RoomPrimaryAction | null) => {
    primaryActionRef.current = action;
    const label = action?.label ?? null;
    setPrimaryActionLabel((current) => (current === label ? current : label));
  }, []);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setIsScrolled(scrollContainerRef.current.scrollTop > 45);
    }
  };

  // Scroll back to the top of the container after any interaction, turn transition, room state change, or damage
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsScrolled(false);
  }, [
    combat?.monster?.id,
    combat?.turnNumber,
    combat?.isHeroTurn,
    combat?.heroDefending,
    combat?.monster?.hp,
    room.id,
    room.trap?.disarmed,
    room.trap?.triggered,
    room.chest?.isOpened,
    room.chest?.isJammed,
    room.chest?.isFailed,
    room.shrineUsed,
    room.secretFound,
    room.isLooted,
    hero.currentHp,
    hero.currentMana,
  ]);

  if (!isOpen) return null;

  // Compute live hero Armor Class and stats including equipment and stances
  const heroStats = { ...hero.stats };
  (Object.values(hero.equipment) as (GameItem | undefined)[]).forEach((item) => {
    if (item?.statBonuses) {
      if (item.statBonuses.STR) heroStats.STR += item.statBonuses.STR;
      if (item.statBonuses.DEX) heroStats.DEX += item.statBonuses.DEX;
      if (item.statBonuses.CON) heroStats.CON += item.statBonuses.CON;
      if (item.statBonuses.INT) heroStats.INT += item.statBonuses.INT;
      if (item.statBonuses.LCK) heroStats.LCK += item.statBonuses.LCK;
    }
  });

  let heroAc = 10 + getStatModifier(heroStats.DEX);
  (Object.values(hero.equipment) as (GameItem | undefined)[]).forEach((item) => {
    if (item?.armorBonus) heroAc += item.armorBonus;
  });

  if (hero.activeEffects && hero.activeEffects.length > 0) {
    hero.activeEffects.forEach((eff) => {
      if (eff.armorModifier) heroAc += eff.armorModifier;
    });
  }

  if (combat?.heroDefending || combat?.heroCatchingBreath) {
    heroAc += 4;
  }

  const hpPercent = Math.max(0, Math.min(100, (hero.currentHp / hero.maxHp) * 100));
  const mpPercent = Math.max(0, Math.min(100, (hero.currentMana / hero.maxMana) * 100));
  const monsterHpPercent = combat?.monster
    ? Math.max(0, Math.min(100, (combat.monster.hp / combat.monster.maxHp) * 100))
    : 0;

  // Room status indicator
  const hasMonster = room.monster && room.monster.hp > 0;
  const hasTrap = room.trap && !room.trap.disarmed && !room.trap.triggered;
  const hasChest = room.chest && !room.chest.isOpened;

  return (
    <div
      id="room-modal-backdrop"
      className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn"
    >
      <div
        id="room-modal-container"
        className="bg-[#1c130c] border-2 border-[#785536] rounded-2xl w-full max-w-5xl shadow-[0_0_50px_rgba(0,0,0,0.85)] max-h-[92vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Sticky Top Header Bar */}
        <div className={`bg-[#150e08] border-b-2 border-[#523821] ${combat ? 'p-2 sm:p-2.5' : 'p-3 sm:p-4'} shrink-0 shadow-md transition-all duration-200`}>
          {combat ? (
            /* COMBAT HEADER: Compact side-by-side duel HUD with names, AC, and mini HP/EP bars (no icons, pure letters) */
            <div className="flex flex-col gap-1.5 animate-fadeIn">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2.5">
                {/* Left: Hero / Character Area */}
                <div className="bg-[#1a110a] border border-amber-900/60 rounded-lg p-1.5 sm:p-2 flex flex-col gap-1 shadow-sm min-w-0">
                  {/* Top row: Character name at top left, AC at top right */}
                  <div className="flex items-center justify-between gap-1.5 leading-tight">
                    <h3 className="font-serif font-black text-amber-100 text-xs sm:text-sm truncate">
                      {hero.name}
                    </h3>

                    {/* Hero AC Badge at top right (no shield icon) */}
                    <div
                      className="flex items-center gap-1 bg-[#100a06] px-1.5 py-0.5 rounded border border-blue-900/70 text-[10px] sm:text-xs font-mono shrink-0"
                      title={`Hero Armor Class: ${heroAc}`}
                    >
                      <span className="font-bold text-blue-200">AC {heroAc}</span>
                      {(combat.heroDefending || combat.heroCatchingBreath) && (
                        <span className="text-[9px] text-emerald-300 bg-emerald-950 border border-emerald-600 px-0.5 rounded font-bold animate-pulse">
                          +4
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Second row: Smaller HP, EP side by side (no heart/sparkles icons) */}
                  <div className="grid grid-cols-2 gap-1 sm:gap-1.5 font-mono text-[10px] sm:text-[11px]">
                    {/* Hero HP */}
                    <div className="bg-[#100a06] px-1.5 py-0.5 rounded border border-stone-800 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between leading-none">
                        <span className="text-emerald-400 font-bold">HP</span>
                        <span className="text-emerald-300 font-bold">
                          {hero.currentHp}/{hero.maxHp}
                        </span>
                      </div>
                      <div className="w-full bg-stone-900 rounded-full h-1 border border-stone-800 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${hpPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Hero EP */}
                    <div className="bg-[#100a06] px-1.5 py-0.5 rounded border border-stone-800 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between leading-none">
                        <span className="text-cyan-400 font-bold">EP</span>
                        <span className="text-cyan-300 font-bold">
                          {hero.currentMana}/{hero.maxMana}
                        </span>
                      </div>
                      <div className="w-full bg-stone-900 rounded-full h-1 border border-stone-800 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${mpPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Spell Buffs / Stances (compact, if any) */}
                  {hero.activeEffects && hero.activeEffects.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {hero.activeEffects.map((eff) => {
                        let bonusText = '';
                        if (eff.damageReduction) bonusText = `-${eff.damageReduction} Dmg`;
                        else if (eff.armorModifier) bonusText = `+${eff.armorModifier} AC`;
                        else if (eff.attackModifier) bonusText = `+${eff.attackModifier} Atk`;
                        else if (eff.shieldHp) bonusText = `${eff.shieldHp} HP`;
                        else if (eff.evasionBonus) bonusText = `75% Evade`;

                        return (
                          <span
                            key={eff.id}
                            title={eff.description}
                            className="text-[8px] sm:text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-blue-950/80 text-blue-200 border border-blue-700/80 flex items-center shadow-sm"
                          >
                            <span className="truncate max-w-[65px]">{eff.name}</span>
                            {bonusText && <span className="text-amber-300 ml-1">({bonusText})</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Center: Small Vs between (round number removed) */}
                <div className="flex items-center justify-center shrink-0 px-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-red-950/90 border border-red-800 text-red-300 font-mono font-bold text-[9px] sm:text-[10px] uppercase tracking-wider shadow">
                    VS
                  </span>
                </div>

                {/* Right: Monster / Enemy Area */}
                <div className="bg-[#1a110a] border border-red-900/60 rounded-lg p-1.5 sm:p-2 flex flex-col gap-1 shadow-sm min-w-0">
                  {/* Top row: Enemy name at top left, AC at top right (no skull/shield icons) */}
                  <div className="flex items-center justify-between gap-1.5 leading-tight">
                    <div className="flex items-center gap-1 min-w-0">
                      <h3 className="font-serif font-black text-red-200 text-xs sm:text-sm truncate">
                        {combat.monster.name}
                      </h3>
                      {combat.monster.isBoss && (
                        <span className="px-1 py-0.2 rounded bg-amber-950 border border-amber-600 text-amber-300 text-[8px] font-mono font-bold shrink-0">
                          BOSS
                        </span>
                      )}
                    </div>

                    {/* Monster AC at top right (no shield icon) */}
                    <div
                      className="flex items-center bg-[#100a06] px-1.5 py-0.5 rounded border border-stone-800 text-[10px] sm:text-xs font-mono shrink-0"
                      title={`Armor Class: ${combat.monster.armorClass}`}
                    >
                      <span className="font-bold text-amber-300">AC {combat.monster.armorClass}</span>
                    </div>
                  </div>

                  {/* Second row: Enemy panel has HP (no heart icon) */}
                  <div className="bg-[#100a06] px-1.5 py-0.5 rounded border border-stone-800 flex flex-col gap-0.5 font-mono text-[10px] sm:text-[11px]">
                    <div className="flex items-center justify-between leading-none">
                      <span className="text-red-400 font-bold">HP</span>
                      <span className="text-red-300 font-bold">
                        {combat.monster.hp}/{combat.monster.maxHp}
                      </span>
                    </div>
                    <div className="w-full bg-stone-900 rounded-full h-1 border border-stone-800 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-red-700 via-red-600 to-amber-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${monsterHpPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* EXPLORATION HEADER (Non-Combat): Streamlined Room Title */
            <div className="flex items-center justify-between gap-3 animate-fadeIn">
              <div>
                <h2 className="text-base sm:text-lg font-serif font-black text-[#f5e4c6] leading-tight">
                  {room.title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-400 font-serif">
                  <span>Floor {floor.floorNumber}: {floor.floorName}</span>
                  <span>•</span>
                  <span className="capitalize text-amber-300/90 font-mono text-[11px]">
                    {room.isBossRoom
                      ? 'Floor Boss Chamber'
                      : hasMonster
                      ? 'Hostile Threat'
                      : hasTrap
                      ? 'Hazard Trap'
                      : room.isCleared
                      ? 'Cleared Chamber'
                      : room.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Modal Body: Combat View or Room View */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 sm:p-5"
        >
          {combat ? (
            <CombatView
              hero={hero}
              combat={combat}
              onUpdateHero={onUpdateHero}
              onUpdateCombat={onUpdateCombat}
              onCombatVictory={onCombatVictory}
              onCombatFlee={onCombatFlee}
            />
          ) : (
            <RoomView
              floor={floor}
              room={room}
              hero={hero}
              onUpdateHero={onUpdateHero}
              onUpdateRoom={onUpdateRoom}
              onEnterCombat={onEnterCombat}
              onOpenMerchant={onOpenMerchant}
              onUseTorch={onUseTorch}
              onSmashWall={onSmashWall}
              onPhaseThroughWall={onPhaseThroughWall}
              onDescendFloor={onDescendFloor}
              onOpenInventory={onOpenInventory}
              onClose={onClose}
              onPrimaryActionChange={handlePrimaryActionChange}
            />
          )}
        </div>

        {/* Sticky Tabletop Footer matching other game views */}
        {!combat ? (
          <div className="shrink-0 z-40 w-full bg-[#160f09]/98 border-t-2 border-amber-800/80 shadow-[0_-12px_28px_rgba(0,0,0,0.95)] backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5">
            <div className="max-w-2xl mx-auto flex flex-col gap-1.5">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  id="btn-footer-return-map-main"
                  onClick={onClose}
                  className="shrink-0 py-2 px-2.5 sm:px-3 bg-[#241a12] hover:bg-[#382618] text-amber-200 border border-[#6b4c2b] rounded-md text-xs font-serif font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4 text-amber-400" />
                  <span>Return to Map</span>
                </button>
                {primaryActionLabel && (
                  <button
                    id="btn-footer-room-primary"
                    disabled={Boolean(primaryActionRef.current?.disabled)}
                    onClick={() => primaryActionRef.current?.onClick()}
                    className={`flex-1 min-w-0 py-2.5 px-3 sm:px-4 font-serif font-black rounded-md shadow-lg text-sm transition-all border flex items-center justify-center gap-2 ${
                      primaryActionRef.current?.disabled
                        ? 'bg-stone-700 text-stone-400 border-stone-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-stone-950 border-yellow-200 cursor-pointer active:translate-y-px'
                    }`}
                  >
                    <span className="text-center leading-tight">{primaryActionLabel}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-stone-400 font-mono py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1" />
                <span>
                  {hasMonster
                    ? 'Hostile threat blocking passage'
                    : hasTrap
                    ? 'Active trap mechanism'
                    : 'Chamber is secure • Click adjacent tiles or doors on map to explore'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#140d08] border-t border-[#422c19] px-4 py-2 flex items-center justify-between text-xs font-serif text-stone-400 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-stone-300">
                Combat in progress with {combat.monster.name}. Round {combat.turnNumber} ({combat.isHeroTurn ? 'Your Turn' : 'Enemy Turn'}).
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
