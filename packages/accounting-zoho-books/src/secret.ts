const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/** Holds a secret so that logging, JSON and string conversion cannot print it by accident. */
export class Secret {
  readonly #value: string;
  constructor(value: string) {
    this.#value = value;
  }
  reveal(): string {
    return this.#value;
  }
  toString(): string {
    return "[redacted]";
  }
  toJSON(): string {
    return "[redacted]";
  }
  [INSPECT](): string {
    return "[redacted]";
  }
}
