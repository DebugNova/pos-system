---
name: update-docs
description: Sync CLAUDE.md and docs/remaining_work.md to reflect changes made in the current conversation. Use this skill whenever the user types /update, says "update the docs", "update claude.md", "update remaining work", or after a session where features were built, bugs fixed, or architecture decisions were made. This skill reads the conversation context, figures out what changed in the codebase, and surgically patches both documentation files to stay accurate.
---

# Update Docs Skill (`/update`)

Keeps `CLAUDE.md` and `docs/remaining_work.md` in sync with what was actually built in this conversation.

The goal is simple: these two files are the source of truth for any AI agent working in this repo. If they fall behind reality, the next agent will waste time re-doing work or making wrong assumptions. This skill prevents that drift.

---

## Step 1 — Reconstruct what changed this session

Before touching any file, build a mental model of the session. Work through these questions:

**What features/fixes were implemented?**
- Look at every file that was edited or created this session
- For each change, decide: is this a new feature, a bug fix, a refactor, or a partial improvement?
- Note which blueprint items (#1–#47+) are affected

**What is now "done" vs. "partial"?**
- 🔴 Missing → 🟢 Done: the feature is fully functional
- 🔴 / 🟡 → 🟡 Partial: the feature was improved but still has gaps
- Something that was already 🟢 but got enhanced: update the description

**What new gaps were discovered while building?**
- Were any stubs encountered? Any TODOs found?
- Were any new items identified that aren't currently tracked?

**Were any architectural decisions made?**
- New libraries added? New patterns established?
- Any "notes for AI agents" that future agents need to know?

Only update what actually changed — don't rewrite the whole file speculatively.

---

## Step 2 — Update `CLAUDE.md`

Read `CLAUDE.md` first. Then make targeted edits:

**"What to Build" / Core Modules table**
- Update the Purpose column if a module's capabilities changed meaningfully
- If a whole module is now complete, note it

**"Key Features Still Needed" list**
- Mark items `[DONE]` if completed this session
- Add new items if gaps were discovered
- Remove items if they're now fully done and clutter the list

**"Notes for AI Agents" section**
- Update any note that is now outdated (e.g., if reports no longer use mock data, remove that note)
- Add new notes about patterns established this session (e.g., "Kitchen Display uses X pattern")
- Keep notes actionable and specific — future agents will read this before touching the code

**Project structure**
- Add any new files or directories created this session
- Fix any paths that were wrong

Keep CLAUDE.md concise. It's a briefing document, not a changelog. Every word should help the next agent.

---

## Step 3 — Update `docs/remaining_work.md`

Read `docs/remaining_work.md` first. Then patch it:

**For each feature built or improved:**
1. Find the row in the table by item number or name
2. Change the status icon:
   - `🔴` → `🟢` if fully done
   - `🔴` → `🟡` or `🟡` → description update if partially done
3. Rewrite the Details cell to accurately describe the current state — not the old gap, but what's true now

**For new gaps discovered:**
- Add a new row with the next available item number
- Use `🔴` or `🟡` as appropriate
- Write a clear, specific Details description

**Priority Roadmap section:**
- Mark completed items with `[DONE]` or remove them from the list
- Add new items if they belong in Phase 1
- Fix sequential numbering if items were added/removed

**Keep the "Generated" date accurate** — update it to today's date.

---

## Step 4 — Confirm with the user

After making all edits, briefly summarize:

```
Updated CLAUDE.md:
  ✓ Marked "Kitchen Flow" as [DONE] in key features
  ✓ Updated kitchen display note in agent notes section

Updated remaining_work.md:
  ✓ Item #11 (KOT Queue): 🟡 → 🟢
  ✓ Item #48 (Kitchen Filtering): Added as new 🟢
  ✓ Roadmap: added item-level kitchen tracking to Phase 1
```

Keep the summary tight — one line per meaningful change. Don't list every word that changed.

---

## Rules

- **Be surgical.** Edit only what changed. Don't regenerate entire sections.
- **Don't inflate status.** Only mark something 🟢 if it genuinely works end-to-end. Partial implementations stay 🟡.
- **Preserve item numbers.** Don't renumber existing items — just append new ones with the next available number.
- **Match the existing tone and style** of both files — don't introduce new formatting patterns.
- **If uncertain about a status**, err on the side of 🟡 (partial) over 🟢 (done).
- **New item numbers** should continue from the highest existing number (e.g., if items go up to #47, add #48).
