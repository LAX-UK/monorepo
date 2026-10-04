#!/usr/bin/env node
import type { ShopStaffCapability, ShopStaffRole } from "@auction/shop-domain";
import { roleHasCapability } from "@auction/shop-domain";
import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function requireIdempotencyKey(action: string): string {
  const key = readArg("--idempotency-key")?.trim() ?? readArg("--key")?.trim();
  if (!key) {
    throw new Error(`${action} requires --idempotency-key <stable-key> (or --key)`);
  }
  return key;
}

function usage(): never {
  console.error(`Usage: shop-ops <group> <action> --operator <ops:email> --reason <text> [options]

Groups:
  production create-task --order-line-id <uuid> --edition-id <uuid> --idempotency-key <key>
  refund request --order-id <uuid> --amount-pence <n> [--order-line-id <uuid>] --idempotency-key <key> --confirm
  payout mark-paid --payout-id <uuid> --paid-reference <ref> --idempotency-key <key> --confirm [--approved-by <ops:email>]
  backfill phase2 --dry-run
  staff grant --subject <id> --role <role>
`);
  process.exit(1);
}

const operator = readArg("--operator")?.trim();
const reason = readArg("--reason")?.trim();
const group = process.argv[2];
const action = process.argv[3];

if (!group || !action || !operator || !reason) {
  usage();
}

const env = loadShopApiEnv();
const container = createShopApiContainer(env);

async function assertFinanceCliEnabled(): Promise<void> {
  if (!env.SHOP_OPS_FINANCE_CLI_ENABLED) {
    throw new Error("SHOP_OPS_FINANCE_CLI_ENABLED must be true for finance subcommands");
  }
}

async function assertOperatorCapability(
  subjectId: string,
  capability: ShopStaffCapability,
): Promise<ShopStaffRole> {
  const staff = await container.app.staffReader.findActiveByIdentitySubject(subjectId);
  if (!staff || !roleHasCapability(staff.role, capability)) {
    throw new Error(`Operator ${subjectId} lacks capability ${capability}`);
  }
  return staff.role;
}

function hostIdentity(): string {
  return `${process.env.HOSTNAME ?? "local"}:${process.pid}`;
}

function cliOperatorContext(
  approvedBy?: string,
): import("../application/admin/operator-context.js").ShopOperatorContext {
  const ctx: import("../application/admin/operator-context.js").ShopOperatorContext = {
    reason: reason as string,
    host: hostIdentity(),
  };
  const osUser = process.env.USER ?? process.env.LOGNAME;
  if (osUser) {
    ctx.osUser = osUser;
  }
  if (approvedBy) {
    ctx.approvedBy = approvedBy;
  }
  return ctx;
}

try {
  if (group === "backfill" && action === "phase2") {
    if (!hasFlag("--dry-run")) {
      throw new Error("backfill phase2 requires --dry-run");
    }
    const rows = await container.reportPhase2BackfillDryRun();
    console.log(
      JSON.stringify({ dryRun: true, host: hostIdentity(), operator, reason, rows }, null, 2),
    );
  } else if (group === "production" && action === "create-task") {
    const orderLineId = readArg("--order-line-id")?.trim();
    const editionId = readArg("--edition-id")?.trim();
    const idempotencyKey = requireIdempotencyKey("production create-task");
    if (!orderLineId || !editionId) {
      usage();
    }
    await assertOperatorCapability(operator, "production.write");
    const result = await container.app.admin.createProductionTask({
      orderLineId,
      editionId,
      actorSubjectId: operator,
      idempotencyKey,
      operatorContext: cliOperatorContext(),
    });
    console.log(JSON.stringify({ ...result, operator, reason, host: hostIdentity() }, null, 2));
  } else if (group === "refund" && action === "request") {
    await assertFinanceCliEnabled();
    if (!hasFlag("--confirm")) {
      throw new Error("refund request requires --confirm");
    }
    const approvedBy = readArg("--approved-by")?.trim();
    const orderId = readArg("--order-id")?.trim();
    const amountRaw = readArg("--amount-pence");
    const amountPence = amountRaw ? Number(amountRaw) : Number.NaN;
    const orderLineId = readArg("--order-line-id")?.trim();
    const idempotencyKey = requireIdempotencyKey("refund request");
    if (!orderId || !Number.isFinite(amountPence)) {
      usage();
    }
    await assertOperatorCapability(operator, "refund.write");
    if (amountPence > env.SHOP_OPS_DUAL_CONTROL_PENCE) {
      if (!approvedBy || approvedBy === operator) {
        throw new Error(
          `--approved-by <different finance operator> required above ${env.SHOP_OPS_DUAL_CONTROL_PENCE} pence`,
        );
      }
      await assertOperatorCapability(approvedBy, "refund.write");
    }
    const result = await container.app.admin.requestRefund({
      orderId,
      amountPence,
      idempotencyKey,
      actorSubjectId: operator,
      operatorContext: cliOperatorContext(approvedBy),
      ...(orderLineId ? { orderLineId } : {}),
    });
    await container.queueFinanceOpsAlert({
      idempotencyKey: `cli-alert:${idempotencyKey}`,
      action: "refund.request",
      orderId,
      detail: `Refund ${result.refundId} for order ${orderId}, ${amountPence} pence`,
      operator,
      reason,
      host: hostIdentity(),
    });
    console.log(
      JSON.stringify(
        { ...result, operator, reason, host: hostIdentity(), approvedBy: approvedBy ?? null },
        null,
        2,
      ),
    );
  } else if (group === "payout" && action === "mark-paid") {
    await assertFinanceCliEnabled();
    if (!hasFlag("--confirm")) {
      throw new Error("payout mark-paid requires --confirm");
    }
    const payoutId = readArg("--payout-id")?.trim();
    const paidReference = readArg("--paid-reference")?.trim();
    const approvedBy = readArg("--approved-by")?.trim();
    const idempotencyKey = requireIdempotencyKey("payout mark-paid");
    if (!payoutId || !paidReference) {
      usage();
    }
    await assertOperatorCapability(operator, "payout.mark_paid");
    const payoutRow = await container.db.query.shopPayoutLedger.findFirst({
      where: (fields, { eq: eqOp }) => eqOp(fields.id, payoutId),
      columns: { netPence: true, orderLineId: true },
    });
    if (!payoutRow) {
      throw new Error(`Payout ${payoutId} not found`);
    }
    if (payoutRow.netPence > env.SHOP_OPS_DUAL_CONTROL_PENCE) {
      if (!approvedBy || approvedBy === operator) {
        throw new Error(
          `--approved-by <different finance operator> required above ${env.SHOP_OPS_DUAL_CONTROL_PENCE} pence`,
        );
      }
      await assertOperatorCapability(approvedBy, "payout.mark_paid");
    }
    const payoutLineId = payoutRow.orderLineId;
    const orderLine =
      payoutLineId !== null && payoutLineId !== undefined
        ? await container.db.query.shopOrderLine.findFirst({
            where: (fields, { eq: eqOp }) => eqOp(fields.id, payoutLineId),
            columns: { orderId: true },
          })
        : null;
    const alertOrderId = orderLine?.orderId ?? payoutId;

    const result = await container.app.admin.markPayoutPaid({
      payoutId,
      paidReference,
      idempotencyKey,
      actorSubjectId: operator,
      operatorContext: cliOperatorContext(approvedBy),
    });
    await container.queueFinanceOpsAlert({
      idempotencyKey: `cli-alert:${idempotencyKey}`,
      action: "payout.mark_paid",
      orderId: alertOrderId,
      detail: `Marked payout ${payoutId} paid (${paidReference})${approvedBy ? `, approved by ${approvedBy}` : ""}`,
      operator,
      reason,
      host: hostIdentity(),
    });
    console.log(
      JSON.stringify(
        { ...result, operator, reason, host: hostIdentity(), approvedBy: approvedBy ?? null },
        null,
        2,
      ),
    );
  } else if (group === "staff" && action === "grant") {
    const subject = readArg("--subject")?.trim();
    const role = readArg("--role")?.trim();
    if (!subject || !role) {
      usage();
    }
    await assertOperatorCapability(operator, "settings.write");
    await container.grantStaffRole({
      subject,
      role: role as ShopStaffRole,
      operatorSubjectId: operator,
    });
    console.log(JSON.stringify({ subject, role, operator, reason, host: hostIdentity() }, null, 2));
  } else {
    usage();
  }
} finally {
  await container.close();
}
