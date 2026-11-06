import { SubjectExportRegistry } from "@auction/identity-contracts/subject-export-readers";
import { BasketCategory } from "./categories/basket.category.js";
import { EnquiriesCategory } from "./categories/enquiries.category.js";
import { InvoicesCategory } from "./categories/invoices.category.js";
import { NotificationsAndMarketingCategory } from "./categories/notifications-and-marketing.category.js";
import { OrdersCategory } from "./categories/orders.category.js";
import { PaymentsCategory } from "./categories/payments.category.js";
import { SavedWorksCategory } from "./categories/saved-works.category.js";
import { SellingPayoutsCategory } from "./categories/selling-payouts.category.js";
import { SellingCategory } from "./categories/selling.category.js";
import { ShopProfileCategory } from "./categories/shop-profile.category.js";
import type { SubjectExportDeps } from "./subject-export-deps.js";

/** The Shop and lax.art categories, in the order the shared contract lists them. */
export function createShopSubjectExportRegistry(deps: SubjectExportDeps): SubjectExportRegistry {
  return new SubjectExportRegistry([
    new ShopProfileCategory(deps),
    new OrdersCategory(deps),
    new InvoicesCategory(deps),
    new PaymentsCategory(deps),
    new BasketCategory(deps),
    new EnquiriesCategory(deps),
    new SavedWorksCategory(deps),
    new SellingCategory(deps),
    new SellingPayoutsCategory(deps),
    new NotificationsAndMarketingCategory(deps),
  ]);
}
