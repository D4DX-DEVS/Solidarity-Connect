# UI Redesign — Clean Flat Theme (all roles, all pages)

Date: 2026-07-23. Approved by user.

## Goal
Replace current glassy/blur/orb UI with clean flat minimal theme per reference dashboard image. Every page, all 4 roles (state_admin, district_admin, group_admin "Area Admin", member). Zero logic changes: hooks, API calls, handlers, routes, guards, props untouched.

## Decisions (user-approved)
- Same red primary theme (#EF4444) for all roles.
- Light mode only (dark tokens left in place, untouched).
- Order: design system + shell first → State → District → Area → Member → shared pages.
- Verify per phase: `npm run build` + browser click-through.
- Mobile-first. Skeleton shimmer loading everywhere (shimmer already exists in `ui/skeleton.tsx`).

## Visual language (from reference)
- Background: flat cool gray `#F8FAFC` (hsl 210 40% 98%). No gradients, no orbs, no backdrop-blur.
- Cards: white, 1px `#E2E8F0` border, radius ~16px, shadow-sm or none.
- Colors: primary red #EF4444, success #10B981, warning #F59E0B, info #3B82F6, purple #8B5CF6. Soft tinted icon tiles (`bg-{color}/10 text-{color}`).
- Type: semibold values, 12–13px muted labels, no uppercase-tracking eyebrow styling.
- KPI cards: icon tile left-top, label, big value, small sub-line.
- Section cards: title + subtitle, action link top-right ("View all →" in blue/primary).
- Needs-attention rows: icon tile, title + sub, chevron right.
- Quick actions: grid of centered icon-over-label white tiles.
- Empty states: friendly "All clear" style.

## Architecture / leverage
All 34 pages consume `components/app/AppShell.tsx` primitives (PageShell, PageHero, SectionCard, MetricCard) + shared CSS classes in `index.css` (hero-card, surface-card, metric-card, action-tile, glass, data-strip). Restyling those two layers restyles ~80% of app. Component APIs unchanged so no page breaks.

Phases:
1. System layer: `index.css` tokens+classes, `AppShell.tsx`, `HeaderWithLogout.tsx`, `BottomNav.tsx`, base ui (card/button/input/badge/tabs/dialog), skeleton radii.
2. Dashboards to reference layout: StateAdmin, DistrictAdmin, Dashboard (area), MemberDashboard.
3. Per-page sweep: remove hardcoded glass/blur/gradient classes, ensure skeletons on loading states, mobile spacing.

## Non-goals
- No dark mode work. No new deps. No route/API/store changes. No test framework.

## Verification
- `npm run build` after each phase.
- Dev server + Playwright/Chrome walkthrough of redesigned pages (login page directly; protected pages via seeded session where possible, else visual verify of rendered layout + interactive elements).
- Grep confirms zero edits to hooks/services/lib logic files.
