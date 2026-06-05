import { EVENT_DETAILS, EVENT_START_AT } from "./config.js";
import { downloadOpeningEventCalendar } from "./rsvp-calendar.js";

export function initPageEffects(): void {
  initScrollReveal();
  initSmoothScroll();
  initCountdown();
  initStickyRsvp();
  initAddToCalendar();
  initShareInvite();
  initScrollProgress();
  initHighlightParallax();
  initHeroEntrance();
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initScrollReveal(): void {
  const nodes = document.querySelectorAll<HTMLElement>(".reveal");
  if (nodes.length === 0) return;

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    for (const node of nodes) node.classList.add("is-visible");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );

  for (const node of nodes) observer.observe(node);
}

function initSmoothScroll(): void {
  document.addEventListener("click", (event) => {
    const target = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='#']");
    if (!target?.hash || target.hash === "#") return;

    const section = document.querySelector<HTMLElement>(target.hash);
    if (!section) return;

    event.preventDefault();
    section.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", target.hash);
  });
}

function initCountdown(): void {
  const root = document.getElementById("event-countdown");
  if (!root) return;

  const parts = {
    days: root.querySelector<HTMLElement>("[data-countdown='days']"),
    hours: root.querySelector<HTMLElement>("[data-countdown='hours']"),
    minutes: root.querySelector<HTMLElement>("[data-countdown='minutes']"),
  };

  const tick = () => {
    const remaining = EVENT_START_AT.getTime() - Date.now();
    if (remaining <= 0) {
      root.classList.add("is-live");
      const label = root.querySelector<HTMLElement>(".event-countdown__label");
      if (label) label.textContent = "Tonight";
      for (const node of Object.values(parts)) {
        if (node) node.textContent = "—";
      }
      return;
    }

    const totalMinutes = Math.floor(remaining / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (parts.days) parts.days.textContent = String(days);
    if (parts.hours) parts.hours.textContent = String(hours).padStart(2, "0");
    if (parts.minutes) parts.minutes.textContent = String(minutes).padStart(2, "0");
  };

  tick();
  window.setInterval(tick, 30_000);
}

function initStickyRsvp(): void {
  const sticky = document.getElementById("sticky-rsvp");
  const hero = document.querySelector<HTMLElement>(".hero-bid-strip");
  const rsvp = document.getElementById("rsvp");
  if (!sticky || !hero || !("IntersectionObserver" in window)) return;

  let heroVisible = true;
  let rsvpVisible = false;

  const update = () => {
    sticky.classList.toggle("is-visible", !heroVisible && !rsvpVisible);
  };

  const heroObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      heroVisible = entry.isIntersecting;
      update();
    },
    { threshold: 0 },
  );

  heroObserver.observe(hero);

  if (rsvp) {
    const rsvpObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        rsvpVisible = entry.isIntersecting;
        update();
      },
      { threshold: 0.35 },
    );
    rsvpObserver.observe(rsvp);
  }
}

function initAddToCalendar(): void {
  const trigger = document.getElementById("add-to-calendar");
  if (!trigger) return;

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    downloadOpeningEventCalendar();
  });
}

function initHeroEntrance(): void {
  const hero = document.querySelector<HTMLElement>("[data-event-asset='hero']");
  if (!hero || prefersReducedMotion()) return;
  requestAnimationFrame(() => hero.classList.add("is-loaded"));
}

function initScrollProgress(): void {
  const bar = document.getElementById("scroll-progress");
  if (!bar || prefersReducedMotion()) return;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initShareInvite(): void {
  const trigger = document.getElementById("share-invite");
  const feedback = document.getElementById("share-invite-feedback");
  if (!trigger) return;

  trigger.addEventListener("click", async () => {
    const url = window.location.href.split("#")[0] ?? window.location.href;
    const payload = {
      title: EVENT_DETAILS.title,
      text: "You're invited to LAX 001: The First Hammer — Thursday 18 June 2026, London.",
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(url);
      if (feedback) {
        feedback.textContent = "Link copied";
        feedback.hidden = false;
        window.setTimeout(() => {
          feedback.hidden = true;
        }, 2400);
      }
    } catch {
      /* user dismissed share sheet */
    }
  });
}

function initHighlightParallax(): void {
  const media = document.querySelector<HTMLElement>(".highlight-lot__media");
  const image = document.querySelector<HTMLElement>(".highlight-lot__img");
  if (!media || !image || prefersReducedMotion()) return;

  const onScroll = () => {
    const rect = media.getBoundingClientRect();
    const viewHeight = window.innerHeight;
    if (rect.bottom < 0 || rect.top > viewHeight) return;
    const progress = (viewHeight - rect.top) / (viewHeight + rect.height);
    const offset = (progress - 0.5) * 12;
    image.style.transform = `translate3d(0, ${offset}px, 0)`;
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}
