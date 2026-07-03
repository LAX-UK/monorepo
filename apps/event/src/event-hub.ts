import { BRAND, EVENT_ORIGIN, eventAssetPath } from "./config.js";
import { formatEventDateTimeLondon } from "./event-date-format.js";
import { isRsvpApiError } from "./rsvp-api-error.js";
import { type OnsiteEventPublicListItem, fetchUpcomingEventsWithRetry } from "./rsvp-api.js";

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

function deliveryModeLabel(mode: OnsiteEventPublicListItem["deliveryMode"]): string | null {
  if (mode === "onsite") return "In the room";
  if (mode === "hybrid") return "In the room + online";
  return null;
}

function eventInvitationHref(event: OnsiteEventPublicListItem): string {
  if (event.micrositeUrl?.trim()) {
    try {
      const url = new URL(event.micrositeUrl.trim());
      if (url.origin === EVENT_ORIGIN) return url.pathname;
    } catch {
      /* fall through */
    }
  }
  return `/${encodeURIComponent(event.slug)}`;
}

function renderLoading(mount: HTMLElement): void {
  mount.replaceChildren();
  mount.classList.add("event-hub--loading");
  const shell = el("div", "event-hub");
  shell.append(el("p", "event-hub__eyebrow", "LAX — London Auction Exchange"));
  shell.append(el("h1", "event-hub__title", "Upcoming events"));
  const grid = el("div", "event-hub__grid");
  for (let i = 0; i < 3; i += 1) {
    const card = el("article", "event-hub-card event-hub-card--skeleton");
    card.append(el("div", "event-hub-card__media event-hub-card__media--skeleton"));
    card.append(el("div", "event-hub-card__body event-hub-card__body--skeleton"));
    grid.append(card);
  }
  shell.append(grid);
  mount.append(shell);
}

function renderError(mount: HTMLElement, onRetry: () => void, message?: string): void {
  mount.replaceChildren();
  mount.classList.remove("event-hub--loading");
  const shell = el("div", "event-hub event-hub--status");
  shell.setAttribute("role", "alert");
  shell.append(el("p", "event-hub__eyebrow", "LAX — London Auction Exchange"));
  shell.append(el("h1", "event-hub__title", "Upcoming events"));
  shell.append(
    el(
      "p",
      "event-hub__lead",
      message ?? "We couldn't load upcoming events. Check your connection and try again.",
    ),
  );
  const retry = el("button", "event-hub__cta", "Try again") as HTMLButtonElement;
  retry.type = "button";
  retry.addEventListener("click", onRetry);
  shell.append(retry);
  mount.append(shell);
}

function renderEmpty(mount: HTMLElement): void {
  mount.replaceChildren();
  mount.classList.remove("event-hub--loading");
  const shell = el("div", "event-hub event-hub--status");
  shell.append(el("p", "event-hub__eyebrow", "LAX — London Auction Exchange"));
  shell.append(el("h1", "event-hub__title", "Upcoming events"));
  shell.append(
    el(
      "p",
      "event-hub__lead",
      "No upcoming events right now — check back soon for the next invitation-only evening.",
    ),
  );
  const footer = el("footer", "event-hub__footer");
  const logoLink = el("a", "event-hub__brand-link") as HTMLAnchorElement;
  logoLink.href = "https://lax.bid";
  logoLink.target = "_blank";
  logoLink.rel = "noopener noreferrer";
  const logo = el("img", "event-hub__brand-logo") as HTMLImageElement;
  logo.src = BRAND.laxWordmark;
  logo.alt = "LAX — London Auction Exchange";
  logoLink.append(logo);
  footer.append(logoLink);
  shell.append(footer);
  mount.append(shell);
}

function renderEventCard(event: OnsiteEventPublicListItem): HTMLElement {
  const card = el("article", "event-hub-card");
  const media = el("div", "event-hub-card__media");
  const img = el("img", "event-hub-card__img") as HTMLImageElement;
  img.src = eventAssetPath("hero.jpg", event.slug);
  img.alt = `${event.title} — invitation hero`;
  img.loading = "lazy";
  img.addEventListener("error", () => {
    img.hidden = true;
    media.classList.add("event-hub-card__media--fallback");
  });
  media.append(img);
  card.append(media);

  const body = el("div", "event-hub-card__body");
  const modeLabel = deliveryModeLabel(event.deliveryMode);
  if (modeLabel) {
    body.append(el("span", "event-hub-card__badge", modeLabel));
  }
  body.append(el("h2", "event-hub-card__title", event.title));

  const dateLabel = formatEventDateTimeLondon(event.startsAt);
  if (dateLabel) {
    body.append(el("p", "event-hub-card__meta event-hub-card__meta--date", dateLabel));
  } else {
    body.append(el("p", "event-hub-card__meta event-hub-card__meta--date", "Date to be announced"));
  }

  if (event.venue?.trim()) {
    body.append(el("p", "event-hub-card__meta event-hub-card__meta--venue", event.venue.trim()));
  }

  if (event.dressCode?.trim()) {
    body.append(
      el(
        "p",
        "event-hub-card__meta event-hub-card__meta--dress",
        `Dress code: ${event.dressCode.trim()}`,
      ),
    );
  }

  const href = eventInvitationHref(event);
  const link = el("a", "event-hub-card__cta", "View invitation") as HTMLAnchorElement;
  link.href = href;
  body.append(link);
  card.append(body);
  return card;
}

function renderSuccess(mount: HTMLElement, events: OnsiteEventPublicListItem[]): void {
  mount.replaceChildren();
  mount.classList.remove("event-hub--loading");
  const shell = el("div", "event-hub");
  shell.append(el("p", "event-hub__eyebrow", "Strictly by invitation"));
  shell.append(el("h1", "event-hub__title", "Upcoming events"));
  shell.append(
    el(
      "p",
      "event-hub__lead",
      "Select an evening below to view your invitation and RSVP. Each event is personal and non-transferable.",
    ),
  );

  const grid = el("div", "event-hub__grid");
  for (const event of events) {
    grid.append(renderEventCard(event));
  }
  shell.append(grid);

  const footer = el("footer", "event-hub__footer");
  const logoLink = el("a", "event-hub__brand-link") as HTMLAnchorElement;
  logoLink.href = "https://lax.bid";
  logoLink.target = "_blank";
  logoLink.rel = "noopener noreferrer";
  const logo = el("img", "event-hub__brand-logo") as HTMLImageElement;
  logo.src = BRAND.laxWordmark;
  logo.alt = "LAX — London Auction Exchange";
  logoLink.append(logo);
  footer.append(logoLink);
  shell.append(footer);
  mount.append(shell);
}

export async function renderEventHub(mount: HTMLElement): Promise<void> {
  async function load() {
    renderLoading(mount);
    try {
      const events = await fetchUpcomingEventsWithRetry();
      if (events.length === 0) {
        renderEmpty(mount);
        return;
      }
      renderSuccess(mount, events);
    } catch (error) {
      const message = isRsvpApiError(error)
        ? error.message !== error.code
          ? error.message
          : undefined
        : error instanceof Error
          ? error.message
          : undefined;
      renderError(mount, () => void load(), message);
    }
  }

  await load();
}
