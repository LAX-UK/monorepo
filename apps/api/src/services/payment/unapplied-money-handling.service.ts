import { UNAPPLIED_MONEY_CLOSED_BY_CAPTURE, type UnappliedMoneyReason } from "@auction/domain";
import type { UnappliedMoneyRecorder } from "@auction/finance-runtime";
import type {
  IPaymentReadRepository,
  ITransactionRunner,
  IUnappliedMoneyReader,
} from "@auction/persistence/interfaces";
import type { StaffRoles, UserRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";
import { ADMIN_REFUND_BUYER_REASON_MIN } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError } from "../../lib/errors.js";

export interface IUnappliedMoneyHandling {
  markHandled(input: {
    actorUserId: string;
    role: string;
    staffRoles: StaffRoles | undefined;
    dedupeKey: string;
    reason: string;
  }): Promise<Result<void, AuthzError>>;
}

/** Tasks that close when their invoice is captured, reinstated or refunded, never by hand first. */
const CLOSED_BY_SETTLEMENT: ReadonlySet<UnappliedMoneyReason> = new Set(
  UNAPPLIED_MONEY_CLOSED_BY_CAPTURE,
);
/** Invoice states in which the money has been dealt with. */
const SETTLED: ReadonlySet<string> = new Set(["captured", "refunded"]);

/**
 * Finance closes an unapplied-money task by hand once they have dealt with the money some other
 * way than a refund (applied it to another invoice, say). The reason is kept on the event with
 * their name. Nothing moves: it only records the decision.
 */
export class UnappliedMoneyHandlingService implements IUnappliedMoneyHandling {
  constructor(
    private readonly deps: {
      reader: Pick<IUnappliedMoneyReader, "findOpen">;
      payments: Pick<IPaymentReadRepository, "findById">;
      recorder: Pick<UnappliedMoneyRecorder, "resolve">;
      transactionRunner: ITransactionRunner;
    },
  ) {}

  async markHandled(input: {
    actorUserId: string;
    role: string;
    staffRoles: StaffRoles | undefined;
    dedupeKey: string;
    reason: string;
  }): Promise<Result<void, AuthzError>> {
    if (!roleHasCapability(input.role as UserRole, "finance.platform.write", input.staffRoles)) {
      return err(new AuthzError("Forbidden", 403));
    }
    const note = input.reason.trim();
    if (note.length < ADMIN_REFUND_BUYER_REASON_MIN) {
      return err(
        new AuthzError(
          `Enter a reason of at least ${ADMIN_REFUND_BUYER_REASON_MIN} characters.`,
          400,
        ),
      );
    }
    const open = await this.deps.reader.findOpen(input.dedupeKey);
    if (!open) return err(new AuthzError("This has already been dealt with", 409));
    // Money for the invoice itself closes only when the invoice is settled: marking it handled
    // while the invoice is unpaid would leave the buyer's money taken and the seller unpaid.
    // Fail closed: with no invoice to check (no id on the task, or the row cannot be read) the
    // money cannot be shown to be settled, so it is not closed by hand either.
    if (CLOSED_BY_SETTLEMENT.has(open.reason)) {
      const invoice = open.paymentId ? await this.deps.payments.findById(open.paymentId) : null;
      if (!invoice) {
        return err(
          new AuthzError(
            "The invoice for this payment cannot be found, so it cannot be marked handled. Ask engineering to check the payment record.",
            409,
          ),
        );
      }
      if (!SETTLED.has(invoice.status)) {
        return err(
          new AuthzError(
            "This is the buyer's payment for the invoice, which is still unpaid. Capture or reinstate the payment, or refund it, instead.",
            409,
          ),
        );
      }
    }
    await this.deps.transactionRunner.runInTransaction((tx) =>
      this.deps.recorder.resolve(tx, [open], {
        via: "staff",
        actorUserId: input.actorUserId,
        note,
      }),
    );
    return ok(undefined);
  }
}
