/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, ChevronLeft } from 'lucide-react';
import { RulesCodexView, RuleTab } from './RulesCodexView';

interface RulesCodexPanelProps {
  onGoToMap: () => void;
  initialTab?: RuleTab;
  activeTab?: RuleTab;
  onTabChange?: (tab: RuleTab) => void;
}

export const RulesCodexPanel: React.FC<RulesCodexPanelProps> = ({
  onGoToMap,
  initialTab = 'dice',
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="w-full flex flex-col gap-3.5">
      {/* Rules Codex Header Banner */}
      <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3 sm:p-4 text-stone-200 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#171008] border border-amber-600/70 rounded-lg text-amber-300 shadow-inner">
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-serif font-black text-[#f5e4c6] leading-tight">
                  Rules & Lore Codex
                </h2>
              </div>
              <span className="text-[11px] font-serif text-stone-400 block">
                Field guide, resolution mechanics, procedural lookup tables & Hall of Fame
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Rules Codex Content Card with All Tabs */}
      <div className="bg-[#241a12] border-2 border-[#735438] rounded-xl p-3.5 sm:p-4 text-stone-200 shadow-xl flex flex-col">
        <RulesCodexView
          initialTab={initialTab}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>
    </div>
  );
};
