/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Dices, Check, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { RollableTable, TableRow, lookupTableRow } from '../data/tables';
import { rollDice, RollResult } from '../utils/dice';
import { sounds } from '../utils/audio';
import { DieShape } from './DieShape';

interface LookupTableRollerProps<T> {
  key?: React.Key;
  table: RollableTable<T>;
  title?: string;
  subtitle?: string;
  initialRoll?: number | null;
  onRollComplete: (result: { roll: number; rollDetails: RollResult; selectedRow: TableRow<T> }) => void;
  canReroll?: boolean;
  rerollTokens?: number;
  onUseRerollToken?: () => void;
  actionButtonLabel?: string;
  autoRoll?: boolean;
  showContinueButton?: boolean;
  onContinue?: () => void;
  hideHeaderButton?: boolean;
  externalTrigger?: number;
  onRollingStateChange?: (isRolling: boolean) => void;
}

export function LookupTableRoller<T>({
  table,
  title,
  subtitle,
  initialRoll = null,
  onRollComplete,
  canReroll = false,
  rerollTokens = 0,
  onUseRerollToken,
  actionButtonLabel = 'Roll on Table',
  autoRoll = false,
  showContinueButton = false,
  onContinue,
  hideHeaderButton = false,
  externalTrigger,
  onRollingStateChange,
}: LookupTableRollerProps<T>) {
  const [currentRoll, setCurrentRoll] = useState<number | null>(initialRoll);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow<T> | null>(null);

  // Sync initial roll if provided
  useEffect(() => {
    if (initialRoll !== null && initialRoll !== undefined) {
      setCurrentRoll(initialRoll);
      const row = lookupTableRow(table, initialRoll);
      setSelectedRow(row);
      setHighlightedRowId(row.id);
    }
  }, [initialRoll, table]);

  // Handle external trigger
  useEffect(() => {
    if (externalTrigger && externalTrigger > 0) {
      performRoll();
    }
  }, [externalTrigger]);

  // Handle rolling
  const performRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    if (onRollingStateChange) onRollingStateChange(true);
    sounds.playDiceRoll();

    // Cycling animation
    let cycleCount = 0;
    const maxCycles = 10;
    const interval = setInterval(() => {
      const randomFakeRoll = Math.floor(Math.random() * table.diceSides) + 1;
      const fakeRow = lookupTableRow(table, randomFakeRoll);
      setHighlightedRowId(fakeRow.id);
      cycleCount++;
      if (cycleCount >= maxCycles) {
        clearInterval(interval);
      }
    }, 60);

    setTimeout(() => {
      clearInterval(interval);
      const finalResult = rollDice(table.diceCount, table.diceSides);
      setRollResult(finalResult);
      setCurrentRoll(finalResult.total);

      const matchedRow = lookupTableRow(table, finalResult.total);
      setSelectedRow(matchedRow);
      setHighlightedRowId(matchedRow.id);
      setIsRolling(false);
      if (onRollingStateChange) onRollingStateChange(false);
      sounds.playLoot();

      onRollComplete({
        roll: finalResult.total,
        rollDetails: finalResult,
        selectedRow: matchedRow,
      });
    }, 650);
  };

  useEffect(() => {
    if (autoRoll && currentRoll === null) {
      performRoll();
    }
  }, [autoRoll]);

  const handleReroll = () => {
    if (onUseRerollToken) {
      onUseRerollToken();
    }
    performRoll();
  };

  return (
    <div className="bg-[#18120c]/95 border-2 border-amber-800/60 rounded-xl p-5 shadow-2xl backdrop-blur-md text-amber-100 max-w-3xl w-full mx-auto">
      {/* Table Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/50 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-400 font-mono text-xs tracking-wider uppercase">
              Table Lookup • {table.diceFormula}
            </span>
            {currentRoll !== null && (
              <span className="px-2.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono text-xs font-bold">
                Rolled: {currentRoll}
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold font-serif text-amber-200 mt-1">
            {title || table.title}
          </h3>
          <p className="text-xs text-amber-400/80 mt-0.5">
            {subtitle || table.description}
          </p>
        </div>

        {/* Action Controls */}
        {!hideHeaderButton && (
          <div className="flex items-center gap-2">
            {currentRoll === null ? (
              <button
                onClick={performRoll}
                disabled={isRolling}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm cursor-pointer"
              >
                <Dices className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                {isRolling ? 'Rolling...' : `${actionButtonLabel} (${table.diceFormula})`}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {canReroll && rerollTokens > 0 && (
                  <button
                    onClick={handleReroll}
                    disabled={isRolling}
                    className="px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-600/70 text-purple-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRolling ? 'animate-spin' : ''}`} />
                    Fate Reroll ({rerollTokens} left)
                  </button>
                )}
                {showContinueButton && onContinue && (
                  <button
                    onClick={onContinue}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-stone-950 font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Proceed
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google-Style Rolling Die Display */}
      {isRolling && (
        <div className="mb-4 p-5 rounded-xl bg-[#161c26] border-2 border-slate-700 flex flex-col items-center justify-center gap-3 text-center shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-center py-2">
            <DieShape
              sides={table.diceSides}
              value={Math.floor(Math.random() * table.diceSides) + 1}
              isRolling={true}
              size="lg"
            />
          </div>
          <div className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
            <Dices className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Tumbling {table.diceFormula.toUpperCase()} on table...</span>
          </div>
        </div>
      )}

      {/* Selected Result Highlight Box with Google Die Preview */}
      {selectedRow && !isRolling && (
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-[#1e2430] via-stone-900 to-[#1e2430] border-2 border-amber-500 shadow-xl flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <DieShape
                sides={table.diceSides}
                value={currentRoll || 1}
                isRolling={false}
                size="md"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-amber-200 font-bold font-serif text-base">
                  {selectedRow.name}
                </span>
                {selectedRow.badge && (
                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-900/60 border border-amber-600 text-amber-300 uppercase">
                    {selectedRow.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-300/90 mt-0.5">
                {selectedRow.subtitle || selectedRow.description}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Selected
            </span>
          </div>
        </div>
      )}

      {/* Lookup Table Rows */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {table.rows.map((row) => {
          const isMatched = highlightedRowId === row.id;
          const rangeText =
            row.minRoll === row.maxRoll
              ? `[ ${row.minRoll} ]`
              : `[ ${row.minRoll} - ${row.maxRoll} ]`;

          return (
            <div
              key={row.id}
              className={`p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between gap-3 ${
                isMatched
                  ? 'bg-amber-900/40 border-amber-400 text-amber-100 shadow-md ring-1 ring-amber-400/50'
                  : 'bg-stone-900/50 border-stone-800/80 text-stone-300 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-xs shrink-0 ${
                    isMatched
                      ? 'bg-amber-500 text-stone-950 font-black'
                      : 'bg-stone-800 text-amber-400/80 border border-stone-700'
                  }`}
                >
                  {rangeText}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`font-serif font-bold ${
                        isMatched ? 'text-amber-200' : 'text-stone-200'
                      }`}
                    >
                      {row.name}
                    </span>
                    {row.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 border border-stone-700 shrink-0">
                        {row.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 truncate">
                    {row.subtitle || row.description}
                  </p>
                </div>
              </div>

              {isMatched && (
                <div className="shrink-0 text-amber-400 flex items-center gap-1 font-mono text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 animate-bounce text-amber-300" />
                  RESULT
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
