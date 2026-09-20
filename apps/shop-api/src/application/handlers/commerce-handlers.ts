import type {
  BasketOwner,
  BasketRepository,
  CheckoutWriter,
  ListOrdersInput,
  OrderReader,
} from "../ports/commerce.ports.js";

export function createGetBasketHandler(repo: BasketRepository) {
  return (owner: BasketOwner) => repo.getBasket(owner);
}

export function createUpsertBasketLineHandler(repo: BasketRepository) {
  return (input: { owner: BasketOwner; artworkSlug: string; quantity: number }) =>
    repo.addOrUpdateLine(input);
}

export function createRemoveBasketLineHandler(repo: BasketRepository) {
  return (input: { owner: BasketOwner; lineId: string }) => repo.removeLine(input);
}

export function createMergeBasketsHandler(repo: BasketRepository) {
  return (input: {
    from: BasketOwner;
    to: { kind: "subject"; identitySubjectId: string };
  }) => repo.mergeBaskets(input);
}

export function createCheckoutOrderHandler(repo: CheckoutWriter) {
  return (input: Parameters<CheckoutWriter["createCheckoutOrder"]>[0]) =>
    repo.createCheckoutOrder(input);
}

export function createListOrdersHandler(repo: OrderReader) {
  return (subject: string, input: ListOrdersInput) => repo.listOrders(subject, input);
}

export function createGetOrderHandler(repo: OrderReader) {
  return (subject: string, orderId: string) => repo.getOrder(subject, orderId);
}
