export class ArtApiBffError extends Error {
  readonly kind: "upstream" | "malformed";

  constructor(kind: "upstream" | "malformed", message: string) {
    super(message);
    this.name = "ArtApiBffError";
    this.kind = kind;
  }
}
