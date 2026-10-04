/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dices, Sparkles, Plus, Minus, RotateCcw } from 'lucide-react';
import { RollResult, rollDice } from '../utils/dice';
import { sounds } from '../utils/audio';
import { DieShape, DICE_CONFIGS, getDieConfig } from './DieShape';

export interface CustomDieItem {
  id: string;
  sides: number;
  value: number;
}

interface DiceVisualizerProps {
  currentRoll?: RollResult | null;
  isRolling?: boolean;
  onManualRoll?: (result?: RollResult) => void;
  label?: string;
  allowCustomDice?: boolean;
  defaultSides?: number;
  defaultCount?: number;
  droppedIndices?: number[];
  showFormulaBadge?: boolean;
}

export const DiceVisualizer: React.FC<DiceVisualizerProps> = ({
  currentRoll = null,
  isRolling = false,
  onManualRoll,
  label = 'Dice Tray',
  allowCustomDice = true,
  defaultSides = 20,
  defaultCount = 1,
  droppedIndices = [],
  showFormulaBadge = true,
}) => {
  // Active custom dice for interactive playground mode if needed
  const [customDice, setCustomDice] = useState<CustomDieItem[]>([
    { id: '1', sides: defaultSides, value: Math.ceil(defaultSides / 2) },
  ]);
  const [modifier, setModifier] = useState<number>(0);
  const [showModInput, setShowModInput] = useState(false);
  const [localIsRolling, setLocalIsRolling] = useState(false);
  const [localRollValues, setLocalRollValues] = useState<number[]>([]);

  // Synchronize with incoming currentRoll prop
  useEffect(() => {
    if (currentRoll) {
      const items: CustomDieItem[] = currentRoll.individualRolls.map((val, idx) => ({
        id: `roll-${idx}-${val}`,
        sides: currentRoll.diceSides,
        value: val,
      }));
      setCustomDice(items);
      setModifier(currentRoll.modifier);
    }
  }, [currentRoll]);

  // Rolling animation cycle for numbers
  const activeRolling = isRolling || localIsRolling;

  useEffect(() => {
    if (activeRolling) {
      sounds.playDiceRoll();
      const interval = setInterval(() => {
        setLocalRollValues(customDice.map((d) => Math.floor(Math.random() * d.sides) + 1));
      }, 50);

      return () => clearInterval(interval);
    }
  }, [activeRolling, customDice]);

  // Add a die from Google selector bar
  const handleAddDie = (sides: number) => {
    sounds.playTileReveal();
    if (customDice.length >= 10) return; // Cap at 10 dice
    setCustomDice((prev) => [
      ...prev,
      { id: `die-${Date.now()}-${Math.random()}`, sides, value: Math.ceil(sides / 2) },
    ]);
  };

  // Clear custom dice
  const handleClear = () => {
    sounds.playCoins();
    setCustomDice([{ id: 'default-1', sides: 6, value: 4 }]);
    setModifier(0);
    setShowModInput(false);
  };

  // Perform interactive roll of current dice tray
  const handlePerformLocalRoll = () => {
    if (activeRolling) return;
    setLocalIsRolling(true);
    sounds.playDiceRoll();

    setTimeout(() => {
      const newItems = customDice.map((d) => ({
        ...d,
        value: Math.floor(Math.random() * d.sides) + 1,
      }));
      setCustomDice(newItems);
      setLocalIsRolling(false);
      sounds.playDiceRoll();

      if (onManualRoll) {
        const indRolls = newItems.map((d) => d.value);
        const sum = indRolls.reduce((a, b) => a + b, 0) + modifier;
        const rollRes: RollResult = {
          diceCount: customDice.length,
          diceSides: customDice[0]?.sides || 6,
          modifier,
          individualRolls: indRolls,
          total: sum,
          formulaString: `${customDice.length}d${customDice[0]?.sides || 6}${
            modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''
          }`,
          isCrit: customDice.length === 1 && customDice[0].sides === 20 && indRolls[0] === 20,
          isFumble: customDice.length === 1 && customDice[0].sides === 20 && indRolls[0] === 1,
        };
        onManualRoll(rollRes);
      }
    }, 700);
  };

  // Calculate current total
  const currentTotal = activeRolling
    ? localRollValues.reduce((a, b) => a + b, 0) + modifier
    : currentRoll
    ? currentRoll.total
    : customDice.reduce((a, b) => a + b.value, 0) + modifier;

  const isCrit = !activeRolling && currentRoll?.isCrit;
  const isFumble = !activeRolling && currentRoll?.isFumble;

  return (
    <div
      id="google-dice-visualizer"
      className="bg-[#1e2430] border-2 border-[#374151] rounded-2xl p-4 text-slate-100 shadow-2xl relative overflow-hidden select-none font-sans"
    >
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-[#2d3748] pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Dices className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-serif font-bold tracking-wide uppercase text-amber-200">
            {label}
          </span>
        </div>
        {showFormulaBadge && (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="bg-[#111827] px-2.5 py-0.5 rounded-full border border-slate-700 text-cyan-300 font-bold">
              {currentRoll
                ? currentRoll.formulaString
                : `${customDice.length}d${customDice[0]?.sides || 6}${
                    modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''
                  }`}
            </span>
          </div>
        )}
      </div>

      {/* Main Dice Arena (Google Roll Dice Style) */}
      <div className="relative min-h-[140px] sm:min-h-[160px] bg-[#161c26] rounded-xl p-4 flex items-center justify-center border border-[#2d3748] shadow-inner overflow-hidden">
        {/* Soft radial backdrop glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(18,181,203,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Dice Cluster: Multiple dice rolling together */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 z-10 py-2">
          <AnimatePresence>
            {customDice.map((die, idx) => {
              const displayVal = activeRolling
                ? localRollValues[idx] || Math.floor(Math.random() * die.sides) + 1
                : die.value;
              const isDropped = droppedIndices.includes(idx);

              return (
                <DieShape
                  key={die.id || idx}
                  sides={die.sides}
                  value={displayVal}
                  isRolling={activeRolling}
                  isCrit={isCrit && idx === 0}
                  isFumble={isFumble && idx === 0}
                  isDropped={isDropped}
                  size={customDice.length <= 2 ? 'lg' : customDice.length <= 4 ? 'md' : 'sm'}
                  index={idx}
                />
              );
            })}
          </AnimatePresence>
        </div>

        {/* Google-Style "Total [X]" Badge (Bottom Right) */}
        <motion.div
          layout
          className="absolute bottom-2.5 right-2.5 bg-[#0f172a]/95 border border-slate-700/80 rounded-xl px-3.5 py-1.5 flex items-center gap-2 shadow-2xl z-20 backdrop-blur-sm"
        >
          <span className="text-xs text-slate-400 font-sans font-medium">Total</span>
          <span className="text-xl sm:text-2xl font-black font-sans text-white tracking-tight">
            {activeRolling ? '...' : currentTotal}
          </span>
        </motion.div>

        {/* Critical Hit / Fumble Banner overlay */}
        {isCrit && (
          <div className="absolute top-2 left-2 bg-amber-500/90 text-stone-950 px-2.5 py-0.5 rounded-md font-bold text-xs font-serif flex items-center gap-1 shadow-lg z-20 animate-bounce">
            <Sparkles className="w-3.5 h-3.5 text-stone-950" />
            <span>CRITICAL HIT! (20)</span>
          </div>
        )}
        {isFumble && (
          <div className="absolute top-2 left-2 bg-red-600/90 text-white px-2.5 py-0.5 rounded-md font-bold text-xs font-serif shadow-lg z-20">
            <span>CRITICAL FUMBLE! (1)</span>
          </div>
        )}
      </div>

      {/* Google-Style Dice Selector & Roll Controls */}
      {allowCustomDice && (
        <div className="mt-3.5 pt-3 border-t border-[#2d3748]/80">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Geometric Dice Icons to Add */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {[4, 6, 8, 10, 12, 20].map((sides) => {
                const cfg = DICE_CONFIGS[sides];
                return (
                  <button
                    key={sides}
                    id={`btn-add-die-${sides}`}
                    onClick={() => handleAddDie(sides)}
                    title={`Add d${sides}`}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer shadow-md"
                    style={{
                      backgroundColor: cfg.darkColor,
                      border: `1.5px solid ${cfg.color}`,
                    }}
                  >
                    <span className="font-bold text-xs text-white drop-shadow">
                      {sides}
                    </span>
                  </button>
                );
              })}

              {/* Modifier Toggle */}
              <button
                id="btn-toggle-mod"
                onClick={() => setShowModInput(!showModInput)}
                title="Add Modifier"
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center border text-xs font-bold transition-all ${
                  showModInput || modifier !== 0
                    ? 'bg-amber-600 border-amber-400 text-stone-950'
                    : 'bg-[#2d3748] border-slate-600 text-slate-200 hover:bg-slate-700'
                }`}
              >
                ±
              </button>
            </div>

            {/* Roll & Clear Buttons */}
            <div className="flex items-center gap-2">
              <button
                id="btn-google-roll"
                onClick={handlePerformLocalRoll}
                disabled={activeRolling}
                className="px-5 py-1.5 sm:py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-sans font-bold text-xs sm:text-sm rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Dices className={`w-3.5 h-3.5 ${activeRolling ? 'animate-spin' : ''}`} />
                <span>{activeRolling ? 'Rolling...' : 'Roll'}</span>
              </button>

              <button
                id="btn-google-clear"
                onClick={handleClear}
                disabled={activeRolling}
                className="px-3.5 py-1.5 sm:py-2 bg-[#2d3748] hover:bg-slate-700 text-slate-300 font-sans font-medium text-xs sm:text-sm rounded-full transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Modifier Adjustment Bar */}
          {showModInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2.5 flex items-center gap-3 bg-[#111827] p-2 rounded-xl border border-slate-700 text-xs"
            >
              <span className="text-slate-400 font-mono">Roll Modifier:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModifier((m) => m - 1)}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono font-bold text-amber-300 px-2 min-w-[28px] text-center">
                  {modifier >= 0 ? `+${modifier}` : modifier}
                </span>
                <button
                  onClick={() => setModifier((m) => m + 1)}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
