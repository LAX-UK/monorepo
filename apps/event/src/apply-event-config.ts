import { setEventCountdownFromIso } from "./event-countdown.js";
import { formatEventDateLondon, formatEventDoorsTimeLondon } from "./event-date-format.js";
import type { OnsiteEventPublicConfig } from "./rsvp-api.js";

function applyEventSchedule(config: OnsiteEventPublicConfig): void {
  setEventCountdownFromIso(config.startsAt);

  if (!config.startsAt) return;
  const startsAt = new Date(config.startsAt);
  if (Number.isNaN(startsAt.getTime())) return;

  const dateLabel = formatEventDateLondon(startsAt);
  const doorsLabel = formatEventDoorsTimeLondon(startsAt);

  for (const node of document.querySelectorAll<HTMLElement>("[data-event-date]")) {
    node.textContent = dateLabel;
  }
  for (const node of document.querySelectorAll<HTMLElement>("[data-event-doors]")) {
    node.textContent = doorsLabel;
  }
}

export function applyPublicConfig(config: OnsiteEventPublicConfig): void {
  applyEventSchedule(config);
  applyRsvpUrgency(config.rsvpCloseAt, config.rsvpOpen);
  setRsvpCallToActionsVisible(config.rsvpOpen);
}

export function setRsvpCallToActionsVisible(open: boolean): void {
  document.documentElement.dataset.rsvpOpen = open ? "true" : "false";
  const sticky = document.getElementById("sticky-rsvp");
  if (sticky) sticky.hidden = !open;
  for (const node of document.querySelectorAll<HTMLElement>("[data-rsvp-cta]")) {
    node.hidden = !open;
  }
}

function applyRsvpUrgency(rsvpCloseAt: string | null, rsvpOpen: boolean): void {
  const banner = document.getElementById("rsvp-urgency");
  if (!banner) return;

  if (!rsvpOpen || !rsvpCloseAt) {
    banner.hidden = true;
    return;
  }

  const closeAt = new Date(rsvpCloseAt);
  const remaining = closeAt.getTime() - Date.now();
  if (remaining <= 0) {
    banner.hidden = true;
    return;
  }

  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.ceil(remaining / (1000 * 60 * 60));
  const label =
    days > 1
      ? `RSVP closes in ${days} days`
      : days === 1
        ? "RSVP closes tomorrow"
        : hours > 1
          ? `RSVP closes in ${hours} hours`
          : "RSVP closes soon";

  banner.textContent = label;
  banner.hidden = false;
  banner.classList.add("is-visible");
}
