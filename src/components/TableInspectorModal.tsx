/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, Dices, X, Skull, Package, Sparkles, Shield, Flame, Target } from 'lucide-react';
import {
  CHARACTER_CLASS_TABLE,
  STARTING_BOON_TABLE,
  ROOM_TABLE_FLOOR_1,
  ROOM_TABLE_FLOOR_2,
  ROOM_TABLE_FLOOR_3,
  MONSTER_TABLE_FLOOR_1,
  MONSTER_TABLE_FLOOR_2,
  MONSTER_TABLE_FLOOR_3,
  MONSTER_TRAIT_TABLE,
  LOOT_TABLE_CHEST,
  RollableTable,
} from '../data/tables';
import { LookupTableRoller } from './LookupTableRoller';

interface TableInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALL_TABLES: { id: string; label: string; category: string; table: RollableTable<any> }[] = [
  { id: 'classes', label: '1. Character Classes (1d8)', category: 'Hero Creation', table: CHARACTER_CLASS_TABLE },
  { id: 'boons', label: '2. Heirloom Boons (1d6)', category: 'Hero Creation', table: STARTING_BOON_TABLE },
  { id: 'f1_rooms', label: '3. Catacomb Rooms F1 (1d20)', category: 'Exploration', table: ROOM_TABLE_FLOOR_1 },
  { id: 'f2_rooms', label: '4. Sunken Mines Rooms F2 (1d20)', category: 'Exploration', table: ROOM_TABLE_FLOOR_2 },
  { id: 'f3_rooms', label: '5. Infernal Rooms F3 (1d20)', category: 'Exploration', table: ROOM_TABLE_FLOOR_3 },
  { id: 'f1_monsters', label: '6. F1 Beasts Table (1d6)', category: 'Monsters', table: MONSTER_TABLE_FLOOR_1 },
  { id: 'f2_monsters', label: '7. F2 Mine Horrors (1d6)', category: 'Monsters', table: MONSTER_TABLE_FLOOR_2 },
  { id: 'f3_monsters', label: '8. F3 Infernal Guardians (1d6)', category: 'Monsters', table: MONSTER_TABLE_FLOOR_3 },
  { id: 'traits', label: '9. Monster Trait Table (1d6)', category: 'Monsters', table: MONSTER_TRAIT_TABLE },
  { id: 'loot', label: '10. Vault Loot & Relics (1d20)', category: 'Treasure', table: LOOT_TABLE_CHEST },
];

export const TableInspectorModal: React.FC<TableInspectorModalProps> = ({ isOpen, onClose }) => {
  const [selectedTableId, setSelectedTableId] = useState<string>('f1_rooms');

  if (!isOpen) return null;

  const currentEntry = ALL_TABLES.find((t) => t.id === selectedTableId) || ALL_TABLES[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#18120c] border-2 border-amber-600 rounded-xl max-w-4xl w-full p-6 shadow-2xl text-amber-100 flex flex-col max-h-[90vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-900/60 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-950 border border-amber-700 text-amber-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-mono text-amber-400/80 uppercase">
                Tabletop Reference Codex
              </span>
              <h2 className="text-xl font-bold font-serif text-amber-200">
                Procedural Lookup Tables
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-amber-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Sidebar + Active Table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-y-auto pr-1">
          {/* Sidebar Menu */}
          <div className="space-y-1 bg-stone-950/60 p-2 rounded-lg border border-stone-800 shrink-0">
            <div className="text-[10px] font-mono text-stone-500 uppercase px-2 py-1">
              Select Lookup Table
            </div>
            {ALL_TABLES.map((entry) => {
              const isSelected = selectedTableId === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedTableId(entry.id)}
                  className={`w-full text-left p-2 rounded text-xs font-serif transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-amber-900/50 border border-amber-500 text-amber-200 font-bold'
                      : 'text-stone-300 hover:bg-stone-900'
                  }`}
                >
                  <span className="truncate">{entry.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Table Viewer / Roller */}
          <div className="md:col-span-2 flex flex-col">
            <LookupTableRoller
              key={currentEntry.id}
              table={currentEntry.table}
              title={currentEntry.table.title}
              subtitle={currentEntry.table.description}
              actionButtonLabel="Test Roll"
              onRollComplete={() => {}}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-amber-900/50 pt-3 mt-4 flex items-center justify-between text-xs text-stone-400 font-mono shrink-0">
          <span>All tables are rolled using fair, transparent pseudo-random dice generators.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded border border-stone-700 cursor-pointer"
          >
            Close Codex
          </button>
        </div>
      </div>
    </div>
  );
};
