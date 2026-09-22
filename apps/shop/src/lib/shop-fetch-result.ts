export type ShopFetchResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "unauthorized" }
  | { status: "failed" };

export type ShopInterestReadResult =
  | { status: "ok"; data: { subscribed: boolean } }
  | { status: "guest" }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "commerce_unavailable" }
  | { status: "failed" };
