export type ShopPortalFetchResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "unauthorized" }
  | { status: "commerce_unavailable" }
  | { status: "failed" };
