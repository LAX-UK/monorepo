/**
 * Every word on Bid admin's Storage tab (Collections › Storage), in one place. The approved copy
 * is in docs/design/storage-terms.md, "Staff screens"; change it there first.
 */
export const STORAGE_COPY = {
  tab: "Storage",
  pageDescription:
    "How long bought works are stored free at each place, and what storage costs after that.",
  status: { on: "Charging on", off: "Charging off" },
  /**
   * The approved wording: buyers see the terms (storage terms PR 4) and the Not collected tab
   * counts what would be due (PR 5), so both halves are now true.
   */
  offNotice: {
    title: "Charging is off",
    body: "Buyers see the free period and the rates below, and the Not collected tab counts what would be due, but no storage invoice is raised. Finance can switch it on once the VAT treatment is confirmed.",
  },
  readOnly: "Only Finance and Admins can change storage terms.",
  empty: {
    title: "No storage terms set",
    body: "Until you set them, buyers are asked to collect within 30 days and told charges may apply. Nothing is charged.",
    action: "Set storage terms",
  },
  loadError: {
    title: "Storage terms didn't load",
    body: "We couldn't load the storage terms. Try again in a moment.",
    action: "Try again",
  },
  inForce: {
    title: "In force",
    since: (day: string) => `Since ${day}`,
    action: "Schedule a change",
    actionBlocked: "A change is already scheduled. Edit or cancel it first.",
  },
  scheduled: {
    title: "Scheduled",
    from: (day: string) => `From ${day}`,
    tableLabel: "What changes",
    before: "In force now",
    after: (day: string) => `From ${day}`,
    beforeNone: "No terms",
    edit: "Edit",
    cancel: "Cancel change",
    reasonLine: (reason: string) => `Reason: ${reason}`,
    confirm: {
      title: (day: string) => `Cancel the change from ${day}?`,
      body: "The terms in force stay as they are. The cancelled change stays in History.",
      confirm: "Cancel change",
      keep: "Keep change",
      reasonLabel: "Why are you cancelling it?",
      reasonHint: "Shown in History.",
      reasonMissing: "Enter why you're cancelling the change.",
    },
  },
  /**
   * One set of short labels for the In force list and the Scheduled table beside it, so the two
   * cards read alike and every table row stays on one line on a phone.
   */
  labels: {
    startsOn: "Starts on",
    free: "Free",
    counting: "Counting",
    standard: "Standard",
    large: "Large",
    handling: "Handling",
    appliesTo: "Applies to",
  },
  /** The In force list: the full terms, in sentences. */
  values: {
    free: (days: number) =>
      days === 0
        ? "None. Charges start the day after payment clears."
        : `${days} ${days === 1 ? "day" : "days"} after payment clears. A date that falls on a closed day moves to the next open day.`,
    counting: (working: boolean) => (working ? "Working days" : "Calendar days"),
    perLot: (amount: string) => `${amount} per lot a day`,
    largeOn: (amount: string, cm: number) =>
      `${amount} per lot a day · any side over ${cm} cm, marked on the lot`,
    largeOff: "Same as standard works",
    handlingNone: "None",
    handling: (amount: string) => `${amount} once per lot, when charges start`,
    appliesTo: "Lots won in sales that close on or after the start date",
  },
  /** The Scheduled table: the same facts as short values, so each row fits one line at 375. */
  changeValues: {
    free: (days: number) => (days === 0 ? "None" : `${days} ${days === 1 ? "day" : "days"}`),
    largeOff: "As standard",
    handlingNone: "None",
  },
  charging: {
    title: "Charging",
    switchLabel: "Raise storage invoices",
    /** What read-only staff see beside "Raise storage invoices". */
    value: { on: "On", off: "Off" },
    explanation:
      "When on, a buyer who collects after their free period is sent a storage invoice, priced up to the day they collect or we dispatch.",
    noVat:
      "Can be switched on once Finance chooses a VAT treatment for storage charges with the accountant.",
    on: {
      title: "Raise storage invoices?",
      body: "From now on, a buyer who collects after their free period is sent a storage invoice.",
      confirm: "Switch on",
    },
    off: {
      title: "Stop raising storage invoices?",
      body: "Buyers keep seeing the terms, but no new storage invoice is raised.",
      confirm: "Switch off",
    },
    reasonLabel: "Why are you switching it?",
    reasonHint: "Shown in History.",
    reasonMissing: "Enter why you're switching it.",
  },
  history: {
    title: "History",
    columns: { when: "When", who: "Who", change: "Change" },
    system: "System",
    empty: "No changes yet.",
    reason: (reason: string) => `Reason: ${reason}`,
  },
  sheet: {
    titleNew: "Schedule a change",
    titleEdit: "Edit the scheduled change",
    description: "New terms apply to lots won in sales that close on or after the start date.",
    dirtyLabel: "the storage terms",
    sections: {
      when: "When it starts",
      free: "Free storage",
      daily: "Daily charge after that",
      handling: "Handling fee",
    },
    startsOnHint: (latest: string) => `From tomorrow, up to ${latest}.`,
    reasonLabel: "Reason",
    reasonHint: "Shown in History.",
    freeDaysLabel: "Free days",
    freeDaysHint: "0 to 90, counted from the day payment clears.",
    countLabel: "Count in",
    calendar: "Calendar days",
    recommended: "Recommended",
    working: "Working days",
    workingHint: "Only the days the place is open.",
    standardLabel: "Standard",
    dailyHint: "Per lot per day, before VAT. Up to £500.00.",
    largeToggle: "Large band",
    largeToggleHint: "Charge more for large works. Large means any side over 150 cm.",
    largeLabel: "Large",
    handlingLabel: "Handling fee",
    handlingHint: "Once per lot when charges start, before VAT. Up to £500.00.",
    previewTitle: "Buyers will read",
    previewPending: "Fill in the free days and rates to see what buyers will read.",
    cancel: "Cancel",
    submitNew: "Schedule change",
    submitEdit: "Save changes",
    summaryTitle: (count: number) => `${count} ${count === 1 ? "thing" : "things"} to fix`,
  },
  errors: {
    startsOn: "Choose a date from tomorrow",
    startsTooLate: (latest: string) => `Choose a date up to ${latest}`,
    freeDays: "Enter a number of days from 0 to 90",
    large: "Enter a daily rate, or turn off the large band",
    amount: "Enter an amount up to £500.00",
    reason: "Enter a reason",
  },
  toasts: {
    scheduled: "Storage change scheduled",
    edited: "Scheduled change saved",
    cancelled: "Scheduled change cancelled",
    chargingOn: "Storage invoices switched on",
    chargingOff: "Storage invoices switched off",
  },
  failed: "The change wasn't saved",
  sentences: {
    scheduled: (day: string, summary: string) => `Scheduled new terms from ${day}: ${summary}.`,
    edited: (day: string, changes: string) => `Changed the terms from ${day}: ${changes}.`,
    editedNothing: (day: string) => `Saved the terms from ${day} with no change to the values.`,
    cancelled: (day: string) => `Cancelled the change from ${day}.`,
    chargingOn: "Switched storage invoices on.",
    chargingOff: "Switched storage invoices off.",
    vat: (treatment: string) => `Set the VAT treatment for storage to ${treatment}.`,
    migrated: (days: number) =>
      `Moved the free storage days (${days}) from Hours and rules into the first storage terms.`,
    from: (field: string, before: string, after: string) => `${field} from ${before} to ${after}`,
    summary: {
      free: (days: number, working: boolean) =>
        days === 0
          ? "no free days"
          : `${days} ${working ? "working" : "calendar"} ${days === 1 ? "day" : "days"} free`,
      standard: (amount: string) => `${amount} a day`,
      large: (amount: string) => `${amount} for large works`,
      largeOff: "no large band",
      handling: (amount: string) => `${amount} handling fee`,
      handlingNone: "no handling fee",
    },
    fields: {
      effectiveFrom: "start date",
      freeDays: "free days",
      countMode: "counting",
      standardDailyPence: "standard rate",
      largeDailyPence: "large rate",
      handlingFeePence: "handling fee",
    },
    countModes: { calendar: "calendar days", working: "working days" },
    off: "off",
    none: "none",
  },
  vatTreatments: {
    standard_rated: "standard rated",
    zero_rated: "zero rated",
    exempt: "exempt",
    outside_scope: "outside the scope of VAT",
  },
} as const;
