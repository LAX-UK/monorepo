import { EVENT_START_AT } from "./config.js";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  remainingMs: number;
};

let countdownTarget = EVENT_START_AT;
let intervalId: number | null = null;

export function parseCountdownTarget(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveCountdownTarget(iso: string | null | undefined): Date {
  return parseCountdownTarget(iso) ?? EVENT_START_AT;
}

export function breakdownCountdown(remainingMs: number): CountdownParts {
  if (remainingMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, remainingMs: 0 };
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes, remainingMs };
}

export function setEventCountdownTarget(target: Date): void {
  countdownTarget = target;
  tickEventCountdown();
}

export function setEventCountdownFromIso(iso: string | null | undefined): void {
  setEventCountdownTarget(resolveCountdownTarget(iso));
}

export function tickEventCountdown(now = Date.now()): boolean {
  const root = document.getElementById("event-countdown");
  if (!root) return false;

  const parts = {
    days: root.querySelector<HTMLElement>("[data-countdown='days']"),
    hours: root.querySelector<HTMLElement>("[data-countdown='hours']"),
    minutes: root.querySelector<HTMLElement>("[data-countdown='minutes']"),
  };

  const remaining = countdownTarget.getTime() - now;
  if (remaining <= 0) {
    root.classList.add("is-live");
    const label = root.querySelector<HTMLElement>(".event-countdown__label");
    if (label) label.textContent = "Tonight";
    for (const node of Object.values(parts)) {
      if (node) node.textContent = "—";
    }
    return true;
  }

  root.classList.remove("is-live");
  const label = root.querySelector<HTMLElement>(".event-countdown__label");
  if (label) label.textContent = "Countdown to opening night";

  const { days, hours, minutes } = breakdownCountdown(remaining);
  if (parts.days) parts.days.textContent = String(days);
  if (parts.hours) parts.hours.textContent = String(hours).padStart(2, "0");
  if (parts.minutes) parts.minutes.textContent = String(minutes).padStart(2, "0");
  return false;
}

export function initEventCountdown(): void {
  if (intervalId != null) return;
  tickEventCountdown();
  intervalId = window.setInterval(() => {
    if (tickEventCountdown()) {
      if (intervalId != null) window.clearInterval(intervalId);
      intervalId = null;
    }
  }, 60_000);
}
