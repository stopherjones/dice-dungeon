# Implementation Plan: Groq AI Destiny Assignment with Local Fallback

Integrate the user's existing Cloudflare Worker proxy (`https://groq-proxy.chrisjones59.workers.dev/chat/completions`) utilizing `openai/gpt-oss-120b` into character creation to dynamically evaluate rolled attributes, assign thematic races and classes, and craft bespoke narrative flavor text, while preserving the existing rule-based engine as a robust, instant fallback.

---

## 1. System Architecture & Flow

```
[ Roll 4d6 (Drop Lowest) x 5 Stats ]
                 │
                 ▼
 [ Click "Reveal Your Calling & Destiny" ]
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
[ Compute Local       [ Call Groq Proxy via Worker ]
  Fallback Destiny      • URL: groq-proxy.chrisjones59.workers.dev
  (Instant) ]           • Model: openai/gpt-oss-120b
                        • Strict JSON Schema
                        • 6-second AbortController timeout
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
         [ Success & Valid ]       [ Error / Timeout ]
               │                         │
               ▼                         ▼
      [ Apply Groq AI Destiny ]    [ Apply Local Fallback ]
               │                         │
               └────────────┬────────────┘
                            │
                            ▼
              [ Display Destiny & Loadout ]
              • Title, Race Trait & Badge
              • Rich Narrative Flavor Quote
              • Auto-Assigned Fate Tokens (e.g. Jester: 4)
              • Equipped Weapons, Armor & Treasure
```

---

## 2. API Contract & Prompt Engineering

### Endpoint & Configuration
- **Worker Endpoint**: `https://groq-proxy.chrisjones59.workers.dev/chat/completions`
- **Model**: `openai/gpt-oss-120b`
- **Method**: `POST`
- **Payload Headers**: `{ "Content-Type": "application/json" }`
- **Response Format**: `response_format: { "type": "json_object" }`

### Prompt Structure
The system and user prompt will ground the LLM in the game's exact 8 races and 8 classes:
- **Available Races (8)**: `Human`, `Elf`, `Dwarf`, `Halfling`, `Gnome`, `Half-Orc`, `Tiefling`, `Dragonborn`
- **Available Classes (8)**: `warrior`, `paladin`, `rogue`, `ranger`, `wizard`, `cleric`, `hero`, `jester`
- **Input Data**: Rolled stats `STR`, `DEX`, `CON`, `INT`, `LCK`, Total score, Highest attribute, Lowest attribute.
- **Expected JSON Schema**:
  ```json
  {
    "race": "Elf",
    "classId": "jester",
    "label": "FORTUNE'S FOOL",
    "callingTitle": "Elf Jester",
    "reason": "With not a single attribute breaking past 16 (Total: 51), every respectable guild shut their doors on you, a humble Elf. You don the bells and motley, armed with sheer audacity, 4 Fate Rerolls, and ridiculous luck!"
  }
  ```

---

## 3. Proposed Changes

### A. New Service: `src/services/groqDestiny.ts`
Create an isolated service module handling API communication:
1. `generateGroqDestiny(stats: CharacterStats, keptDice: readonly number[]): Promise<Destiny | null>`
2. Constructs the prompt with strict enum constraints on `race` and `classId`.
3. Handles `fetch` with `AbortController` (timeout 6500ms).
4. Validates output:
   - Verifies `classId` is one of the valid 8 `HeroClassId` values.
   - Verifies `race` matches one of the 8 canonical races (case-insensitive mapping).
   - Looks up the official race trait from `destiny.json` (`T.races.rows`).
   - Assigns official fate tokens according to class definition (`jester` gets 4, `rogue` gets 2, others get 1).
   - Returns a complete `Destiny` object or returns `null` to trigger fallback.

### B. UI & State in `src/components/CharacterCreation.tsx`
1. **Loading State**: Add `isDestinyLoading` boolean state with animated fantasy loading feedback:
   - When the user clicks `btn-reveal-calling-destiny`, show a themed status indicator ("Consulting the Oracles of Fate..." with pulsing arcane runes).
2. **Calling Execution**:
   - Compute `fallbackDiagnosis = determineDestiny(stats, keptDice)` immediately.
   - In parallel, invoke `generateGroqDestiny(stats, keptDice)`.
   - If Groq succeeds, use Groq destiny; if it fails or times out, immediately and seamlessly apply `fallbackDiagnosis`.
3. **Destiny Reveal Presentation**:
   - Display a subtle provenance indicator ("Oracle Destiny: Groq AI" vs "Calling: Codex Rules Engine").
   - Include a "Consult Oracle Again" / "Switch to Classic Calling" button for instant comparison and testing.
4. **Suggested Names**: Keep `suggestName(raceName)` aligned with the assigned race so random name generation matches the AI-assigned race.

---

## 4. Error Handling & Fallback Guarantees
- **No Blocked Gameplay**: If Cloudflare Worker is slow, offline, rate-limited, or CORS fails, character creation never freezes or breaks.
- **Strict Data Sanitization**: If the model invents a non-existent class (e.g. "barbarian" or "necromancer") or race, the validator discards it and applies the deterministic fallback engine.
- **Zero Key Exposure**: Uses the user's pre-configured Cloudflare Worker proxy (`groq-proxy.chrisjones59.workers.dev`) which manages credentials securely.

---

## 5. Verification & Testing
1. **Live Roll Testing**:
   - Roll various stat spreads: extreme stat (18 DEX, 6 CON), balanced stats (all 11-13), low total (< 55), high total (> 70).
   - Trigger destiny reveal and verify Groq generates valid race, class, and engaging flavor quote.
2. **Fallback Verification**:
   - Simulate network failure or timeout to verify the fallback engine seamlessly populates destiny without errors.
3. **Build & Lint**: Run `lint_applet` and `compile_applet` to ensure full TypeScript typing and zero build regressions.
