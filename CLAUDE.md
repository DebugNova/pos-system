# CLAUDE.md

This file provides guidance to Claude Code (`claude.ai/code`) when working in this repository.

## Project

SUHASHI Cafe POS frontend prototype built with Next.js.

## Structure

- `src/app` contains the App Router entrypoints and global styling.
- `src/components/pos` contains the POS shell, screen components, shared UI helpers, and mock data.
- `src/components/pos/suhashi-pos-app.tsx` is the main frontend orchestrator.
- `src/components/pos/mock-data.ts` contains the frontend demo data and domain types.

## Commands

- `npm run dev`
- `npm run lint`
- `npm run build`

## Notes

- Current scope is frontend only.
- Backend APIs, persistence, authentication, and real integrations are not implemented yet.
- Offline queue, printer state, and aggregator connectivity are simulated in the UI for MVP demonstration.
