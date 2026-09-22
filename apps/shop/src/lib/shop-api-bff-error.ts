export class ShopApiBffError extends Error {
  readonly kind: "upstream" | "malformed";

  constructor(kind: "upstream" | "malformed", message: string) {
    super(message);
    this.name = "ShopApiBffError";
    this.kind = kind;
  }
}
