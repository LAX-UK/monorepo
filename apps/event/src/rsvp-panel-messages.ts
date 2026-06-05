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

export function renderBootstrapLoading(mount: HTMLElement): void {
  mount.removeAttribute("role");
  mount.replaceChildren();

  const skeleton = el("div", "rsvp-skeleton");
  skeleton.setAttribute("aria-hidden", "true");
  skeleton.append(
    el("div", "rsvp-skeleton__bar"),
    el("div", "rsvp-skeleton__bar rsvp-skeleton__bar--short"),
    el("div", "rsvp-skeleton__field"),
    el("div", "rsvp-skeleton__btn"),
  );
  mount.append(skeleton);
  mount.classList.add("rsvp-panel--loading");
}

export function renderBootstrapError(mount: HTMLElement, onRetry: () => void): void {
  mount.replaceChildren();
  mount.setAttribute("role", "alert");

  const card = el("div", "rsvp-card rsvp-card-enter rsvp-card--status");

  const mark = el("div", "rsvp-status-mark", "…");
  mark.setAttribute("aria-hidden", "true");
  card.append(mark);
  card.append(el("p", "rsvp-status-eyebrow", "One moment"));
  card.append(el("h3", "rsvp-status-title", "RSVP isn't available just now"));
  card.append(
    el(
      "p",
      "rsvp-status-copy",
      "We couldn't reach our servers. Please try again — or contact our events team below if you need help straight away.",
    ),
  );

  if (import.meta.env.DEV) {
    card.append(
      el(
        "p",
        "rsvp-status-hint",
        "Local dev: run the API on port 3001 (pnpm --filter @auction/api dev) with Postgres migrated, then hard-refresh this page.",
      ),
    );
  }

  const actions = el("div", "rsvp-actions");
  const retry = el("button", "rsvp-btn rsvp-btn-primary", "TRY AGAIN") as HTMLButtonElement;
  retry.type = "button";
  retry.addEventListener("click", onRetry);
  actions.append(retry);
  card.append(actions);
  mount.append(card);
}
