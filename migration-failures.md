# Migration Failures Report

> Generated: June 3, 2026

## Summary

| Category | Count |
|----------|-------|
| State Leaders NOT FOUND | 5 |
| District Leaders NOT FOUND | 7 |
| District Mismatches | 2 |
| **Total Issues** | **14** |

---

## State Leaders — Not Found in Database

These people from `state.json` do not exist as either a Member or User in the system.

| # | Name | Phone | Role |
|---|------|-------|------|
| 1 | Dr. Safeer A K | 7907185614 | PUBLIC RELATION SECRETARY |
| 2 | Anwar Salahudeen | 9746349379 | ADVOCACY CONVENOR |
| 3 | Abdul Basith Umar | 9496336486 | RESEARCH CONVENOR |
| 4 | Adv. Rehman Irikkur | 9526019540 | LEGAL CONVENOR |
| 5 | Adhil Abdul Rahim | 9895550436 | State Committee Members |

---

## District Leaders — Not Found in Database

These people from `leaders-Dis.json` do not exist as either a Member or User in the system.

| # | Name | Phone | District | Role |
|---|------|-------|----------|------|
| 1 | Hamis | 8281707588 | KOTTAYAM | Organisation Secretary |
| 2 | Afkkar Kanchirapally | 9497326830 | KOTTAYAM | Social Engagement |
| 3 | Jasin | 9746258978 | Thiruvananthapuram | Organisation campaign in charge |
| 4 | Al Mayoof | 9995342572 | Thiruvananthapuram | Youth Culture |
| 5 | Ammar VI | 8089079998 | Eranakulam | Organisation Secretary |
| 6 | Noufal farook | 8089892224 | Alappuzha | Islamic Society |
| 7 | Hisham P | 9895661431 | Wayanad | PR & Social Media |

---

## District Mismatches — RESOLVED ✅

Per user confirmation, the original districts were correct. Kept as-is.

| # | Name | Phone | District (Correct) | Role |
|---|------|-------|-------------------|------|
| 1 | Rafid Kaniyapuram (RAFID) | 7034376873 | KOZHIKKODE ✅ | Vice President & Organisation |
| 2 | Aslam T.P.M (MOHAMED ASLAM TPM) | 9645802478 | WAYANAD ✅ | President |

---

## Action Required

1. **Not Found (12 people):** These need to be added as Members first (via Add Member or Bulk Import), then re-run `node migrate-leaders.js --execute`.
