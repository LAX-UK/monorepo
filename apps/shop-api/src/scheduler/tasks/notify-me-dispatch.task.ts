import type { Database } from "@auction/db";
import type { ShopNotificationPublisher } from "../../application/ports/shop-notification.publisher.js";
import type { StorefrontOrigins } from "../../domain/storefront-origins.js";
import type { BackInStockLinks } from "../../infrastructure/alerts/back-in-stock-links.js";
import { dispatchShopNotifyMeEmails } from "../../infrastructure/shop-notify-me-dispatch.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createNotifyMeDispatchTask(
  db: Database,
  input: {
    notifications: ShopNotificationPublisher;
    links: BackInStockLinks;
    storefrontOrigins: StorefrontOrigins;
  },
): ShopSchedulerTask {
  return {
    name: "notify-me-dispatch",
    run: (now) =>
      dispatchShopNotifyMeEmails(db, {
        notifications: input.notifications,
        links: input.links,
        storefrontOrigins: input.storefrontOrigins,
        now,
      }).then(() => undefined),
  };
}
