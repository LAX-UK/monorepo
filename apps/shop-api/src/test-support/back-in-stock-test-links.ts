import { AlertLinkCodec, keyringFrom } from "@auction/alerts";
import type { Database } from "@auction/db";
import { createBackInStockLinks } from "../infrastructure/alerts/back-in-stock-links.js";
import { ShopAlertSubscriberStore } from "../infrastructure/alerts/shop-alert-subscriber.store.js";
import { ShopAlertTopicStore } from "../infrastructure/alerts/shop-alert-topic.store.js";
import { shopAlertUrls } from "../infrastructure/alerts/shop-alert-urls.js";

/** The test secret every back-in-stock integration test signs with. */
export const TEST_LINK_KEYRING = keyringFrom({
  keyId: "test",
  secret: "back-in-stock-test-secret-0123456789", // gitleaks:allow
});

/** Real engine stores on the test database, so a dispatch writes and signs the way production does. */
export function createTestBackInStockLinks(db: Database, shopOrigin = "http://localhost:3020") {
  const codec = new AlertLinkCodec(TEST_LINK_KEYRING);
  const links = createBackInStockLinks({
    subscribers: new ShopAlertSubscriberStore(db),
    topics: new ShopAlertTopicStore(db),
    codec,
    urls: shopAlertUrls(shopOrigin, "http://localhost:3010/alerts"),
    clock: { now: () => new Date() },
  });
  return { links, codec };
}
