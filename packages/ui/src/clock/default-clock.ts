import { createClockSource } from "./clock-source.js";
import { type ClockStore, createClockStore } from "./clock-store.js";

let store: ClockStore | null = null;

/** The one clock for this tab. Created on first use so server renders never start a timer. */
export function defaultClockStore(): ClockStore {
  store ??= createClockStore({ source: createClockSource() });
  return store;
}
