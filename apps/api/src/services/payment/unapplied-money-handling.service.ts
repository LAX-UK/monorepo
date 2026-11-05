import type { UnappliedMoneyRecorder } from "@auction/finance-runtime";
import type { ITransactionRunner, IUnappliedMoneyReader } from "@auction/persistence/interfaces";
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

/**
 * Finance closes an unapplied-money task by hand once they have dealt with the money some other
 * way than a refund (applied it to another invoice, say). The reason is kept on the event with
 * their name. Nothing moves: it only records the decision.
 */
export class UnappliedMoneyHandlingService implements IUnappliedMoneyHandling {
  constructor(
    private readonly deps: {
      reader: Pick<IUnappliedMoneyReader, "findOpen">;
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
