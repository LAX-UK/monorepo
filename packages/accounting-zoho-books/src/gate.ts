import { ZohoRateLimitedError } from "./errors.js";
import type { Clock } from "./ports.js";

export interface GateOptions {
  readonly ratePerMinute: number;
  readonly maxConcurrent: number;
  readonly maxQueueWaitMs: number;
}

const WINDOW_MS = 60_000;

/** One organisation's limits: a sliding window of requests per minute and a cap on requests in flight. */
class OrgGate {
  private readonly sent: number[] = [];
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  private rateTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly clock: Clock,
    private readonly options: GateOptions,
  ) {}

  async acquire(): Promise<() => void> {
    const deadline = this.clock.now() + this.options.maxQueueWaitMs;
    await this.takeConcurrencySlot(deadline);
    try {
      await this.takeRateSlot(deadline);
    } catch (error) {
      this.releaseConcurrencySlot();
      throw error;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseConcurrencySlot();
    };
  }

  private takeConcurrencySlot(deadline: number): Promise<void> {
    if (this.active < this.options.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        clearTimer.abort();
        resolve(); // the slot is handed over: `active` stays as it was
      };
      const clearTimer = new AbortController();
      this.waiting.push(grant);
      void this.clock
        .sleep(Math.max(0, deadline - this.clock.now()), clearTimer.signal)
        .then(() => {
          const at = this.waiting.indexOf(grant);
          if (at === -1) return; // already granted
          this.waiting.splice(at, 1);
          reject(new ZohoRateLimitedError({ code: "queue_timeout", source: "local" }));
        });
    });
  }

  private releaseConcurrencySlot(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active -= 1;
  }

  /** Slots are handed out one at a time in arrival order. */
  private takeRateSlot(deadline: number): Promise<void> {
    const run = async (): Promise<void> => {
      for (;;) {
        const now = this.clock.now();
        while (this.sent.length > 0 && now - (this.sent[0] as number) >= WINDOW_MS)
          this.sent.shift();
        if (this.sent.length < this.options.ratePerMinute) {
          this.sent.push(now);
          return;
        }
        const wait = (this.sent[0] as number) + WINDOW_MS - now;
        if (now + wait > deadline) {
          throw new ZohoRateLimitedError({ code: "queue_timeout", source: "local" });
        }
        await this.clock.sleep(wait);
      }
    };
    const result = this.rateTail.then(run);
    this.rateTail = result.catch(() => undefined);
    return result;
  }
}

/** Rate limit (100 requests a minute) and concurrency cap (5) for each organisation separately. */
export class RequestGate {
  private readonly gates = new Map<string, OrgGate>();

  constructor(
    private readonly clock: Clock,
    private readonly options: GateOptions,
  ) {}

  /** Resolves with a `release` to call when the request has finished. Rejects if the wait is too long. */
  acquire(organizationId: string): Promise<() => void> {
    let gate = this.gates.get(organizationId);
    if (!gate) {
      gate = new OrgGate(this.clock, this.options);
      this.gates.set(organizationId, gate);
    }
    return gate.acquire();
  }
}
