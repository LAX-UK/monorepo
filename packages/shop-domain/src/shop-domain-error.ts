export class ShopDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopDomainError";
  }
}
