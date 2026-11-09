import { BidderProfileCategory } from "./categories/bidder-profile.category.js";
import { BidsCategory } from "./categories/bids.category.js";
import { CollectionsCategory } from "./categories/collections.category.js";
import { ConsignmentsCategory } from "./categories/consignments.category.js";
import { InvoicesCategory } from "./categories/invoices.category.js";
import { MarketingCategory } from "./categories/marketing.category.js";
import { MessagesCategory } from "./categories/messages.category.js";
import { NotificationsCategory } from "./categories/notifications.category.js";
import { OrganisationsCategory } from "./categories/organisations.category.js";
import { PaymentsCategory } from "./categories/payments.category.js";
import { PurchasesCategory } from "./categories/purchases.category.js";
import { RegistrationsCategory } from "./categories/registrations.category.js";
import { VerificationCategory } from "./categories/verification.category.js";
import { WatchlistAndAlertsCategory } from "./categories/watchlist-and-alerts.category.js";
import type { SubjectExportDeps } from "./subject-export-deps.js";
import { SubjectExportRegistry } from "./subject-export.registry.js";
import { SubjectExportService } from "./subject-export.service.js";

/** Every Bid category, in the order the download lists them. A new category is one line here. */
export function createBidSubjectExportRegistry(deps: SubjectExportDeps): SubjectExportRegistry {
  return new SubjectExportRegistry([
    new BidderProfileCategory(deps),
    new RegistrationsCategory(deps),
    new BidsCategory(deps),
    new PurchasesCategory(deps),
    new CollectionsCategory(deps),
    new InvoicesCategory(deps),
    new PaymentsCategory(deps),
    new ConsignmentsCategory(deps),
    new MessagesCategory(deps),
    new WatchlistAndAlertsCategory(deps),
    new NotificationsCategory(deps),
    new MarketingCategory(deps),
    new VerificationCategory(deps),
    new OrganisationsCategory(deps),
  ]);
}

export function createBidSubjectExportService(deps: SubjectExportDeps): SubjectExportService {
  return new SubjectExportService(createBidSubjectExportRegistry(deps));
}
