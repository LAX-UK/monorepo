# Lot detail — Catalogue IA

**Decision (2026-07):** Catalogue content is owned by **Overview**, not a top-level tab.

Verified Figma lot-detail frames are inconsistent (Overview shows six tabs; Media/Documents/Bid show five without Catalogue). Product alignment follows the **five-tab majority**:

Overview · Media · Documents · Bidding · Activity

## Route behaviour

- `/admin/lots/[id]/catalogue` **redirects** to `/admin/lots/[id]#catalogue` so bookmarks and deep links keep working.
- Overview renders catalogue fields via `lot-overview.vm` catalogue rows.

## Editing

Staff edit catalogue copy via **Edit lot** / setup flows — not via a dedicated read-only tab.
