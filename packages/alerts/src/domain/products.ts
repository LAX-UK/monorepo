/** The products that send alert emails. Each owns its own subscribers, topics and ledgers. */
export const ALERT_PRODUCTS = ["bid", "shop", "art"] as const;
export type AlertProduct = (typeof ALERT_PRODUCTS)[number];

/** The topics each product offers. A subscriber table only ever holds its own product's topics. */
export const TOPICS_BY_PRODUCT = {
  bid: ["bid.new_sales", "bid.artists", "bid.searches"],
  shop: ["shop.releases", "shop.back_in_stock"],
  art: ["art.followed_artists"],
} as const satisfies Record<AlertProduct, readonly string[]>;

export const ALERT_TOPICS = [
  ...TOPICS_BY_PRODUCT.bid,
  ...TOPICS_BY_PRODUCT.shop,
  ...TOPICS_BY_PRODUCT.art,
] as const;
export type AlertTopic = (typeof ALERT_TOPICS)[number];

export function isAlertTopic(value: unknown): value is AlertTopic {
  return typeof value === "string" && (ALERT_TOPICS as readonly string[]).includes(value);
}

export function isAlertProduct(value: unknown): value is AlertProduct {
  return typeof value === "string" && (ALERT_PRODUCTS as readonly string[]).includes(value);
}

export function productOfTopic(topic: AlertTopic): AlertProduct {
  return topic.slice(0, topic.indexOf(".")) as AlertProduct;
}
