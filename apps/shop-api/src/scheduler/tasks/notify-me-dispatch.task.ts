import type { Database } from "@auction/db";
import type { ShopNotificationPublisher } from "../../application/ports/shop-notification.publisher.js";
import type { StorefrontOrigins } from "../../domain/storefront-origins.js";
import { dispatchShopNotifyMeEmails } from "../../infrastructure/shop-notify-me-dispatch.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createNotifyMeDispatchTask(
  db: Database,
  input: { notifications: ShopNotificationPublisher; storefrontOrigins: StorefrontOrigins },
): ShopSchedulerTask {
  return {
    name: "notify-me-dispatch",
    run: (now) =>
      dispatchShopNotifyMeEmails(db, {
        notifications: input.notifications,
        storefrontOrigins: input.storefrontOrigins,
        now,
      }).then(() => undefined),
  };
}
