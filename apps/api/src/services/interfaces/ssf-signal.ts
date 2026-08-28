/** A valid, replay-reserved SET superseded by a newer durable outbox event. */
export class StaleSsfSignalError extends Error {
  constructor() {
    super("stale_ssf_signal");
    this.name = "StaleSsfSignalError";
  }
}
