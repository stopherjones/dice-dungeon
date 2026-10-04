/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { RulesCodexView, RuleTab } from './RulesCodexView';

interface RulebookModalProps {
  onClose: () => void;
  initialTab?: RuleTab;
}

export const RulebookModal: React.FC<RulebookModalProps> = ({
  onClose,
  initialTab = 'dice',
}) => {
  return (
    <div
      id="rulebook-modal-overlay"
      className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1e150f] border-2 sm:border-4 border-[#8c6b45] rounded-2xl max-w-4xl w-full p-4 sm:p-6 text-stone-200 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#523924] pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 rounded-lg bg-[#302115] border border-amber-600/50 text-amber-400">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-mono text-amber-400/80 uppercase tracking-wide">
                Adventurer's Field Guide & Tables
              </span>
              <h2 className="text-lg sm:text-xl font-serif font-black text-[#f5e4c6] leading-tight">
                Complete Rules Codex
              </h2>
            </div>
          </div>
          <button
            id="btn-close-rules"
            onClick={onClose}
            className="p-1.5 hover:bg-[#3d2a1c] rounded-lg text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            title="Close Rules Codex"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabbed Rules Codex View */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <RulesCodexView initialTab={initialTab} />
        </div>

        {/* Footer */}
        <div className="border-t border-[#523924] pt-3 mt-3 flex items-center justify-between text-xs text-stone-400 font-mono shrink-0">
          <span>Rulebook & Codex • Tables & Leaderboard Included</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close Codex
          </button>
        </div>
      </div>
    </div>
  );
};
