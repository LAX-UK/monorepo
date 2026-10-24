import {
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  ACCOUNT_DELETION_GRACE_DAYS,
  type AccountDeletionStatus,
  type DeletionBlocker,
  type DeletionEligibilityProduct,
  accountDeletionVerdict,
} from "@auction/identity-contracts";

const PRODUCT_LABELS: Record<DeletionEligibilityProduct, string> = {
  bid: "LAX Bid",
  shop: "LAX Shop and lax.art",
};

export type DeletionBlockerGroupVm = {
  product: DeletionEligibilityProduct;
  label: string;
  blockers: DeletionBlocker[];
};

/**
 * What the Delete your account page shows. Each kind is a different page, so the component
 * never has to infer one from missing fields:
 *  - `unavailable`: Identity could not be asked at all, so nothing is known;
 *  - `requested`: deletion is under way, and can be cancelled until `deleteOn`;
 *  - `blocked`: something is in the way; `unreachable` lists products that also could not be asked;
 *  - `check_failed`: nothing was named but a product could not be asked, so try again;
 *  - `eligible`: every product answered and none has anything in the way.
 */
export type DeletionPageVm =
  | { kind: "unavailable" }
  | { kind: "requested"; requestedOn: string; deleteOn: string }
  | { kind: "blocked"; groups: DeletionBlockerGroupVm[]; unreachable: string[] }
  | { kind: "check_failed"; unreachable: string[] }
  | { kind: "eligible"; phrase: string; consequences: string[] };

const DAY_MS = 24 * 60 * 60 * 1000;

function longDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildDeletionPageVm(status: AccountDeletionStatus | null): DeletionPageVm {
  if (!status) return { kind: "unavailable" };
  const verdict = accountDeletionVerdict(status);
  const unreachable = status.products
    .filter((product) => product.state === "unavailable")
    .map((product) => PRODUCT_LABELS[product.product]);

  if (verdict === "requested" && status.requestedAt) {
    const requested = new Date(status.requestedAt);
    return {
      kind: "requested",
      requestedOn: longDate(requested),
      deleteOn: longDate(new Date(requested.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)),
    };
  }
  if (verdict === "blocked") {
    return {
      kind: "blocked",
      groups: status.products
        .filter((product) => product.state === "blocked")
        .map((product) => ({
          product: product.product,
          label: PRODUCT_LABELS[product.product],
          blockers: product.blockers,
        })),
      unreachable,
    };
  }
  if (verdict === "unavailable") return { kind: "check_failed", unreachable };
  return {
    kind: "eligible",
    phrase: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
    consequences: [
      `We'll schedule your account for deletion. For ${ACCOUNT_DELETION_GRACE_DAYS} days you can cancel and keep everything.`,
      `After ${ACCOUNT_DELETION_GRACE_DAYS} days we permanently erase your name, email address, phone number, saved addresses and profile picture.`,
      "We also delete your password, any linked Google or Apple sign-in, your two-step verification and every device you're signed in on.",
      "You won't be able to sign in to LAX Bid, LAX Shop or lax.art with this account again.",
      "We keep your orders, invoices and payments without your personal details, because the law and our accounting rules require us to.",
    ],
  };
}
