import { GALLERY_CONTACT } from "@auction/branding";

/**
 * Every sentence on the collection booking pages, in one place, as the approved design words them.
 * Sentence case, no system terms; dates are drawn by the formatters, never written here.
 */
export const COLLECT_COPY = {
  title: "Book a collection",
  changeTitle: "Change your collection",
  visitsTitle: "Your collections",
  where: `${GALLERY_CONTACT.streetLine}, ${GALLERY_CONTACT.city} ${GALLERY_CONTACT.postcode}`,
  panels: {
    lots: "Lots to collect",
    day: "Day",
    dayHint: "Next 4 weeks",
    time: "Time",
    collector: "Who collects",
    summary: "Your collection",
  },
  lots: {
    notPaid: "Not paid yet · collection opens once paid",
    none: "None of these lots can be booked for collection yet.",
  },
  day: {
    closed: "Closed",
    full: "Full",
    saleDay: "Sale day",
    tooSoon: "Too soon",
    saleShort: "Sale",
    tooSoonShort: "Soon",
    closedShort: "Shut",
  },
  week: {
    none: "No days have times this week.",
    one: "1 day has times this week.",
    many: (count: number) => `${count} days have times this week.`,
  },
  time: {
    noDay: "Choose a day to see the times.",
    noneThatDay: "No times that day.",
    full: "Full",
    loading: "Loading times",
    loadFailed: "We couldn't load the times. Try again.",
    retry: "Try again",
  },
  collector: {
    self: "Bring photo ID in this name.",
    someoneElse: "Someone else",
    someoneElseHint: "A colleague, a friend or a shipper. You authorise them here.",
    member: "A colleague",
    memberHint: "Another member of your organisation.",
    name: "Their full name",
    nameHint: "As it appears on their photo ID.",
    email: "Their email",
    emailHint: "We send them the time, place and ID rule. Never the price.",
    company: "Company",
  },
  errors: {
    summary: (count: number) => `Check ${count} ${count === 1 ? "thing" : "things"} before booking`,
    lots: "Tick at least one lot.",
    time: "Choose a time.",
    name: "Enter the name on their photo ID.",
    email: "Enter an email address like name@example.com.",
    authorisation: "Tick the box to authorise them to collect.",
  },
  taken: {
    title: "That time has just been taken",
    body: (time: string) =>
      `Someone booked the last place at ${time} a moment ago. Your lots and details are kept: pick another time.`,
  },
  tooLate: {
    book: "It's too late to book that time online.",
    change: "It's too late to change this online.",
  },
  noTimes: {
    title: "No times left in the next 4 weeks",
    body: "Email us and we'll find a time that works, or come back later: times open up as people change their plans.",
  },
  confirm: {
    book: "Confirm booking",
    booking: "Booking…",
    change: "Move booking",
    changing: "Moving…",
    chooseTime: "Choose a time to confirm.",
    chooseLot: "Tick a lot to confirm.",
    cutoff: "You can change or cancel online until 16:00 the working day before.",
    keepsCurrent: "Your current time is kept until you confirm a new one.",
  },
  booked: {
    notice: (when: string) => `Collection booked for ${when}`,
    changedNotice: (when: string) => `Collection moved to ${when}`,
    emailed: "We've emailed the details and a calendar invite.",
    reference: (reference: string) => `Collection booked · Reference ${reference}`,
    addToCalendar: "Add to calendar",
    change: "Change time",
    cancel: "Cancel booking",
    deadline: (when: string) => `Change or cancel online until ${when}.`,
    idRule: (name: string) =>
      `Bring photo ID in the name of ${name}: a passport, driving licence or national identity card.`,
    idRuleCollector: (name: string) =>
      `${name} needs to bring photo ID: a passport, driving licence or national identity card.`,
    afterCutoff: (email: string) =>
      `To change it, email ${email} or call ${GALLERY_CONTACT.phone}.`,
    ready: "Ready to collect",
  },
  cancel: {
    title: (day: string) => `Cancel your collection on ${day}?`,
    body: (collectBy: string | null) =>
      `The time is released for someone else. Your lots stay with us, paid and safe, until you book again.${collectBy ? ` Please collect by ${collectBy}.` : ""}`,
    keep: "Keep booking",
    confirm: "Cancel booking",
    confirming: "Cancelling…",
    cancelled: "Collection cancelled",
  },
  missed: {
    title: (day: string) => `We missed you on ${day}`,
    again: "Book a new time",
  },
  partly: (left: string, day: string) => `${left} stayed with us. Collected on ${day}.`,
  done: (name: string, when: string) => `Collected by ${name} on ${when}.`,
  hold: {
    identity:
      "Collection opens once we've finished checking your identity. We'll email you as soon as you can book.",
    source_of_funds:
      "Collection and delivery open once we've finished checking the source of funds for this purchase. We'll email you as soon as you can book.",
    finance:
      "Collection opens once our finance team has finished a check on this purchase. We'll email you as soon as you can book.",
  },
  organisation: (name: string) => `${name}'s owners, admins and finance team book collections.`,
  off: {
    title: "Online booking isn't open yet",
    body: "Email us the day, and who will collect. We confirm by email.",
    email: "Email us to book",
  },
  viewOnly: {
    reason: "You're viewing this account, so you can't book for it.",
    title: "You're viewing this account",
    body: "Collections can be booked by the account itself. You can see them here but not change them.",
  },
  rateLimited: "You're doing that too quickly. Wait a moment and try again.",
  unavailable: "We couldn't check collections just now. Try again in a moment.",
  list: {
    empty: "No collections booked",
    emptyBody: "Book a time to collect a lot you've paid for. It will appear here.",
    book: "Book a collection time",
    upcoming: "Upcoming",
    past: "Past",
  },
  collectBy: {
    title: (day: string) => `Please collect by ${day}`,
    short: (day: string) => `Collect by ${day}`,
    upcoming: (place: string) =>
      `Your work is paid for and waiting at ${place}. Book a time to collect it.`,
    soon: (place: string) =>
      `Your work is paid for and waiting at ${place}. Book a time to collect it soon: after that day, storage charges may apply.`,
    overdue: (place: string) =>
      `That day has passed, so storage charges may apply. Book a time to collect your work from ${place}, or email us if you need longer.`,
    storagePolicy: "Storage policy",
    storagePolicyHref: "/shipping#storage",
    email: `Email ${GALLERY_CONTACT.email}`,
    emailHref: `mailto:${GALLERY_CONTACT.email}?subject=${encodeURIComponent("Collecting my purchase")}`,
  },
  badge: {
    booked: (day: string) => `Booked ${day}`,
    overdue: "Overdue",
    book: "Book collection",
    notCollected: "Not collected",
  },
  bulk: {
    button: (count: number) =>
      `Book a collection time for ${count} ${count === 1 ? "lot" : "lots"}`,
    selected: (count: number, place: string) =>
      `${count} ${count === 1 ? "lot" : "lots"} at ${place}, in one visit`,
    mixed: "These lots wait at different places. Pick lots from one place to book them together.",
    tooMany: "A visit holds up to 20 lots. Pick fewer, or book in two visits.",
    pick: (title: string) => `Collect ${title}`,
  },
  tooManyVisits:
    "You already have the most collections we can hold for one account. Cancel one, or email us.",
  entry: {
    button: "Book a collection time",
    intro: `From our gallery at ${GALLERY_CONTACT.streetLine}, ${GALLERY_CONTACT.city} ${GALLERY_CONTACT.postcode}. Book a time online, Monday to Friday.`,
    earliest: (when: string) => `Earliest time: ${when}. Book by 16:00 the working day before.`,
  },
} as const;

/** The email to write to when a time cannot be booked online. */
export function collectBookingEmail(fallback: string, bookingEmail: string | null): string {
  return bookingEmail ?? fallback;
}
