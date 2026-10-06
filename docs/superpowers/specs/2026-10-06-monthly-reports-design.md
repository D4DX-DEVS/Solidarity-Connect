# Monthly Reports — design

Date: 2026-10-06. Replaces Targets, Consolidation and the old Reports (member census) page.

## Goal

Every month each state, district and area submits one report. The state admin defines what each
level's report asks (any field type). Numbers add up the hierarchy (area → district → state) in a
consolidated view. Members see their own area's totals.

## Decisions (from the user)

- Targets (create/my-targets/marks), Consolidation and the member-census Reports page are removed
  everywhere. Old target data is backed up to JSON, then deleted.
- One report form per level: **state**, **district**, **area**. Unit items are part of the area
  form — the area admin enters them as area totals. No per-unit reports.
- State admin can add any field type: text, long text, number, date, time, phone, email, yes/no,
  dropdown, radio, checkboxes, file/photo, section heading. Optional show/hide condition per field
  (one rule: field + operator + value). No multi-page forms.
- Number fields have **Add up** (default on): summed in consolidation and shown to members.
- One **shared** report per scope per month. Any co-admin of that scope can save it; everyone sees
  who submitted and who last edited. Every save is logged with the fields it changed.
- Editable until the form's **deadline day** (default 10) of the following month, 23:59 IST; then
  locked. A higher level can unlock for 7 days.
- Fillers: state admins (state), district admins (own district), area admins proper — roleTag
  `area`, not Murabi/Coordinator (own area). Viewers: Murabi, Coordinator and unit admins see their
  area's report read-only.
- Visibility: state sees all; district sees own district + its areas; area-level and unit admins see
  own area; members see own area's summed numbers only.

## Seeded forms (editable, published as version 1)

- Area: ഏരിയ സെക്രട്ടേറിയേറ്റ്, ഏരിയ സമിതി, മെമ്പേഴ്‌സ് മീറ്റ്, മെമ്പേഴ്‌സ് മീറ്റിൽ പങ്കെടുത്തവരുടെ
  എണ്ണം (shown when മെമ്പേഴ്‌സ് മീറ്റ് > 0), യൂത്ത് മീറ്റ്, then heading യൂണിറ്റ്: യൂണിറ്റ് മീറ്റിംഗ്,
  യൂത്ത് മീറ്റ് (യൂണിറ്റ്), യൂത്ത് ആക്റ്റിവിറ്റി.
- District: ജില്ലാ സെക്രട്ടേറിയേറ്റ്, ജില്ലാ സമിതി.
- State: സെക്രട്ടറിയേറ്റ്, സംസ്ഥാന സമിതി, DPDGS.
- All are required whole numbers ≥ 0 with Add up on.

## Data model (MongoDB)

- `ReportForm` — one per level (unique). `fields[]` working copy, `nextFieldId` (ids never reused),
  `version` (last published, 0 = never), `hasUnpublishedChanges`, `deadlineDay` (1–28), audit.
- `ReportFormVersion` — frozen `{ level, version, fields }` per publish (unique level+version).
- `MonthlyReport` — `{ level, year, month, scopeKey, district?, area? }`, `formVersion`,
  `answers` (`f<id>` → value), `numbers[{ fieldId, value }]` (Add-up fields only), `submittedBy/At`,
  `lastEditedBy/At`, `history[{ by, at, action, changed[] }]`, `unlockedUntil/By`.
  Unique `(scopeKey, year, month)`. scopeKey: `state`, `district:<id>`, `area:<groupId>`.
- Field: `{ id, type, label, helpText, placeholder, required, options[], min, max, maxLength, sum,
  condition{ fieldId, operator, value } }`. Operators: equals, not_equals, greater_than, less_than,
  is_empty, is_not_empty. A condition may only reference an earlier field.

## Scope resolution

- Area of an area-level admin: group matching `roleTag.roleDescription` in their district (same rule
  as member scoping), else `roleTag.areaId`, else `user.group`. Unit admins: `user.group`.
- Members: `member.group` / `member.district`.

## API — `/api/monthly-reports`

- `GET /forms` (state admin) — the three forms with draft + version info.
- `PUT /forms/:level` (state admin) — save draft fields + deadline; builder validation.
- `POST /forms/:level/publish` (state admin) — snapshot to a new version.
- `GET /mine?year&month` — caller's scope report, form version, lock state, `canEdit`, `canFill`.
- `PUT /mine?year&month` — create/edit the shared report (fillers, unlocked months, not future).
- `GET /status?year` — caller's scope: submitted months of the year.
- `GET /consolidated?year&month[&district]` — hierarchy-scoped tree + summed totals + missing list.
- `GET /:id` — one report with its frozen form and history (scope-checked).
- `POST /unlock` `{ level, scopeId, year, month }` — higher level only.
- Member: `GET /api/member-auth/area-report?year&month` — area's summed numbers only.

Server validation re-evaluates conditions, drops hidden/unknown answers, checks required, number
range/integers, lengths, option membership, date/time/email/phone format, file shape.

## Frontend

- New `/reports` page (state, district, group admins), tabs:
  - **My Report** — month picker, status (submitted by / edited by / editable until / locked),
    form renderer, Save. Read-only for viewers.
  - **Consolidated** — month picker, district filter (state), submitted counts, totals per level,
    district → area drill-down with status, detail dialog (answers + history), unlock, Excel export.
  - **Setup** (state admin) — level tabs, field list builder (add/edit/reorder/delete, condition,
    Add up), preview, Save draft, Publish, deadline day.
- Member dashboard: "My Targets" replaced by **Area Report** (month picker + totals).
- Dashboards: "admins reporting" now means the admin's scope submitted a monthly report this month
  or last; trend counts submitted reports; "No targets set yet" becomes "No report form yet".

## Removal

Frontend: PersonalTargets, MyTargets, UserTargetsSection, Consolidation (+ service),
MembersGroupReport, target API clients, member targets view, nav entries, routes.
API: personalTargets, userTargetProgress, recurringMarks, memberTargetProgress, consolidation
routes; target endpoints in memberAuth; the four target models; target boot migrations;
recurringConsolidation helper. A script backs up and drops the old collections (run on deploy).

## Testing

Pure modules (field validation, answer validation + conditions, consolidation sums, period/lock)
get Jest tests. End-to-end check against the local API with the QA logins.
