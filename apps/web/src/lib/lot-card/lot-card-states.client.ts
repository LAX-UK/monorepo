import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { type LotCardState, parseLotCardStates } from "./lot-card-states";

/** The API reads up to this many lots in one call. */
export const LOT_STATES_BATCH_SIZE = 60;
/** Cards that ask within this window share one request. */
const BATCH_WINDOW_MS = 25;

type Waiter = (state: LotCardState | null) => void;

async function readStates(lotIds: readonly string[]): Promise<Map<string, LotCardState>> {
  try {
    const query = encodeURIComponent(lotIds.join(","));
    const res = await browserFetch(`${browserApiBase()}/users/me/lot-states?lotIds=${query}`);
    if (!res.ok) return new Map();
    const body: unknown = await res.json();
    const states = parseLotCardStates(isIndexableObject(body) ? body.data : null);
    return new Map(states.map((state) => [state.lotId, state]));
  } catch {
    return new Map();
  }
}

let waiting = new Map<string, Waiter[]>();
let scheduled = false;

async function flush(): Promise<void> {
  const batch = waiting;
  waiting = new Map();
  scheduled = false;
  const ids = [...batch.keys()];
  for (let start = 0; start < ids.length; start += LOT_STATES_BATCH_SIZE) {
    const slice = ids.slice(start, start + LOT_STATES_BATCH_SIZE);
    const found = await readStates(slice);
    for (const id of slice) {
      for (const resolve of batch.get(id) ?? []) resolve(found.get(id) ?? null);
    }
  }
}

/**
 * The viewer's standing on one lot. Every card on a page asks for its own lot; the asks made in
 * the same moment leave as one request, so a grid of 24 cards costs a single call.
 */
export function fetchLotCardState(lotId: string): Promise<LotCardState | null> {
  return new Promise((resolve) => {
    waiting.set(lotId, [...(waiting.get(lotId) ?? []), resolve]);
    if (!scheduled) {
      scheduled = true;
      setTimeout(() => void flush(), BATCH_WINDOW_MS);
    }
  });
}
