import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SellWithLaxFlow } from "@/components/dashboard/seller/sell-with-lax-flow";
import { SubmissionResubmitBanner } from "@/components/dashboard/submission-resubmit-banner";
import { ClientFlashNotice } from "@/components/flash/client-flash-notice";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerAccountPurchaseFacts } from "@/lib/data/http/account-buying.server";
import { listServerReturnedWorks } from "@/lib/data/http/workspace-selling.server";
import {
  EMPTY_SUBMISSION_FORM_VALUES,
  itemSubmissionToFormValues,
} from "@/lib/forms/submission/item-submission-form-defaults";
import { findCategoryIdBySlug } from "@/lib/forms/submission/resolve-category-slug";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { REGISTER_ORGANISATION_HREF } from "@/lib/navigation/account-switcher-model";
import { decideConsignLink } from "@/lib/seller/consign-link";
import { actingForOrganisation, sellerAccountChoice } from "@/lib/seller/seller-account-options";
import { Notice } from "@auction/ui/lax";
import { redirect } from "next/navigation";

/**
 * The details of a work the account already has, to start selling it again: one it bought (from
 * the lot) or one that came back unsold (from its consignment). Photos and the work's facts come
 * across; the price and anything about the earlier sale do not.
 */
async function consignAgainValues(
  c: Awaited<ReturnType<typeof getServerDataContainer>>,
  sp: { fromLot?: string; fromSubmission?: string },
  accountId: string | null,
): Promise<{ values: ConsignValues | null; refusal: string | null }> {
  if (!sp.fromLot && !sp.fromSubmission) return { values: null, refusal: null };
  // A link is only an address: the server checks the same rule the collection uses to offer it.
  const [purchases, returned] = await Promise.all([
    sp.fromLot && accountId
      ? getServerAccountPurchaseFacts(accountId).catch(() => null)
      : Promise.resolve(null),
    sp.fromSubmission ? listServerReturnedWorks().catch(() => null) : Promise.resolve(null),
  ]);
  const decision = decideConsignLink({
    ...sp,
    canSell: accountId !== null,
    purchases,
    returned,
  });
  if (decision.kind === "refused") return { values: null, refusal: decision.note };
  const values = await consignValuesFor(c, sp);
  return { values, refusal: null };
}

type ConsignValues = NonNullable<Awaited<ReturnType<typeof consignValuesFor>>>;

async function consignValuesFor(
  c: Awaited<ReturnType<typeof getServerDataContainer>>,
  sp: { fromLot?: string; fromSubmission?: string },
) {
  if (sp.fromSubmission) {
    const prior = await c.submissions.getMineById(sp.fromSubmission).catch(() => null);
    if (!prior) return null;
    return { ...itemSubmissionToFormValues(prior), askingPrice: "", reservePrice: "" };
  }
  if (sp.fromLot) {
    const lot = await c.buyerLots.getById(sp.fromLot).catch(() => null);
    if (!lot) return null;
    return {
      ...EMPTY_SUBMISSION_FORM_VALUES,
      title: lot.title,
      medium: lot.medium ?? "",
      dimensions: lot.dimensions ?? "",
      images: lot.images.slice(0, 10),
      categoryIds: lot.categoryIds ?? [],
    };
  }
  return null;
}

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{
    fromRejected?: string;
    categorySlug?: string;
    /** "Consign this work" from the collection: a work the organisation bought. */
    fromLot?: string;
    /** "Consign again": a consigned work that came back unsold. */
    fromSubmission?: string;
  }>;
}) {
  const sp = await searchParams;
  const categorySlug =
    typeof sp.categorySlug === "string" && sp.categorySlug.length > 0 ? sp.categorySlug : null;
  const loginNext = categorySlug
    ? `/selling/new?categorySlug=${encodeURIComponent(categorySlug)}`
    : "/selling/new";
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext,
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  // Who may sell as which account comes from each account's capabilities; a finance member of a
  // gallery can still sell under their own name.
  const choice = sellerAccountChoice({
    memberships: sellerCtx.memberships,
    personalName: user.name,
    actingId: sellerCtx.sellerEntityId,
  });
  if (choice.options.length === 0) redirect(DASHBOARD_ROUTES.consignments);
  const c = await getServerDataContainer();
  const categories = await c.categories.tree();
  const fromRejectedId =
    typeof sp.fromRejected === "string" && sp.fromRejected.length > 0 ? sp.fromRejected : null;
  const priorRejected = fromRejectedId
    ? await c.submissions.getMineById(fromRejectedId).catch(() => null)
    : null;
  const resubmitFrom =
    priorRejected?.status === "rejected"
      ? {
          initialValues: itemSubmissionToFormValues(priorRejected),
          rejectionReason: priorRejected.rejectionReason,
          reviewNotes: priorRejected.reviewNotes,
        }
      : null;

  const { values: consignFrom, refusal: consignRefusal } = await consignAgainValues(
    c,
    sp,
    sellerCtx.sellerEntityId,
  );
  const preselectedCategoryId = categorySlug
    ? findCategoryIdBySlug(categories, categorySlug)
    : null;
  const initialValues =
    resubmitFrom?.initialValues ??
    consignFrom ??
    (preselectedCategoryId
      ? { ...EMPTY_SUBMISSION_FORM_VALUES, categoryIds: [preselectedCategoryId] }
      : undefined);

  return (
    <DashboardPage className="max-w-[960px] space-y-6">
      <DashboardPageHeader
        title={SELL_A_WORK_LABEL}
        description="Tell us about the work. A specialist reviews every work, and there's no obligation to sell."
      />
      <ClientFlashNotice path="/selling/new" />
      {resubmitFrom ? (
        <SubmissionResubmitBanner
          rejectionReason={resubmitFrom.rejectionReason}
          reviewNotes={resubmitFrom.reviewNotes}
        />
      ) : null}
      {consignRefusal ? (
        <Notice tone="info" title="We didn't start from that work.">
          {consignRefusal}
        </Notice>
      ) : null}
      <SetMobileShellTitle title={SELL_A_WORK_LABEL} />
      <SellWithLaxFlow
        categories={categories}
        choice={choice}
        registerHref={actingForOrganisation(choice) ? null : REGISTER_ORGANISATION_HREF}
        {...(initialValues ? { initialValues } : {})}
      />
    </DashboardPage>
  );
}
