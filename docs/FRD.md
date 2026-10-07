# Functional Requirements Document (FRD)
## SOLIDARITY — Members Management System

| Item | Detail |
|---|---|
| Document | Functional Requirements Document |
| Product | SOLIDARITY Members Management (web app + installable PWA) |
| Version | 1.0 — as-built baseline |
| Date | 28 September 2026 |
| Source of truth | Current codebase: `solidarity-app/` (React frontend) and `solidarity-app/solidarity-api/` (Node/Express API) |
| Status | Draft for review |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Organisation Hierarchy](#3-organisation-hierarchy)
4. [User Roles](#4-user-roles)
5. [Role Capability Matrix](#5-role-capability-matrix)
6. [Functional Requirements](#6-functional-requirements)
   - 6.1 [Authentication & Accounts](#61-authentication--accounts)
   - 6.2 [Dashboards](#62-dashboards)
   - 6.3 [Master Data — Districts & Areas](#63-master-data--districts--areas)
   - 6.4 [Admin User Management](#64-admin-user-management)
   - 6.5 [Member Management](#65-member-management)
   - 6.6 [Member Change Requests](#66-member-change-requests)
   - 6.7 [Member Transfers](#67-member-transfers)
   - 6.8 [Baithul Maal](#68-baithul-maal)
   - 6.9 [Targets](#69-targets)
   - 6.10 [Consolidation](#610-consolidation)
   - 6.11 [Meetings](#611-meetings)
   - 6.12 [Reports (Group / Census Reports)](#612-reports-group--census-reports)
   - 6.13 [Alerts & Announcements](#613-alerts--announcements)
   - 6.14 [Files & Documents](#614-files--documents)
   - 6.15 [Leaders Directory & Role Management](#615-leaders-directory--role-management)
   - 6.16 [Member Self-Service Portal](#616-member-self-service-portal)
   - 6.17 [Navigation & PWA](#617-navigation--pwa)
7. [Business Rules & Calculations](#7-business-rules--calculations)
8. [Data Model Summary](#8-data-model-summary)
9. [External Integrations](#9-external-integrations)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Known Gaps, Issues & Open Questions](#11-known-gaps-issues--open-questions)
12. [Appendix A — API Index](#appendix-a--api-index)

---

## 1. Introduction

### 1.1 Purpose
This document describes what the SOLIDARITY Members Management System does: who uses it, what each user role can do, and the business rules behind each module. It is written from the current implementation so it can serve as the baseline for testing, onboarding, and future change requests.

### 1.2 Scope
In scope: member registry, organisation hierarchy, admin accounts, Baithul Maal (monthly contribution) tracking, targets and recurring targets, consolidation reporting, meetings and attendance, group/census reports, alerts and announcements, document library, leaders directory, member self-service portal, and the PWA shell.

Out of scope: payment gateways (payments are recorded manually by admins), SMS/email delivery (only WhatsApp and in-app are implemented), and any accounting ledger beyond monthly contribution tracking.

### 1.3 Glossary

| Term | Meaning |
|---|---|
| **State** | The whole organisation (default state: Kerala). Managed by State Admins. |
| **District** | First level under the state. Has a unique name and code. |
| **Area** | An organisational unit inside a district. Stored in the database as a **Group** record; the UI calls it "Area" (Master Data), "Group" (Members page) or "Unit" (census report). |
| **Unit** | A single Group when viewed as the smallest scope, e.g. the scope of a unit-level admin or a row in the census report. |
| **Area Admin** | Any admin with role `group_admin`. Shown in the UI as "Area Admin". |
| **Murabi Admin / Coordinator Admin** | Kinds of area-level admin (`adminKind`). Same permissions as Area Admin but a separate login account. |
| **Member** | A registered person in the member registry. Members log in to a separate self-service portal. |
| **Baithul Maal** | Monthly contribution fund. Each enrolled member has a monthly amount; admins record monthly payments. |
| **Target** | A goal set by the State Admin (e.g. Quran reading, charity) for a chosen audience. |
| **Recurring Target** | A perpetual target that is marked complete per period (week or month). |
| **Recurring Mark** | A record that one person completed a recurring target for a given month (or week). |
| **Consolidation** | A report that rolls up target completion for one type of user (e.g. all Unit Admins, all Members) within the viewer's scope. |
| **Monthly Series Meeting** | A meeting programme for one month, made of numbered sessions that each area conducts and records attendance for. |
| **Leader / Role Tag** | A directory designation (State, District, Area, Unit, Murabi, Coordinator leader) shown in the Leaders directory. It does **not** grant permissions. |

---

## 2. System Overview

### 2.1 Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind + shadcn/ui, TanStack Query, React Router. Installable PWA (vite-plugin-pwa). Hosted on Netlify. |
| Backend | Node.js, Express, Mongoose (MongoDB). JWT authentication. Helmet, CORS allow-list, rate limiting (1,000 requests / 15 min per IP outside development). |
| File storage | DigitalOcean Spaces (S3-compatible) with public CDN URLs. |
| Messaging | MsgHex WhatsApp gateway for login OTPs and WhatsApp notifications. |
| Exports | Client-side Excel (xlsx), PDF (jsPDF) and CSV; server-side CSV for some reports. |

### 2.2 Applications

1. **Admin web app** — for State, District and Area Admins. Sidebar on desktop, bottom navigation on mobile.
2. **Member portal** — the same web app, but a member login lands on `/member-dashboard`, which has its own views.

Both are served from one codebase and one login screen. A single phone number can own several accounts (for example a District Admin account and a Member account); the user chooses which account to enter after verifying the OTP and can switch later without logging in again.

---

## 3. Organisation Hierarchy

```
State (State Admins)
 └── District (District Admin)                       e.g. Malappuram East
      └── Area  [stored as Group]                    e.g. Kottakkal
           ├── Area-level admins: Area / Murabi / Coordinator Admin
           ├── Unit-level admin (legacy, one Group only)
           └── Members
```

**Scope rules**

- **State Admin**: everything.
- **District Admin**: every area and member whose `district` is their district.
- **Area-level admin** (role `group_admin` and either leader tag type `area` or admin kind `murabi` / `coordinator`): every Group **in their own district whose name matches their area name** (`roleTag.roleDescription`, case-insensitive, exact match). This is resolved at request time.
- **Unit-level admin** (any other `group_admin`): only their single assigned Group.
- **Member**: only their own records.

> The area scope depends on an exact name match between the admin's area name and Group names. If a Group is renamed, the area admin loses sight of it.

---

## 4. User Roles

The system has **four login roles**. The third role (`group_admin`) has two scopes and three kinds, so there are six distinct admin personas in practice.

| # | Role (system) | Display label | Count per scope | Purpose |
|---|---|---|---|---|
| 1 | `state_admin` | State Admin | Many | Runs the organisation state-wide: master data, admin accounts, targets, announcements, document library, final transfer approval. |
| 2 | `district_admin` | District Admin | One or more per district | Runs one district: members, areas, first-level transfer approval, meetings, Baithul Maal, reports and consolidation for the district. |
| 3 | `group_admin` | Area Admin | One or more per area | Runs one area (or one unit): registers members, records Baithul Maal, conducts meeting sessions and attendance, marks own targets, raises transfers. |
| 4 | `member` | Member | One per member | Self-service: profile, own targets, own Baithul Maal, meetings, alerts, leaders, documents. |

### 4.1 State Admin
**Purpose.** Owns the whole system and its configuration.

**Can:**
- Manage master data: create, edit and delete districts and areas.
- Create, edit, activate/deactivate and delete admin accounts of every role.
- Create, edit and delete **targets** and **recurring targets** for any audience. State Admins never receive targets themselves.
- View and manage members state-wide; add members (auto-approved); approve pending members; delete members (State Admin only).
- Move a member directly to any district/area, and give the **final approval** on transfer requests (which completes the move).
- Create meetings for all districts, district admins only, or chosen districts; see progress of every area.
- Send announcements to any audience; edit and delete announcements.
- Upload, edit, hide and delete documents in the Files & Documents library (sole uploader).
- Run consolidation for all six user types, state-wide or filtered by district/area.
- See all Baithul Maal data and reports; assign leader role tags of any type.

### 4.2 District Admin
**Purpose.** Manages one district.

**Can (limited to own district):**
- View, add, edit members; approve pending members (API allows it; see §11); move members directly between areas **inside** the district.
- Create, edit and delete areas (Groups) in the district.
- Approve or reject transfer requests where the district is the source or the target.
- Create monthly series meetings (audience is forced to "own district"); view progress and attendance for all areas in the district.
- Send announcements to Area Admins and/or Members of the district.
- Manage Baithul Maal for district members.
- Run consolidation for Area, Murabi, Coordinator and Unit Admins and Members of the district.
- Receive and mark targets addressed to District Admins or All Users (**My Targets**); a mark is copied to the other District Admins of the same district.
- List admin accounts of the district; assign leader tags (District, Area, Unit, Murabi, Coordinator) to people in the district.

**Cannot:** manage districts, create admin accounts, create targets, upload documents, delete members, give final transfer approval.

### 4.3 Area Admin (`group_admin`)
**Purpose.** Front-line administrator of an area.

**Scopes and kinds**

| Variant | How identified | Scope | Targets received |
|---|---|---|---|
| Area Admin (area-level) | `roleTag.type = area` | All Groups in the district named like the area | All Users, Area Admins, Group & Area Admins |
| Murabi Admin | `adminKind = murabi` | Same as Area Admin | Same as Area Admin |
| Coordinator Admin | `adminKind = coordinator` | Same as Area Admin | Same as Area Admin |
| Unit Admin (unit-level) | Any other `group_admin` | One assigned Group | All Users, Group Admins, Group & Area Admins |

All four variants have identical permissions and are all labelled "Area Admin" in the UI. Murabi and Coordinator accounts exist so the same person can hold more than one area-level account on one phone number. The kinds matter only for target audiences, consolidation rows and account pickers.

**Can (limited to own area or unit):**
- View and add members (new members are **pending approval**); edit member details directly.
- Raise **transfer requests** to move a member to another area or district (only Area Admins can raise them).
- Approve or reject member **profile-change requests** (name/phone) on the Requests page.
- Enrol members in Baithul Maal, set monthly amounts, and record, edit or remove monthly payments.
- See meetings addressed to them; record member attendance and guests for each session; mark sessions as completed for their area.
- Send announcements to their own Group only.
- Mark their own targets (**My Targets**). Area-level admins also record **member attendance** for recurring targets that require it. A mark is copied to co-admins of the same kind in the same area.
- Run consolidation for Unit Admins and Members in scope.
- View group/census reports for their scope; assign leader tags (Area, Unit, Murabi, Coordinator) inside their scope.
- View the Leaders directory and Files & Documents, including membership forms.

**Cannot:** approve new members, delete members, move members directly, create meetings, create targets, upload documents, manage areas or districts.

### 4.4 Member
**Purpose.** A registered member using the self-service portal.

**Can:**
- Log in only if their member record is **Active** and **approved**.
- View their profile and edit personal fields (email, profession, education, address, blood group, age, interests, skills, photo). Name and phone changes go through a **change request** approved by their Area Admin.
- View targets addressed to All Users or Members Only; mark status (Not Started / In Progress / Completed), add feedback and attach a proof file; mark recurring targets per month/week.
- View their Baithul Maal summary and payment history (read-only).
- View meetings addressed to everyone, their district or their group (read-only).
- Read alerts and announcements addressed to members, their group or their district.
- Browse the Leaders directory (own area → own district → state) and general documents.

**Cannot:** see other members' data, record payments or attendance, or access any admin screen.

### 4.5 Leader Role Tags (not a login role)
Any admin or member can be flagged as a **Leader** with a primary tag and optional extra tags. Tag types: **State, District, Area, Unit, Murabi, Coordinator**, each with a display name (e.g. "President", "Secretary") and an optional listing order. Tags only control the Leaders directory. They do not grant access, with one exception: for a `group_admin`, a primary tag of type `area` makes the account **area-level** (see §4.3).

### 4.6 Permission Flags
Permission flags are set automatically by role and checked by the API:

| Permission | State | District | Area |
|---|:-:|:-:|:-:|
| manage_users | ✔ | | |
| manage_members | ✔ | ✔ | ✔ |
| manage_districts | ✔ | | |
| manage_groups | ✔ | ✔ | |
| approve_transfers | ✔ | ✔ | |
| send_notifications | ✔ | ✔ | |
| view_reports | ✔ | ✔ | ✔ |
| manage_meetings | ✔ | ✔ | |
| manage_baithul_maal | ✔ | ✔ | ✔ |

---

## 5. Role Capability Matrix

Legend: **All** = state-wide · **Dist** = own district · **Area** = own area/unit · **Self** = own record · — = no access

| Capability | State Admin | District Admin | Area Admin | Member |
|---|---|---|---|---|
| Login via phone OTP | ✔ | ✔ | ✔ | ✔ (Active + approved only) |
| Manage districts | All | — | — | — |
| Manage areas (Groups) | All | Dist | — | — |
| Create/edit admin accounts | All | — (list only, Dist) | — | — |
| View members | All | Dist | Area | Self |
| Add member | All (auto-approved) | Dist (pending) | Area (pending) | — |
| Edit member | All | Dist | Area | Self (limited fields) |
| Approve member | All | Dist (API) | — | — |
| Delete member | All | — | — | — |
| Export member list (Excel/PDF) | All | Dist | Area | — |
| Move member directly | All | Within Dist | — | — |
| Raise transfer request | — | — | Area | — |
| Approve transfer | Final (completes) | Source/target step | — | — |
| Approve profile-change request | ✔ | ✔ | ✔ | Raise only |
| Baithul Maal: enrol / set amount | All | Dist | Area | — |
| Baithul Maal: record/edit/remove payment | All | Dist | Area | — |
| Baithul Maal: view | All | Dist | Area | Self |
| Create/edit/delete targets | ✔ | — | — | — |
| Receive & mark own targets | — | ✔ | ✔ | ✔ |
| Record attendance on recurring targets | — | — | Area-level only | — |
| Consolidation report | 6 user types, All | 5 types, Dist | Unit Admins + Members, Area | — |
| Create meetings | All audiences | Own district only | — | — |
| Record session attendance / complete session | ✔ (global) | ✔ (Dist, global) | ✔ (Area, per area) | — |
| Meeting progress overview | All | Dist | Own sessions | View upcoming |
| Group / census reports | All | Dist | Area | — |
| Send announcement | Any audience | Area Admins / Members in Dist | Own Group | — |
| Edit/delete announcement | ✔ | — | — | — |
| Upload/manage documents | ✔ | — | — | — |
| View documents | All incl. hidden | General | General + membership forms | General |
| Assign leader tags | All types | District, Area, Unit, Murabi, Coordinator (Dist) | Area, Unit, Murabi, Coordinator (Area) | — |
| Leaders directory | All | All | All | Own group → district → state |

---

## 6. Functional Requirements

Each requirement has an ID (`FR-<module>-<nn>`). "Shall" states current system behaviour.

### 6.1 Authentication & Accounts

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The user shall sign in with a mobile number. Indian 10-digit numbers starting 6–9 are accepted with or without `+91`, `91` or a leading `0`; the number is normalised to 10 digits. |
| FR-AUTH-02 | The system shall find every account on that number: active admin accounts (any role/kind) and a member record that is **Active and approved**. If none exist, it shall reply "not registered" and send no code. |
| FR-AUTH-03 | The system shall send a **4-digit OTP** by WhatsApp (MsgHex). The OTP is valid for **10 minutes** (configurable), stored hashed, and one code unlocks every account on the number. |
| FR-AUTH-04 | A resend shall be refused for **60 seconds** after the previous send. |
| FR-AUTH-05 | Verification shall allow at most **5 wrong attempts**; after that the code is discarded and a new one must be requested. |
| FR-AUTH-06 | After a correct OTP, the system shall return a 10-minute selection ticket and the list of accounts, ordered State → District → Area → Member. If only one account exists, it is entered automatically. |
| FR-AUTH-07 | The account picker shall show role label, scope (district • area) and last login for each account. |
| FR-AUTH-08 | Selecting an account shall re-check that it is still active/approved and then issue a JWT valid for **365 days** (configurable). Admin and member tokens are separate token types. |
| FR-AUTH-09 | A signed-in user shall be able to **switch account** from the sidebar or "More" menu to any other account on the same number without a new OTP. |
| FR-AUTH-10 | Logout shall clear the token on the device. Deactivating an account blocks its next request (the token is rejected because the account is inactive). |
| FR-AUTH-11 | Each role shall land on its home page: State → `/state-admin`, District → `/district-admin`, Area → `/dashboard`, Member → `/member-dashboard`. Opening a page the role may not use redirects to its home page. |
| FR-AUTH-12 | The legacy member-only OTP flow (`/api/member-auth/*`) shall lock a member for **2 hours** after 5 failed attempts. |

### 6.2 Dashboards

| ID | Requirement |
|---|---|
| FR-DASH-01 | **State Admin dashboard** shall show KPI cards: Monthly Baithul Maal collection (with contributing count), Pending Actions (pending requests), Districts (total/active), Admins (total/active); an analysis row (Total Members, Active Members with %, Groups, Baithul Maal); a "Needs attention" block (pending approvals, upcoming meetings); and quick-action tiles to every admin module. Cards link to their modules. |
| FR-DASH-02 | **District Admin dashboard** shall show Groups, Total Members, Active Members and Pending Transfers for the district; quick actions; the admin's own targets; and the list of transfers awaiting this district's approval with Approve (optional comment) and Reject (required reason) actions. |
| FR-DASH-03 | **Area Admin dashboard** shall show Total Members, Active Members, Pending Requests and Upcoming Meetings for the scope; quick actions (Files, Group Reports, Role Management, Consolidation, Baithul Maal, My Targets); own targets; and the next three meetings. |
| FR-DASH-04 | Dashboard figures shall be scoped by the role rules in §3. |
| FR-DASH-05 | **Member dashboard** — see §6.16. |

### 6.3 Master Data — Districts & Areas

| ID | Requirement |
|---|---|
| FR-ORG-01 | The State Admin shall create, edit and delete **districts** (name unique, code 2–10 letters/digits unique and upper-case, active flag, optional description and contact details). |
| FR-ORG-02 | A district shall not be deleted while it has areas or members. |
| FR-ORG-03 | State Admins (any district) and District Admins (own district) shall create, edit and delete **areas/Groups** (name, code unique within the district, optional admin, meeting schedule, contact, active flag). |
| FR-ORG-04 | An area shall not be deleted while it has members. |
| FR-ORG-05 | The Master Data page shall have two tabs, **Districts** and **Areas**, with search, a district filter for areas, and summary counts (districts, areas, members). District Admins open the same page with only their own district’s areas (no tabs, no district filter). It is the only page for districts and areas; the old Districts and Groups links redirect to it. |
| FR-ORG-06 | District and area statistics (total members, active members, groups, total monthly Baithul Maal) shall be recalculated when a district or area is opened. |

### 6.4 Admin User Management

| ID | Requirement |
|---|---|
| FR-USR-01 | Only the State Admin shall create admin accounts. Required: name (2–100), 10-digit phone, role. District Admins need a district; Area Admins need a Group. |
| FR-USR-02 | An account is unique on (phone, role, admin kind), so one person can hold several roles or several area-level kinds. |
| FR-USR-03 | Default permission flags shall be assigned from the role (§4.6). |
| FR-USR-04 | The State Admin shall edit any account (name, email, role, district, group, active flag). Any admin may edit only their own name and email. |
| FR-USR-05 | The State Admin shall activate/deactivate and delete accounts, but not their own. |
| FR-USR-06 | The admin list shall support search (name/phone/email) and filters for role, admin kind, district, group and active status, with pagination. District Admins see only accounts in their district. |

### 6.5 Member Management

**Member record fields.** Name*, phone* (unique, stored with `+91`), district*, area/Group*, status, email, date of birth (age calculated), blood group (A±, B±, AB±, O±), profession, education, address, area of interest, skills, photo, emergency contact, notes, monthly Baithul Maal amount, joined date, approval information, leader tags.

**Member statuses.** Active, Inactive, Abroad, Applicant, Age over, Dismissed.

| ID | Requirement |
|---|---|
| FR-MEM-01 | The member list shall be scoped by role (§3), paginated (10/20/50/100 per page) and searchable by name, phone or email (from 2 characters). |
| FR-MEM-02 | Filters: status (plus "Pending Approval"); district (State Admin); area (State and District Admin). Status/approval counts shall appear as badges. |
| FR-MEM-03 | Each member card shall show status, approval state, a pending-transfer badge, contact details and actions: Edit, Move/Transfer, Baithul Maal, Details. |
| FR-MEM-04 | **Add member**: Area Admins' district and area are fixed to their own; District Admins pick an area in their district; State Admins pick any district and area. Phone must be unique in every format (`+91…`, `91…`, bare). |
| FR-MEM-05 | A member added by a **State Admin is auto-approved**; members added by District or Area Admins are **pending approval**. |
| FR-MEM-06 | **Approve**: the State Admin (UI) or District Admin (API, own district) shall approve a pending member, which also sets status to Active if it was Inactive or Applicant. |
| FR-MEM-07 | **Edit member**: admins with scope shall edit profile fields and status directly. Editing does not change the approval state. District Admins may change the area only inside their district. |
| FR-MEM-08 | **Delete member**: State Admin only. |
| FR-MEM-09 | **Member detail** shall show contact, personal, professional and organisation details, Baithul Maal summary with monthly payment table, and meeting-attendance summary; and offer Call, Email, Edit and "Download Certificate" (printable HTML). |
| FR-MEM-10 | **Export** shall download all filtered members (across pages) as Excel or PDF with Name, Phone, Email, Status, District, Group, Approved, Joined. |

### 6.6 Member Change Requests

| ID | Requirement |
|---|---|
| FR-REQ-01 | A member shall request a change of **name and/or phone** from the portal, with an optional note. Only one pending request per member is allowed. |
| FR-REQ-02 | Member-raised requests shall be routed to the **Area Admin level**; Area, District or State Admins may approve or reject. |
| FR-REQ-03 | Admin-raised requests shall be routed as follows: member edit by an Area Admin → District level; Baithul Maal update by an Area Admin → District level; transfers and everything else → State level. |
| FR-REQ-04 | Approving shall apply the proposed values to the member record. Rejecting shall require a reason (5–500 characters). Comments may be added. |
| FR-REQ-05 | The **Requests** page (Area Admin menu) shall list pending requests with type, member, requester, date and changed fields, and Approve / Reject buttons. |
| FR-REQ-06 | Requests carry a 30-day expiry date (see §11: not enforced automatically). |

### 6.7 Member Transfers

**Workflow**

```
Area Admin raises request (reason ≥ 10 chars)
        │
        ▼
 status: pending
   ├─ Source District Admin approves
   └─ Target District Admin approves   (auto-approved when source = target district)
        │  both approved
        ▼
 status: district_approved
        │  State Admin approves ("Approve & Complete")
        ▼
 status: completed  → member's district and area are updated
 Any District/State Admin may reject at any stage → status: rejected (reason required)
```

| ID | Requirement |
|---|---|
| FR-TRF-01 | An **Area Admin** shall raise a transfer request only for a member of their own group, only to a different group, and only if the member has no open request. A **District Admin** may raise one only for a member of their own district, only to a different district, and only if the member has no open request; it skips district approval (both sides auto-approved) and goes straight to the State Admin. |
| FR-TRF-02 | Within-district transfers shall need the district approval once; cross-district transfers need both the source and target District Admins, in any order. |
| FR-TRF-03 | The State Admin's approval shall complete the transfer and move the member. |
| FR-TRF-04 | A rejection (5–500 character reason) by any eligible admin shall end the request. |
| FR-TRF-05 | In-app notifications shall be generated: on creation (District Admins; State Admins for a District Admin's request), when one district side approves and the other is waiting (District Admins), when both districts approve (State Admins), on completion (the requester's role: Area or District Admins), and on rejection (the requester's role, with the reason). |
| FR-TRF-06 | The **Transfer Approvals** page (State and District Admins) shall show counts (pending, cross-district, waiting on state) and, per request: member, from/to district and area, reason, requester, and the status of each approval step. |
| FR-TRF-07 | Queues: District Admins see requests waiting for their district's decision; the State Admin sees requests in `district_approved`; Area Admins see their own open requests. A pending-count badge is shown in navigation. |
| FR-TRF-08 | State and District Admins may instead **move** a member directly from the member list (District Admins only within their district, and not while the member has an open request; choosing another district raises a request per FR-TRF-01). This skips the approval workflow. A District Admin's move changes only the group and unit — the one member change open to them while member editing is State-Admin-only. |
| FR-TRF-09 | A move or transfer request may set a new **unit** (up to 100 characters); blank keeps the current unit. On a request, the unit is applied when the State Admin approves. |

### 6.8 Baithul Maal

Baithul Maal is the monthly contribution fund. Each enrolled member has a fixed **monthly amount**; admins record one payment per member per month.

#### 6.8.1 Enrolment

| ID | Requirement |
|---|---|
| FR-BM-01 | An admin with scope shall **enrol** a member by searching (name or phone, from 2 characters), entering a **monthly amount** (whole rupees, 1–10,000) and choosing a **start month** (from 24 months back to 2 months ahead). |
| FR-BM-02 | The start month defines when dues begin. Pending dues are counted from the start month, not the joining date. If no start month is chosen, the date the amount was first set is used. |
| FR-BM-03 | Setting the monthly amount to 0 un-enrols the member from Baithul Maal lists. |
| FR-BM-04 | Only members who are **Active, approved, and have a monthly amount > 0** appear in Baithul Maal lists and statistics. |

#### 6.8.2 Recording payments

| ID | Requirement |
|---|---|
| FR-BM-05 | An admin shall record a **payment** with member, amount (> 0), **payment month** (YYYY-MM), payment date (default today) and optional description. |
| FR-BM-06 | Only **one active payment per member per month** is allowed; a second one for the same month is rejected. |
| FR-BM-07 | **Quick status** dialog: for a chosen month (from the member's start month to next month), show "Received (₹amount)" or "Pending". "Mark as Received" creates a payment of the monthly amount for that month dated today; "Mark as Not Received" removes that month's payment. |
| FR-BM-08 | The **payment dialog** shall let the admin add, edit and delete payments and view the member's payment history (amount, month, date, recorded by, description). |
| FR-BM-09 | Deleting a payment is a **soft delete** (kept, marked inactive). |
| FR-BM-10 | After any payment is added, changed or removed, the member's **Total Paid** and **Last Payment Date** shall be recalculated from the active payments. |
| FR-BM-11 | Each payment shall record who recorded it and who last changed it. Payment type (monthly/arrears/advance/special) and method (cash/bank/UPI/cheque/other) exist in the data model; the UI always uses monthly/cash. |

#### 6.8.3 Views and reporting

| ID | Requirement |
|---|---|
| FR-BM-12 | The **Baithul Maal** page (all admins, scoped) shall show summary cards: Contributing Members, Monthly Target (sum of monthly amounts), Total Collected (sum of Total Paid), Average per Member. |
| FR-BM-13 | It shall have four views: **Members** (monthly, paid, pending, last payment, status, edit), **Payments** (amount, date, month, recorded by, description), **Groups** (members, monthly target, collected, average per area), **Monthly** (collected, payment count, average and growth vs previous month). |
| FR-BM-14 | Filters: district (State Admin) and month. Page size 10/20/50/100. |
| FR-BM-15 | Status per member: **Pending** when pending amount > 0, otherwise **Up to Date**. |
| FR-BM-16 | **Export** shall download the current view as CSV (`baithul-maal-<view>-<date>.csv`). |
| FR-BM-17 | The API shall also provide statistics (amount distribution bands, per-area totals, recent payments) and a **defaulters** list (pending ≥ a threshold, default ₹100, largest first). |
| FR-BM-18 | Members shall see (read-only) their monthly amount, total paid, pending amount, number of payments, last payment date, and payment history by month. |

#### 6.8.4 Access

| Action | Permission required | Roles |
|---|---|---|
| View lists, enrol, set amount, statistics, defaulters | `manage_baithul_maal` | State, District, Area (scoped) |
| Create / edit / delete payment records | `manage_members` | State, District, Area (scoped) |
| View own data | member login | Member |

### 6.9 Targets

Targets are created only by the State Admin. There are two kinds:

| | Regular target | Recurring target |
|---|---|---|
| Time frame | Start and end date/time | Open-ended (start = 1 Jan of the year it was saved, end = 2099) |
| Tracking | One status per person: Not Started / In Progress / Completed, with feedback and file | One mark per person per **month** (monthly/quarterly) or per **week 1–5** (weekly) |
| Extras | Instructions, rewards | Instructions, rewards, optional **attendance** |

**Categories:** Quran, Hadith, Prayer, Charity, Knowledge, Community, Other.

**Audiences** (who receives the target):

| Audience | District Admin | Area-level Admin | Unit Admin | Member |
|---|:-:|:-:|:-:|:-:|
| All Users | ✔ | ✔ | ✔ | ✔ |
| Members Only | | | | ✔ |
| District Admins | ✔ | | | |
| Area Admins | | ✔ | | |
| Group Admins | | | ✔ | |
| Group & Area Admins | | ✔ | ✔ | |

State Admins never receive targets.

| ID | Requirement |
|---|---|
| FR-TGT-01 | The State Admin shall create, edit and delete regular targets (title, category, description, start/end, audience, active flag, instructions, rewards). |
| FR-TGT-02 | The State Admin shall create, edit and delete recurring targets (title, category, frequency weekly/monthly/quarterly, audience, active flag, **attendance needed** flag, instructions, rewards). |
| FR-TGT-03 | The audience shall be **locked after creation**. |
| FR-TGT-04 | Targets shall be listed in two tabs (Regular / Recurring) with search, audience filter and pagination. Regular target status shows Active, Scheduled (not started yet), Expired or Inactive. |
| FR-TGT-05 | Recipients shall see only **active** targets for their audience; regular targets only while now is between start and end. |
| FR-TGT-06 | **My Targets** (District and Area Admins) and the member Targets view shall let the recipient set status In Progress / Completed, write feedback, attach a proof file (up to 20 MB: images, PDF, Office, text, MP4/MPEG video, MP3/WAV audio) and save. |
| FR-TGT-07 | Recurring targets shall show a year selector and a grid of months (monthly/quarterly) or weeks of a chosen month (weekly), with a count "X of Y marked" and a progress bar. |
| FR-TGT-08 | **Admin marking window**: admins may mark only the **current or previous month**; older months are read-only and future months are closed. (Enforced in the admin UI.) |
| FR-TGT-09 | **Member marking**: members may mark any past or current period; future periods are closed. |
| FR-TGT-10 | Monthly marks may carry a **completion count** (0–99) to record more than one completion in a month. |
| FR-TGT-11 | **Co-admin sync**: when a District Admin marks a recurring target, the mark is copied to all District Admins of the same district. When an area-level admin marks it, the mark is copied to co-admins **of the same kind** (Area→Area, Murabi→Murabi, Coordinator→Coordinator) in the same area and district. |
| FR-TGT-12 | **Attendance on recurring targets**: when a recurring target has "attendance needed" and an **area-level admin** marks a month, a dialog shall list area members and area leaders (20 per page, "load more") to tick who was present. Submitting marks the month complete and stores attendance. Opening a marked month offers "Unmark", which clears the mark and attendance. Attendance applies to month-level marks only. |
| FR-TGT-13 | Any completed recurring mark shall set the person's overall progress record for that target to Completed; removing all marks sets it back to Not Started. |
| FR-TGT-14 | Deleting a target shall delete its member progress records. |

### 6.10 Consolidation

Consolidation answers: *for one target, which people of a given type in my scope have completed it, and which have not?*

#### 6.10.1 Who can consolidate what

| Viewer | User types available | Scope |
|---|---|---|
| State Admin | District Admin, Area Admin, Murabi Admin, Coordinator Admin, Unit Admin, Members | State-wide; optional district and area filters |
| District Admin | Area Admin, Murabi Admin, Coordinator Admin, Unit Admin, Members | Own district; optional area filter |
| Area Admin (any kind) | Unit Admin, Members | Own area (area-level) or own group (unit-level); optional area filter inside the area |

A request for a user type outside the viewer's list shall be refused (403).

#### 6.10.2 Inputs

| ID | Requirement |
|---|---|
| FR-CON-01 | The viewer shall pick a **user type**, then a **target**. The target list shows only **active** targets whose audience reaches that user type (e.g. Members → All Users and Members Only). |
| FR-CON-02 | The viewer may filter by **district** (State Admin) and **area** (all). |
| FR-CON-03 | The period shall be **All Time** or a **Custom Range** of months (from/to month picker). "Generate" is disabled until a custom range is complete. |

#### 6.10.3 Who is counted

| User type | Population counted |
|---|---|
| District Admin | Active `district_admin` accounts in scope |
| Area Admin | Active `group_admin` accounts with area tag, excluding Murabi/Coordinator |
| Murabi Admin / Coordinator Admin | Active `group_admin` accounts of that kind |
| Unit Admin | Active `group_admin` accounts that are **not** area-level |
| Members | Members that are **Active and approved** in scope |

#### 6.10.4 Calculation rules

| ID | Requirement |
|---|---|
| FR-CON-04 | **Regular target**: a person is **Completed** if their progress record's status is Completed; otherwise **Pending** (with Not Started or In Progress status, last activity, and progress % for members). With a custom range, only progress records **updated within the range** are considered. |
| FR-CON-05 | **Recurring target**: the period is the custom range, or for All Time the target's start month up to the current month. Each calendar month in the period is one **period**. A month counts as done if the person has **at least one completed mark** in that month (for weekly targets, one marked week is enough for the month). |
| FR-CON-06 | For recurring targets, a person is **Completed** only if **every month** in the period is done. Otherwise they are **Pending** with status **Partial** (some months done) or **Not Started** (none), plus done count, total periods and the list of done months. |
| FR-CON-07 | **Summary** = Total Users, Completed, Pending, and **Completion Rate = Completed ÷ Total × 100**, rounded to one decimal. |
| FR-CON-08 | **Monthly breakdown**: for recurring targets, every month in the period with done / not done / rate. For regular targets, shown only when a custom range spans more than one month, using the completion date. |

#### 6.10.5 Output

| ID | Requirement |
|---|---|
| FR-CON-09 | The report shall show the summary strip, the monthly breakdown (months are clickable for recurring targets to filter the list), and **Completed / Pending** tabs listing #, name, phone, district, area/group and status or completion date, with a progress bar for partial recurring completion. Rows expand to show role, last activity and done/missed months. |
| FR-CON-10 | **Export to Excel** (`consolidation-report-YYYY-MM-DD.xlsx`) with sheets: Summary (report details, overall and per-district figures, monthly summary), All Members (month-by-month ✅/❌ matrix for recurring targets), District Details (submitted / not submitted per district), Monthly Details (recurring only), and Quick Status (submitted vs need follow-up). |

### 6.11 Meetings

The main meeting type is the **Monthly Series**: a programme for one month made of numbered sessions. Every area in the audience conducts each session and records attendance.

#### 6.11.1 Creating meetings

| ID | Requirement |
|---|---|
| FR-MTG-01 | State and District Admins shall create a monthly meeting: title (5–200), description (10–1,000), month, year, optional attachment (up to 10 MB: images, PDF, Word, Excel, PowerPoint, text) and **one or more sessions** (title, description, duration 30–240 minutes). Sessions are numbered 1, 2, 3… |
| FR-MTG-02 | Audience options for the State Admin: Everyone, District Admins only, or Specific Districts. A District Admin's meeting is always limited to their own district. |
| FR-MTG-03 | The creator or a State Admin shall edit meeting details (title, description, date, duration, status) and session details, upload session attachments, and delete the meeting. |
| FR-MTG-04 | Meeting status: Scheduled, Ongoing, Completed, Cancelled, Postponed. |

#### 6.11.2 Visibility

| Viewer | Sees meetings where audience is… |
|---|---|
| State Admin | All meetings |
| District Admin | Everyone, District Admins, their district, or created by them |
| Area Admin | Everyone, Group Admins, their group, or their district |
| Member | Everyone, their group, or their district (scheduled meetings, read-only) |

#### 6.11.3 Conducting sessions

| ID | Requirement |
|---|---|
| FR-MTG-05 | An Area Admin shall open a meeting and, per session, see their scope's active approved members pre-loaded as **absent**, and mark each member **present or absent** (API also supports late and excused), with search by name/phone. |
| FR-MTG-06 | The Area Admin shall add **guests** (name 2–100, optional 10-digit phone, organisation, status, notes). |
| FR-MTG-07 | The Area Admin shall mark a session **completed for their area**. Completion is stored per area, so one area finishing does not complete it for others. The first area's completion also marks the session "conducted" overall. State/District Admins completing a session complete it globally. |
| FR-MTG-08 | Bulk actions: initialise attendance, mark all absent members present, and complete all sessions that have at least one person present. |
| FR-MTG-09 | Area Admins may mark attendance only for members in their scope; District Admins only within their district. |

#### 6.11.4 Monitoring

| ID | Requirement |
|---|---|
| FR-MTG-10 | The **Meetings overview** (State and District Admins) shall list meetings with totals of areas, conducted, pending and completed, with search and filters for status and completion. |
| FR-MTG-11 | The meeting detail shall show overall progress (total areas, programmes conducted, not conducted, fully completed), a per-district roll-up, and a per-area table: sessions completed/total, members, present, absent, abroad, guests, attendance %, status. |
| FR-MTG-12 | An area counts as having **conducted** a session if it marked the session complete or recorded any attendance. Completion rate = completed sessions ÷ total sessions. Attendance rate = (present + late members + present guests) ÷ (members + guests). |
| FR-MTG-13 | The Area Admin meeting list shall show, per meeting, session progress, participants, attendance % colour-coded (good ≥ 80%, average ≥ 60%, poor < 60%), and a "Manage Attendance" action. |
| FR-MTG-14 | Members shall see up to five upcoming meetings with date, duration, venue, type and agenda. |

### 6.12 Reports (Group / Census Reports)

| ID | Requirement |
|---|---|
| FR-RPT-01 | The **Group Reports** page (all admins) shall show totals: Total, Active, Inactive, Abroad, Applicant members, and Total monthly Baithul Maal. |
| FR-RPT-02 | It shall list **districts** in scope with unit (area) count, total, active, inactive, abroad, applicant members and monthly Baithul Maal; each district expands to its **units/areas** with the same columns. Paginated (10/20/50/100). |
| FR-RPT-03 | Non-State Admins shall see their own district expanded automatically. The State Admin can filter by district. |
| FR-RPT-04 | **Export** shall download a member CSV for the scope: name, phone, email, DOB, age, blood group, profession, education, address, district, group, status, monthly Baithul Maal, total paid, joined date, approved. |
| FR-RPT-05 | The API also provides members, Baithul Maal, activity (last N days) and attendance reports (attendance: State and District Admins only; CSV/JSON export). These have no dedicated screen yet. |

### 6.13 Alerts & Announcements

| ID | Requirement |
|---|---|
| FR-NOT-01 | One **Alerts** page shall list announcements and system alerts for the viewer, newest first. |
| FR-NOT-02 | State Admins shall compose announcements (title, message, type, priority, attachments) for one or more audiences: Everyone, State Admins, District Admins, Area Admins, Members, specific districts or specific groups. |
| FR-NOT-03 | District Admins shall compose announcements only for **Area Admins and/or Members of their district**. |
| FR-NOT-04 | Area Admins shall compose announcements only for **their own group**; the audience is fixed. |
| FR-NOT-05 | Only the State Admin shall edit or delete announcements and view delivery statistics. |
| FR-NOT-06 | Members shall see sent notifications addressed to members/everyone, their group, their district or themselves; admin-only notifications shall never reach members. |
| FR-NOT-07 | A **bell** on admin dashboards shall show a red dot when a notification is newer than the last time the user opened Alerts on that device. |
| FR-NOT-08 | Supported channels: **in-app** and **WhatsApp** (MsgHex, with type emoji prefixes and bulk sends). |
| FR-NOT-09 | The system shall create in-app alerts automatically for transfer events (§6.7). |

### 6.14 Files & Documents

| ID | Requirement |
|---|---|
| FR-DOC-01 | Only the State Admin shall upload documents (title, category, description, visibility) or add **links**. Files up to 50 MB: images, PDF, Word, Excel, audio (MP3/WAV/OGG/MP4), video (MP4/MPEG/QuickTime), text. |
| FR-DOC-02 | Categories: Constitution, Guidelines, Video, Audio, Document, Link, Other. |
| FR-DOC-03 | File type **General** is visible to every signed-in user; **Membership Form** is visible only to State and Area Admins. |
| FR-DOC-04 | The State Admin may **hide** a document; hidden documents are visible only to State Admins. |
| FR-DOC-05 | Users shall browse by category tab, search by title/description/file name, preview (images, audio, video, PDF inline; Office files via Office Online) and download. Malayalam file names shall display correctly. |
| FR-DOC-06 | The State Admin shall edit document details and delete documents (also removing the stored file). |

### 6.15 Leaders Directory & Role Management

| ID | Requirement |
|---|---|
| FR-LDR-01 | **Role Management** (all admins) shall list people in the admin's scope and let the admin set **Leader on/off**, a **primary role tag** (type, name, listing order) and **extra role tags**, then save. |
| FR-LDR-02 | Allowed tag types: State Admin → all six; District Admin → District, Area, Unit, Murabi, Coordinator (own district); Area Admin → Area, Unit, Murabi, Coordinator (own area/group). |
| FR-LDR-03 | Turning Leader off shall clear all role tags. A blank listing order means "no order" (sorted last). |
| FR-LDR-04 | The **Leaders** page (all roles) shall list leaders with filters for role type (Area includes Murabi and Coordinator), district, area and search. Someone with several tags appears once per tag. Duplicates across admin and member records are merged by phone. |
| FR-LDR-05 | Sort order: listing order, then tag type, then name. For members, leaders are grouped by relevance: own area, then own district, then state. |

### 6.16 Member Self-Service Portal

Views: **Overview, Targets, Meetings, Baithul Maal, Alerts, Leaders, Files, Profile**.

| ID | Requirement |
|---|---|
| FR-MBR-01 | **Overview** shall show a profile summary, Baithul Maal paid/pending card, counts and shortcuts for targets and meetings, recent targets, upcoming meetings and recent alerts. |
| FR-MBR-02 | **Profile** shall show all member details. Editable: email, profession, education, address, blood group, age, area of interest, skills, photo. Name and phone shall be changed through a change request (§6.6). |
| FR-MBR-03 | **Targets** shall list active targets for All Users / Members Only, newest first, with status buttons, feedback and file upload (§6.9), and recurring targets with a month/week grid. |
| FR-MBR-04 | **Baithul Maal** (loaded on first open) shall show monthly amount, total paid, pending, number of payments, last payment and history. |
| FR-MBR-05 | **Meetings**, **Alerts**, **Leaders**, **Files** shall follow §6.11, §6.13, §6.15 and §6.14 (members see General documents only). |
| FR-MBR-06 | Members shall log out from the profile menu with confirmation. |

### 6.17 Navigation & PWA

| ID | Requirement |
|---|---|
| FR-NAV-01 | Desktop: a sidebar with sections **Management**, **Communication**, **Targets & Planning**, filtered by role, and an account menu (switch account, logout). |
| FR-NAV-02 | Mobile: a bottom bar (Dashboard, Members, Meetings, Leaders, More). "More" lists the remaining allowed pages, the account switcher and Logout. |
| FR-NAV-03 | Menu by role: State Admin — Members, Admins, Transfers, Role Management, Reports, Consolidation, Baithul Maal, Master Data, Files, Alerts, Meetings overview, Targets, Leaders. District Admin — Members, Transfers, Role Management, Reports, Consolidation, Baithul Maal, Master Data, Files, Alerts, Meetings overview, My Targets, Leaders. Area Admin — Members, Role Management, Requests, Reports, Consolidation, Baithul Maal, Files, Alerts, Meetings, My Targets, Leaders. Member — Dashboard, My Targets, Meetings, Baithul Maal, Alerts, Leaders, Files, Profile. |
| FR-NAV-04 | The app shall be installable (name "SOLIDARITY", standalone, portrait, red theme) with an install banner (dismissible) and automatic updates checked hourly. |
| FR-NAV-05 | Offline: app shell, images (30 days) and fonts are cached; API responses are cached network-first for 24 hours (10-second network timeout). Changes made offline are not queued. |

---

## 7. Business Rules & Calculations

| # | Rule |
|---|---|
| BR-01 | **Phone numbers** are normalised to 10 digits and matched in all stored formats (`9xxxxxxxxx`, `+91…`, `91…`). Admin phones are stored bare; member phones with `+91`. |
| BR-02 | **Member login eligibility** = status Active **and** approved. |
| BR-03 | **Age** is calculated from date of birth on save. |
| BR-04 | **Baithul Maal months active** = whole 30-day periods since the start month (or joining date if none). **Expected** = months active × monthly amount. **Pending** = max(0, expected − total paid). |
| BR-05 | **Total paid / last payment** = sum and latest date of the member's active payment records. |
| BR-06 | **One payment per member per month** (among active payments). |
| BR-07 | **Target audience → recipients** per the table in §6.9; State Admins never receive targets. |
| BR-08 | **Recurring periods**: monthly/quarterly = one slot per month (week 0); weekly = weeks 1–5 of a month, where week count = ⌈(weekday of 1st + days in month) ÷ 7⌉. Quarterly targets are tracked month by month. |
| BR-09 | **Consolidation completion rate** = completed ÷ total × 100 (one decimal). Recurring "completed" = every month in range done. |
| BR-10 | **Meeting attendance rate** = (present + late members + present guests) ÷ (members + guests) × 100. "Late" counts as present. |
| BR-11 | **Area scope** = Groups in the admin's district whose name equals the admin's area name (case-insensitive). |
| BR-12 | **Transfer completion** happens only on State Admin approval; within-district transfers auto-approve the target-district step. |
| BR-13 | **Delete protection**: districts with areas/members and areas with members cannot be deleted. |

---

## 8. Data Model Summary

| Entity | Key fields | Notes |
|---|---|---|
| User (admin) | name, phone, role, adminKind, district, group, permissions, isActive, isLeader, roleTag, extraRoleTags | Unique on phone + role + adminKind |
| Member | name, phone (unique), district, group, status, isApproved, profile fields, baithulMaal {monthlyAmount, totalPaid, lastPaymentDate, startDate}, leader tags | |
| MemberAuth | member, phone, lock-out state, devices | Member login record |
| LoginOtp | phone, hashed code, expiresAt, attempts, lastSentAt | Auto-deleted after expiry |
| District | name, code, state, admin, isActive, statistics | |
| Group (Area) | name, code (unique per district), district, admin, meeting schedule, statistics | |
| BaithulMaalPayment | member, amount, paymentMonth, paymentDate, type, method, receipt no., recordedBy, isActive | Soft delete |
| PersonalTarget | title, category, audience, status, dates, recurring settings, attendanceNeeded | |
| MemberTargetProgress / UserTargetProgress | person, target, status, progress %, feedback, file, completedAt | One per person per target |
| RecurringMark | person (User or Member), target, year, month, week, completed, completionCount, attendance[] | Unique per person/target/period |
| Meeting / MeetingSession | meeting details, audience; sessions with per-area completions, member and guest attendance, attachments | |
| Attendance / GuestAttendance | meeting, member/guest, group, district, month, status, markedBy | Meeting-level attendance store |
| Request | type, member, proposed vs current data, approval level, status, comments, expiresAt | Change requests |
| TransferRequest | member, from/to district & group, reason, 3 approval steps, status | |
| Notification | title, message, type, priority, audiences, targets, channels, status, attachments, delivery stats | |
| OrgFile | title, category, fileType, link/url, file metadata, isActive | |

---

## 9. External Integrations

| Integration | Use | Notes |
|---|---|---|
| MsgHex (WhatsApp) | Login OTP delivery; WhatsApp notifications (single and bulk) | Single delivery channel for OTP. In non-production environments OTPs are printed to the server console. |
| DigitalOcean Spaces | Storage for documents, target proof files, member uploads, meeting attachments | Public-read objects served by CDN URL. |
| Microsoft Office Online viewer | In-browser preview of Office documents | Needs a public HTTPS file URL. |
| Netlify | Frontend hosting with SPA fallback | |

---

## 10. Non-Functional Requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | Security | All API routes except login and health require a valid JWT; role and permission checks are enforced on the server for every scoped action. |
| NFR-02 | Security | OTPs are hashed (bcrypt) and single-use; login attempts are limited; CORS allows only configured origins; security headers via Helmet. |
| NFR-03 | Security | Uploads are restricted by MIME type and size (10 MB meeting files, 20 MB target files, 50 MB documents). |
| NFR-04 | Performance | Lists are paginated on the server (default 20, max 100). Client caching keeps data fresh for 5 minutes and repaints instantly on revisit. |
| NFR-05 | Availability | API rate limit 1,000 requests per 15 minutes per IP (configurable). Health endpoint at `/health`. |
| NFR-06 | Usability | Mobile-first responsive layout; installable PWA; Malayalam font bundled and Malayalam file names supported. UI text is English. |
| NFR-07 | Auditability | Members, payments, requests, transfers and meetings record who created/changed them and when. |

---

## 11. Known Gaps, Issues & Open Questions

These were found while documenting the current code. They are listed for decision, not as agreed requirements.

### 11.1 High impact

| # | Finding | Impact |
|---|---|---|
| G-01 | On **every API server start**, a startup routine sets **all** members that are unapproved, Inactive or Applicant to **approved + Active** (`server.js`, `runMigrations`). | The member approval workflow (§6.5) and Inactive/Applicant statuses are silently undone on each restart or deploy. |
| G-02 | Members see a **different pending Baithul Maal amount** from admins: the member view counts from the joining date, while the admin view counts from the admin-chosen start month. | Members may see dues that admins do not. |
| G-03 | Editing a recurring target resets its start date to **1 January of the current year**. Consolidation "All Time" starts from that date. | "All Time" consolidation changes meaning after an edit. |
| G-04 | Recurring-target consolidation marks a person **Completed only if every month in the range is done**. With "All Time", a person who missed any single month since the start is always Pending. | Low completion rates in long ranges; the rule should be confirmed. |
| G-05 | The admin marking window (current + previous month only) is enforced only in the admin screen, not by the API; members can mark any past period. | Inconsistent rules between admins and members. |
| G-06 | A fixed test number (`9876543210`) with fixed OTP `1234` is accepted in every environment, including production. | Security risk if an account ever uses that number. |
| G-07 | Tokens last **365 days** and cannot be revoked server-side (logout only clears the device). | A lost device stays signed in until the account is deactivated. |

### 11.2 Medium / functional gaps

| # | Finding |
|---|---|
| G-08 | Two ways to record Baithul Maal payments: a legacy endpoint adds to Total Paid **without** creating a payment record; the current flow creates payment records. Totals can drift if both are used. |
| G-09 | Payment type (arrears/advance/special), payment method and receipt number exist in data but cannot be set in the UI. |
| G-10 | "Approve & Activate" for pending members is shown only to State Admins, although the API allows District Admins. District Admins have no Requests menu entry. |
| G-11 | Request expiry (30 days) is stored but never applied; no background job runs. |
| G-12 | Meeting attendance is stored in two places (session records and a separate Attendance collection); reports may read different sources. |
| G-13 | Members cannot see meeting session attachments or their own attendance history. |
| G-14 | Notification scheduling, SMS and email channels exist in the data model but are not implemented. The unread dot is per device, not per user. |
| G-15 | Backend reports for members, Baithul Maal, activity and attendance have no screens. |
| G-16 | The Master Data delete-district dialog says it "will also delete all areas and members", but the system blocks deleting a district that has areas or members. |
| G-17 | Quarterly recurring targets are tracked monthly; no quarter-level rule exists. |
| G-18 | Area scope relies on exact area-name matching (BR-11); renaming an area or a typo in an admin's area name silently changes what that admin can see. |
| G-19 | The "edit request" dialog for admins (`RequestEditDialog`) is not used anywhere; admins edit members directly. |

### 11.3 Open questions for the business

1. Should consolidation for recurring targets count a person as Completed when they meet a threshold (e.g. ≥ 80% of months) rather than 100%?
2. For weekly targets, is one marked week enough for the month, or should all weeks count?
3. Should District Admins approve new members from the UI, or should approval stay with State Admins only?
4. Should the Baithul Maal start month apply to the member's view (fix G-02)?
5. Should Murabi and Coordinator Admins stay separate rows in consolidation when the rest of the UI treats them as Area Admins?

---

## Appendix A — API Index

Base path `/api`. Guards in brackets.

| Module | Endpoints |
|---|---|
| Auth | `POST auth/login/send-otp`, `POST auth/login/verify-otp`, `POST auth/login/select-account`, `GET auth/accounts`, `POST auth/switch-account`, `POST auth/switch-role`, `GET auth/me`, `POST auth/refresh-token`, `POST auth/logout` |
| Member portal | `member-auth/*`: send/verify/resend OTP, `GET/PUT profile`, `POST profile-change-request`, `GET baithul-maal`, `GET meetings`, `GET targets`, `POST targets/:id/progress`, `GET/POST recurring-marks`, `POST uploads`, `GET notifications`, `GET leaders`, `GET org-files`, `GET districts`, `GET groups`, `POST logout` |
| Users | `GET users` [state, district], `POST users` [state], `GET/PUT users/:id`, `DELETE users/:id` [state], `POST users/:id/toggle-status` [state], `GET users/leaders`, `PATCH users/:id/leader`, `GET users/stats/overview` [state] |
| Members | `GET/POST members`, `GET/PUT members/:id`, `DELETE members/:id` [state], `POST members/:id/approve` [state, district], `PATCH members/:id/leader`, `GET members/user-context` |
| Districts | `GET/POST districts`, `GET/PUT/DELETE districts/:id`, `GET districts/:id/groups`, `GET districts/:id/members`, `GET districts/:id/stats` |
| Groups | `GET/POST groups`, `GET/PUT/DELETE groups/:id`, `GET groups/:id/members`, `GET groups/:id/stats` |
| Requests | `GET requests`, `GET requests/pending`, `GET requests/stats`, `GET requests/:id`, `POST requests`, `POST requests/:id/approve`, `POST requests/:id/reject`, `POST requests/:id/comment` |
| Transfers | `GET/POST transfer-requests`, `GET transfer-requests/pending-count`, `GET transfer-requests/:id`, `POST transfer-requests/:id/approve`, `POST transfer-requests/:id/reject` |
| Baithul Maal | `GET baithul-maal`, `GET/PUT baithul-maal/member/:id`, `POST baithul-maal/member/:id/payment` (legacy), `GET baithul-maal/stats`, `GET baithul-maal/defaulters` |
| Payments | `GET/POST baithul-maal-payments`, `PUT/DELETE baithul-maal-payments/:id`, `GET baithul-maal-payments/member/:memberId`, `GET baithul-maal-payments/summary/:memberId` |
| Targets | `GET/POST personal-targets`, `GET/PUT/DELETE personal-targets/:id`, `GET personal-targets/:id/progress`; `GET/POST user-target-progress…`; `member-target-progress/*`; `GET recurring-marks/my`, `GET recurring-marks/area-members`, `GET recurring-marks/attendance/:targetId`, `POST recurring-marks` |
| Consolidation | `GET consolidation/targets?userType=`, `GET consolidation/report?userType=&targetId=&districtId=&groupId=&dateFrom=&dateTo=` [view_reports] |
| Meetings | `GET/POST meetings`, `POST meetings/monthly`, `GET/PUT/DELETE meetings/:id`, `GET meetings/:id/sessions`, `PUT meetings/:id/sessions/:sid`, `POST …/sessions/:sid/member-attendance`, `POST …/sessions/:sid/add-guest`, `POST …/sessions/:sid/complete`, `POST …/sessions/:sid/upload`, `POST meetings/:id/bulk-session-actions`, `GET meetings/admin/overview`, `GET meetings/admin/attendance-overview`, `GET meetings/admin/dashboard-stats`, attendance and report endpoints |
| Reports | `GET reports/dashboard`, `GET reports/members`, `GET reports/baithul-maal`, `GET reports/activity`, `GET reports/attendance`, `GET reports/attendance/summary`, `GET reports/attendance/export`, `GET reports/census/districts`, `GET reports/census/districts/:id/units`, `GET reports/export/members` |
| Notifications | `GET notifications`, `POST notifications` [state, district, area], `GET notifications/:id`, `PUT/DELETE notifications/:id` [state], `POST notifications/:id/send` [state], `GET notifications/:id/status`, `GET notifications/stats` [state] |
| Files | `GET org-files`, `POST org-files` [state], `PUT/DELETE org-files/:id` [state], `POST uploads` [admins] |
