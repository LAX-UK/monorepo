# Storage terms for collections (approved design)

LAX Bid (London Auction Xchange LTD). Approved 15 Nov 2026 as recommended. Register rows CB-Q1, CB-Q2, GAP-10.

## Defaults
- 14 calendar days free, counted from the London day payment clears.
- After that £3.00 per lot per calendar day (standard) and £6.00 (large), entered before VAT.
- Large = any side over 150 cm including frame or crate. Staff mark it on the lot (dimensions are free text). Standard if not marked.
- Handling fee field exists, set to £0 (works stay at the gallery; no outside store).
- No client tiers.
- A collect-by date that lands on a closed day (weekend, bank holiday, closure) moves to the next open day.

## Decisions ST1–ST17
1. ST1 Staff set terms in Bid admin › Operations › Collections › new **Storage** tab beside Hours and rules. The two current fields (free storage days, weekly charge) leave Hours and rules.
2. ST2 One set of terms per collection place, with per-lot extensions and waivers. No per-sale override.
3. ST3 Default free period 14 days after payment clears.
4. ST4 Calendar days by default, working days offered as a choice. Deadline on a closed day moves to the next open day.
5. ST5 Clock starts on the London day payment clears. Paused while LAX holds the work: open check on the lot, open dispute, or a shipping quote LAX still owes.
6. ST6 Charge per lot per calendar day (replaces the unused per-week field).
7. ST7 Two bands, standard and large (staff flag on the lot).
8. ST8 Handling fee field, default £0.
9. ST9 Terms are versioned with a start date from tomorrow onward. A lot keeps the terms in force when its sale closed. Lots won before the first terms keep 30 days free, nothing charged.
10. ST10 Finance or Admin changes terms and switches charging on, after a recent sign-in (step-up). Fulfilment can view terms and extend one lot's free storage (up to 30 days, reason required). Finance waives charges (reason required). Every change records who, when, before, after and why.
11. ST11 "Raise storage invoices" switch, off by default, cannot be turned on until a VAT treatment is chosen. While off: buyers see terms, staff see what would be due, nothing is billed.
12. ST12 Buyers see the numbers on the lot page (Collection and storage), shipping page, purchase notice with a running total, booking page, reminders and invoice, all from one formatter.
13. ST13 Separate storage invoice priced up to the visit/dispatch day, raised at booking, paid online, re-priced if the visit moves.
14. ST14 Hand-over and dispatch wait until storage is paid or waived; the desk shows the amount.
15. ST15 Reminders a week before and on the day (now with the rate), one "Storage charges have started" email the day after, then a running total every 14 days. At 60 days staff see the lot flagged for personal follow-up. Nothing sold automatically.
16. ST16 No automatic disposal; final-notice/right-to-sell later with the lawyer.
17. ST17 Storage invoices join the Zoho Books sync for Bid invoices. Nothing for Xero.

## Staff screens (must be easy and polished)
Built with the shared staff-ui kit and docs/design/staff-design-standard.md.

**Storage tab (Finance/Admin):**
- Status chip in the page header: "Charging off" / "Charging on".
- Info banner while charging is off: "Charging is off. Buyers see the free period and the rates below, and the Not collected tab counts what would be due, but no storage invoice is raised. Finance can switch it on once the VAT treatment is confirmed."
- "In force" card: Since {date}; Free ("14 days after payment clears. A date that falls on a closed day moves to the next open day."); Counting "Calendar days"; Standard £3.00 per lot a day; Large £6.00 per lot a day · any side over 150 cm, marked on the lot; Handling None; Applies to "Lots won in sales that close on or after the start date". Action: "Schedule a change". While a change waits the action is blocked, and its reason is a line on the card ("A change is already scheduled. Edit or cancel it first."), not only a tooltip, since a phone has no hover.
- "Scheduled" card (when one exists): From {date}; before → after for each value, under the same short labels as In force (Free, Counting, Standard, Large, Handling) with short values ("14 days", "Calendar days", "£3.00", "As standard", "None"), so every row stays on one line at 375; Reason. Actions: Edit, Cancel change (in-page confirm).
- Cards that share a row at 1440 stretch to one bottom edge.
- "Charging" card: "Raise storage invoices" switch with the explanation; disabled with the reason until a VAT treatment is chosen; turning it on asks for an in-page confirmation.
- "History" table: When · Who · Change (plain sentence).

**Schedule a change (side sheet):**
- Sections: When it starts (Starts on date, from tomorrow and at most 2 years ahead; Reason, shown in History); Free storage (Free days 0–90, a field sized for two digits; Count in: Calendar days (Recommended) / Working days); Daily charge after that (Standard £, Large £ with a "Large band" toggle to turn it off, "Charge more for large works. Large means any side over 150 cm."); Handling fee (optional, once per lot when charges start). Money fields are sized for £500.00 and the date for its example (kit `max-w-staff-field-*`). A large band that is on charges at least £0.01: £0.00 is refused with "Enter a daily rate, or turn off the large band".
- Live preview "Buyers will read: Storage is free for 14 days after your payment clears. After that it is £3.50 a day for each work, or £7.00 for works over 150 cm on any side, plus VAT where it applies." built by the same buyer formatter, so it is word for word the lot and shipping page sentence (the "over 150 cm on any side" form below, not "for large works"). It is spoken to screen readers once typing pauses, not on every keystroke.
- 2+ fields: error summary at the top ("2 things to fix", links to fields) plus inline errors. One field: no summary; focus goes straight to that field and its inline error. This is a deliberate exception to the staff standard's FRM-4 (summary even for one error): the sheet is short and the field is in view. Copy: "Choose a date from tomorrow" · "Choose a date up to {latest day}" · "Enter a number of days from 0 to 90" · "Enter a daily rate, or turn off the large band" · "Enter an amount up to £500.00".
- Buttons: Cancel / Schedule change. Saving state on the button, no double submit, unsaved-changes guard.

**Other states:** No terms yet (empty state: "No storage terms set. Until you set them, buyers are asked to collect within 30 days and told charges may apply. Nothing is charged." + "Set storage terms"); Read-only for Fulfilment ("Only Finance and Admins can change storage terms."); loading skeleton; load error with retry; 375 px layout stacks cards.

**Not collected tab:** per lot: "{n} days over", Collect by {date} · buyer, Storage so far £x, Band; actions "Extend free storage" (Fulfilment, up to 30 days, reason) and "Waive charges" (Finance, reason). Both logged; buyer page updates at once. 60-day flag for follow-up.

**Lot page (staff):** "Large work" flag under Collection.

## Until the buyer pages move (PR 3 ships before PR 4)
The Storage tab (PR 3) saves versioned terms, but buyers do not see them yet: buyer pages still read `collection_place.free_storage_days` (`apps/api/src/services/organisation-buying/purchase-view.ts`, `packages/persistence/src/repositories/drizzle-workspace-buying.readers.ts`), and nothing yet records on a lot the terms in force when its sale closed.
- Interim notice while charging is off: "No storage invoice is raised. Buyers don't see these terms yet: their pages keep today's collect-by date until they move to the storage terms in a coming release. Finance can switch charging on once the VAT treatment is confirmed."
- PR 4 must: call `recordTermsForSale` when a sale closes; move the buyer reads above onto `storageTermsForLot` and `formatStorageTerms`; then restore the approved notice ("Buyers see the free period and the rates below, and the Not collected tab counts what would be due, but no storage invoice is raised. …"), once PR 5 has the Not collected tab counting what would be due.
- After the web release without them is live: remove `freeStorageDays` and `storageChargePence` from the Hours and rules body (`packages/validators/src/collection-settings.ts`), which are accepted and ignored for one release so an older page can still save.

## Buyer copy
- Purchase notice upcoming: "Please collect by {day} · Your work is paid for and waiting at {place}. Storage is free until then, and {rate} a day after that, plus VAT where it applies."
- Soon: "Please collect by {day} · Your work is paid for and waiting at {place}. Book a time to collect it soon: after {day}, storage is {rate} a day."
- Charging: "Storage charges since {day} · {amount} so far ({n} days at {rate}), plus VAT where it applies. Book a time to collect, and you will pay the storage up to that day when you book."
- Charging off (today's wording kept): "That day has passed, so storage charges may apply. Book a time to collect your work from {place}, or email us if you need longer."
- Extended: "Free storage extended to {day} · We have held your work longer at no charge. Book a time to collect before then."
- Waived: "No storage to pay · We have waived the storage charges on this work. Book a time to collect."
- List badge: "Collect by {day} · Storage {amount} so far"
- Booking summary: "Storage to pay · Charged up to your visit day. If you move the visit, we adjust it."
- Invoice line: "Storage, Lot {n} · {from} to {to} · {days} days at {rate}"
- Hand-over desk: "Storage of {amount} is due on this lot. Take payment or waive it before hand-over."
- Lot/shipping page: "Storage is free for 14 days after your payment clears. After that it is £3 a day for each work, or £6 for works over 150 cm on any side, plus VAT where it applies."
- Email "Storage charges have started".

Wording that is not in the approved list above, added so the formatter and this document agree (change it here and in `packages/domain/src/storage-terms.ts` together):
- Handling fee, on the upcoming and soon notices when a fee is set: "A handling fee of {fee} applies once when charges start."
- Handling fee, in the running total: "{amount} so far ({n} days at {rate}, and a {fee} handling fee), plus VAT where it applies." With no daily rate: "{amount} so far (a {fee} handling fee), plus VAT where it applies."
- Lot/shipping sentence when only the large band is charged: "…it is {large rate} a day for works over 150 cm on any side, and nothing for others, plus VAT where it applies."
- Lot/shipping sentence with no free days: "It is {rates}", or "Storage is charged from the day after your payment clears."
- Lot/shipping sentence when no rate is set: "After that, storage charges may apply."
- Lot page: the terms stated are those in force on the day the sale closes (ST9), and the shipping page carries its old general "storage charges may apply" sentence only while no place has terms.
- List badge when the day has passed and nothing is owed (charging off, or a day count of zero): "Collect by {day}" with no total; a waived lot shows "No storage to pay" on its notice.

## Not yet built (tracked)
- ST5 pauses on the buyer's running total: only a shipping quote LAX still owes is applied (from the day it was asked to the day it was quoted). Open checks and disputes are not linked to a lot in the data the purchases read uses, so they do not pause the total yet. This must land before charging is switched on (PR 6), or a buyer in a dispute would see charges.
- ST13 on the booking page: the "Storage to pay" line shows for a new booking only. A visit being changed has none; the charge must be re-priced when the visit moves (PR 6).

## Build (7 PRs)
1. Domain rules: storage terms type, pure charge calculator (calendar/working days, pauses, bands, extension, waiver), next-open-day rule replacing DEFAULT_COLLECT_BY_POLICY reads. Unit tests first.
2. Data: versioned storage terms per place, the terms a lot was sold under, large flag on the lot, extensions and waivers; move free_storage_days across; drop the unused weekly charge. Rollback included. Independent review.
3. Staff Storage tab: API with Finance/Admin capability and step-up; the tab; read-only for Fulfilment; Hours and rules loses the two fields.
4. Buyer surfaces (parallel with 5).
5. Reminders and staff follow-up (parallel with 4).
6. Billing — waits for the accountant (VAT, issuing company).
7. Books sync and Conditions clause 18 — waits for the Books plan and the lawyer.
