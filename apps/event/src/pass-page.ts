import { EVENTS_EMAIL, EVENT_DETAILS } from "./config.js";
import { PassFetchError, fetchPass } from "./pass-api.js";
import type { OnsiteEventPassView } from "./pass-types.js";
import { downloadOpeningEventCalendar } from "./rsvp-calendar.js";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const btn = el("button", primary ? "pass-btn pass-btn--primary" : "pass-btn");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function passMain(mount: HTMLElement): HTMLElement {
  mount.replaceChildren();
  const main = el("main", "pass-page-main");
  main.setAttribute("aria-label", "Entry pass");
  mount.append(main);
  return main;
}

function renderLoading(mount: HTMLElement) {
  const main = passMain(mount);
  const card = el("div", "pass-card pass-card--loading");
  card.append(el("p", "pass-eyebrow", "Entry pass"));
  card.append(el("h1", "pass-title", "One moment"));
  card.append(el("p", "pass-subtext", "Loading your pass…"));
  main.append(card);
}

function renderOffline(mount: HTMLElement, onRetry: () => void, message?: string) {
  const main = passMain(mount);
  const card = el("div", "pass-card pass-card--error");
  card.setAttribute("role", "alert");
  card.append(el("p", "pass-eyebrow", "Entry pass"));
  card.append(el("h1", "pass-title", "Connection problem"));
  card.append(
    el(
      "p",
      "pass-subtext",
      message ?? "We couldn't load your pass. Check your connection and try again.",
    ),
  );
  const actions = el("div", "pass-actions");
  actions.append(button("Try again", onRetry, true));
  card.append(actions);
  main.append(card);
}

function renderError(mount: HTMLElement, onRetry: () => void, message?: string) {
  const main = passMain(mount);
  const card = el("div", "pass-card pass-card--error");
  card.setAttribute("role", "alert");
  card.append(el("p", "pass-eyebrow", "Entry pass"));
  card.append(el("h1", "pass-title", "Pass not found"));
  card.append(
    el(
      "p",
      "pass-subtext",
      message ?? "This link may be invalid or expired. If you need help, contact our events team.",
    ),
  );
  const actions = el("div", "pass-actions");
  const mail = el("a", "pass-link-btn") as HTMLAnchorElement;
  mail.href = `mailto:${EVENTS_EMAIL}`;
  mail.textContent = `Email ${EVENTS_EMAIL}`;
  actions.append(mail, button("Try again", onRetry, true));
  card.append(actions);
  main.append(card);
}

function formatPassDate(startsAt: string | null, dateOnly = false): string {
  if (!startsAt) return `${EVENT_DETAILS.date} · ${EVENT_DETAILS.time}`;
  try {
    const date = new Date(startsAt);
    const dateLabel = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/London",
    }).format(date);
    if (dateOnly) return dateLabel;
    const timeLabel = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(date);
    return `${dateLabel} · ${timeLabel}`;
  } catch {
    return `${EVENT_DETAILS.date} · ${EVENT_DETAILS.time}`;
  }
}

function renderPass(mount: HTMLElement, pass: OnsiteEventPassView, onRefresh: () => Promise<void>) {
  const main = passMain(mount);
  const card = el("div", "pass-card");

  if (pass.eventClosed) {
    const closed = el("div", "pass-banner pass-banner--closed");
    closed.append(el("p", undefined, "This event has ended"));
    closed.append(el("p", "pass-banner-sub", "Your pass is shown for reference only."));
    card.append(closed);
  }

  if (pass.checkedInAt) {
    const banner = el("div", "pass-banner pass-banner--checked-in");
    banner.append(
      el("p", undefined, "You're checked in — welcome"),
      el("p", "pass-banner-sub", `Checked in at ${formatCheckedIn(pass.checkedInAt)}`),
    );
    card.append(banner);
  }

  card.append(el("p", "pass-eyebrow", "Entry pass"));
  card.append(el("h1", "pass-title", pass.title));
  card.append(el("p", "pass-guest-name", pass.guestName));

  const details = el("dl", "pass-details");
  const addRow = (term: string, value: string) => {
    details.append(el("dt", undefined, term), el("dd", undefined, value));
  };
  addRow("Attendance", pass.attendanceSegmentLabel);
  if (pass.partySize > 1) {
    addRow(
      "Party",
      pass.plusOneGuestName?.trim()
        ? `Party of ${pass.partySize} — ${pass.plusOneGuestName.trim()}`
        : `Party of ${pass.partySize}`,
    );
  }
  addRow("Date", formatPassDate(pass.startsAt));
  addRow("Venue", pass.venue?.trim() || EVENT_DETAILS.venue);
  addRow("Dress code", pass.dressCode?.trim() || EVENT_DETAILS.dressCode);
  card.append(details);

  const qrWrap = el("div", "pass-qr-wrap");
  const img = el("img", "pass-qr") as HTMLImageElement;
  img.src = pass.qrImageUrl;
  img.alt = `Entry pass QR code for ${pass.guestName}`;
  img.width = 280;
  img.height = 280;
  img.addEventListener("error", () => {
    const fallback = el(
      "p",
      "pass-subtext",
      "QR image could not load. Use Refresh pass or open the link on another device.",
    );
    qrWrap.replaceChildren(fallback);
  });
  qrWrap.append(img);
  card.append(qrWrap);

  card.append(
    el(
      "p",
      "pass-footnote",
      `Personal and non-transferable. Show this QR at registration${pass.startsAt ? ` on ${formatPassDate(pass.startsAt, true)}` : ""}.`,
    ),
  );

  const actions = el("div", "pass-actions");
  const copyBtn = button("Copy pass link", async () => {
    try {
      await navigator.clipboard.writeText(pass.passUrl);
      copyBtn.textContent = "Link copied";
      window.setTimeout(() => {
        copyBtn.textContent = "Copy pass link";
      }, 2000);
    } catch {
      window.prompt("Copy this pass link:", pass.passUrl);
    }
  });
  actions.append(
    button("Add to calendar", () => downloadOpeningEventCalendar(pass.attendanceSegment)),
    copyBtn,
    button("Refresh pass", () => {
      void onRefresh();
    }),
    button("Print pass", () => window.print()),
  );
  card.append(actions);

  main.append(card);
}

function formatCheckedIn(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function hideInvitationChrome(): void {
  document.body.classList.add("pass-route");
  const invite = document.querySelector(".event-page");
  if (invite instanceof HTMLElement) invite.hidden = true;
  const sticky = document.getElementById("sticky-rsvp");
  if (sticky) sticky.hidden = true;
  const skip = document.querySelector<HTMLAnchorElement>('a[href="#rsvp"].sr-only');
  if (skip) skip.hidden = true;
}

export async function initPassPage(mount: HTMLElement, token: string): Promise<void> {
  hideInvitationChrome();
  document.title = "Your entry pass — LAX 001";
  const robots = document.querySelector('meta[name="robots"]');
  robots?.setAttribute("content", "noindex, nofollow");

  async function load() {
    renderLoading(mount);
    try {
      const pass = await fetchPass(token);
      renderPass(mount, pass, load);
    } catch (error) {
      if (
        error instanceof PassFetchError &&
        (error.code === "offline" || error.code === "timeout")
      ) {
        renderOffline(
          mount,
          () => void load(),
          error.code === "timeout"
            ? "This is taking longer than expected. Check your connection and try again."
            : undefined,
        );
        return;
      }
      const message =
        error instanceof PassFetchError && error.code.startsWith("pass_failed_5")
          ? "Our servers are busy. Please try again in a moment."
          : error instanceof PassFetchError
            ? error.message
            : undefined;
      renderError(mount, () => void load(), message);
    }
  }

  await load();
}
