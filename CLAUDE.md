# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Tinder-style image organizer. Load images, use keyboard shortcuts to swipe-accept/reject them rapidly, then save — copying/moving kept images to a target folder (optionally sorted by EXIF date) and trashing rejected ones. Optimized for fast culling of large photo sets.

## Commands

```bash
npm run dev       # Start Vite dev server (port 1420) + Tauri app
npm run build     # TypeScript check + Vite build
npm run lint      # ESLint on .ts/.tsx files
npm run tsc       # Type check (no emit)
npm run tauri     # Tauri CLI (e.g. npm run tauri build)
```

No test suite exists.

## Architecture

**Tauri desktop app** — Rust backend + React/TypeScript frontend.

**Frontend** (`src/`):
- `main.tsx` → React root
- `App.tsx` → Wraps with `UpdaterWrapper`, `SettingsContext`, `OrganizerContext`
- `routes/main-screen/ImageOrganizer.tsx` — core UI (file list, tag/accept/reject workflow)
- `routes/main-screen/organizerContext.tsx` — central state (file list, selections, review state)
- `components/settings/` — settings dialog + `SettingsContext` (sort variant, delete behavior)
- `api.ts` — all Tauri `invoke()` calls in one place

**Backend** (`src-tauri/src/`):
- `main.rs` — Tauri setup, registers all commands
- `file_operations/mod.rs` — `save_files` (copy/move) and `save_delete_files` (trash) commands
- `file_operations/file_sorting.rs` — EXIF-based date extraction for folder sorting

**Data flow:** User selects images → OrganizerContext tracks accept/reject state → Save dialog calls `api.ts` → Tauri command in Rust performs file ops → Result map (path → SaveImageResult/RemoveFileResult) returned to frontend.

## Key conventions

- **Styling:** TailwindCSS + Radix UI. Custom HSL color tokens in `tailwind.config.js` (use `bg-primary`, `text-secondary`, etc. — not raw colors).
- **Formatting:** Prettier enforced — 120 char width, 4-space tabs, single quotes.
- **Unused vars:** Prefix with `_` to suppress ESLint warning.
- **UI language:** German strings in user-facing text.
- **State:** React Context only — no Redux/Zustand. `OrganizerContext` for file state, `SettingsContext` for preferences.

## Tauri notes

- Dev server must run on port 1420 (hardcoded in `tauri.conf.json`).
- All Rust↔JS communication goes through `src/api.ts` — add new commands there.
- Auto-updater uses GitHub releases; versioned in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. Use `./bump-version.sh patch` for releases.
- DevTools auto-open in debug builds.
