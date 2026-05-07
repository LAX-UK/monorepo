import { finished } from "node:stream/promises";
import type { Database } from "@auction/db";
import { legalEntity, lot, payment, payout, payoutLine, user } from "@auction/db/schema";
import type { Job } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import type { UploadStorage } from "../lib/upload-storage.js";

export type GeneratePayoutStatementJobData = {
  payoutId: string;
};

function statementObjectKey(legalEntityId: string, payoutId: string): string {
  return `payout-statements/${legalEntityId}/${payoutId}.pdf`;
}

function moneyFmt(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
}

function formatPeriod(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  return `${fmt(start)} — ${fmt(end)}`;
}

export async function generatePayoutStatementJob(options: {
  db: Database;
  storage: UploadStorage;
  env: WorkerEnv;
  log: pino.Logger;
  job: Job<GeneratePayoutStatementJobData>;
}): Promise<void> {
  const { db, storage, env, log, job } = options;
  const { payoutId } = job.data;
  const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 3;

  const markError = async (message: string) => {
    await db
      .update(payout)
      .set({ statementGenerationError: message.slice(0, 4000) })
      .where(eq(payout.id, payoutId));
  };

  try {
    const [pRow] = await db.select().from(payout).where(eq(payout.id, payoutId)).limit(1);
    if (!pRow) {
      throw new Error("payout_not_found");
    }

    const [entityRow] = await db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, pRow.legalEntityId))
      .limit(1);
    if (!entityRow) {
      throw new Error("legal_entity_not_found");
    }

    const lines = await db
      .select({
        lineId: payoutLine.id,
        kind: payoutLine.kind,
        amount: payoutLine.amount,
        note: payoutLine.note,
        paymentId: payoutLine.paymentId,
        createdByUserId: payoutLine.createdByUserId,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        buyerName: user.name,
      })
      .from(payoutLine)
      .leftJoin(payment, eq(payoutLine.paymentId, payment.id))
      .leftJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(user, eq(payment.buyerId, user.id))
      .where(eq(payoutLine.payoutId, payoutId));

    const authorIds = [
      ...new Set(
        lines.map((l) => l.createdByUserId).filter((id): id is string => typeof id === "string"),
      ),
    ];
    const authorMap = new Map<string, string>();
    if (authorIds.length > 0) {
      const authors = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, authorIds));
      for (const a of authors) {
        authorMap.set(a.id, a.name);
      }
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));

    const entityDisplayName =
      entityRow.legalName?.trim() || entityRow.displayName?.trim() || entityRow.id.slice(0, 8);

    doc.fontSize(18).text("LAX", { continued: false });
    doc.moveDown(0.25);
    doc.fontSize(14).text("Payout statement", { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Statement period: ${formatPeriod(pRow.periodStart, pRow.periodEnd)}`);
    doc.text(`Entity: ${entityDisplayName}`);
    if (entityRow.vatNumber) {
      doc.text(`VAT number: ${entityRow.vatNumber}`);
    }
    doc.text(`Payout reference: ${payoutId}`);
    doc.moveDown();

    const gross = String(pRow.grossAmount);
    const pf = String(pRow.platformFee);
    const sf = String(pRow.stripeFee);
    const net = String(pRow.netAmount);
    const currency = pRow.currency;
    const feePct =
      Number.parseFloat(gross) > 0
        ? ((Number.parseFloat(pf) / Number.parseFloat(gross)) * 100).toFixed(2)
        : "0.00";

    doc.fontSize(11).text("Line items", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(9);
    for (const line of lines) {
      const kind = line.kind;
      let desc: string;
      if (line.paymentId && line.lotTitle) {
        const lotRef =
          line.lotNumber != null ? `Lot #${line.lotNumber}` : `Lot ${line.paymentId.slice(0, 8)}`;
        const buyer = line.buyerName?.trim() || "—";
        desc = `${lotRef} — ${line.lotTitle} — buyer: ${buyer}`;
      } else if (kind === "adjustment") {
        desc = `Adjustment${line.note ? `: ${line.note}` : ""}`;
      } else {
        desc = `${kind}${line.note ? ` — ${line.note}` : ""}`;
      }
      doc.text(`• [${kind}] ${moneyFmt(String(line.amount), currency)} — ${desc}`);
    }

    doc.moveDown();
    doc.fontSize(11).text("Totals", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`Gross: ${moneyFmt(gross, currency)}`);
    doc.text(`Platform fee: ${moneyFmt(pf, currency)} (${feePct}% of gross)`);
    doc.text(`Stripe fee: ${moneyFmt(sf, currency)}`);
    doc.text(`Net payable: ${moneyFmt(net, currency)}`);
    doc.text(`Currency: ${currency}`);

    doc.addPage();
    doc.fontSize(12).text("Administrator appendix", { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Xero bill id: ${pRow.xeroBillId ?? "—"}`);
    doc.text(`Stripe transfer id: ${pRow.stripeTransferId ?? "—"}`);
    doc.moveDown();
    const adjustments = lines.filter((l) => l.kind === "adjustment");
    if (adjustments.length === 0) {
      doc.text("No adjustment lines.");
    } else {
      doc.text("Adjustments:");
      for (const a of adjustments) {
        const author =
          a.createdByUserId != null ? (authorMap.get(a.createdByUserId) ?? a.createdByUserId) : "—";
        doc.text(
          `• ${moneyFmt(String(a.amount), currency)} — note: ${a.note ?? "—"} — author: ${author}`,
        );
      }
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#444444");
    const contact =
      env.PAYOUT_STATEMENT_CONTACT_EMAIL ??
      env.EMAIL_REPLY_TO ??
      env.EMAIL_FROM ??
      "support@lax.bid";
    doc.text(`Stripe transfer reference: ${pRow.stripeTransferId ?? "—"}`);
    doc.text(
      `Settlement / processed: ${pRow.processedAt ? pRow.processedAt.toISOString().slice(0, 10) : "—"}`,
    );
    doc.text(`Questions: ${contact}`);
    doc.fillColor("#000000");

    doc.end();
    await finished(doc);

    const pdf = Buffer.concat(chunks);
    const key = statementObjectKey(pRow.legalEntityId, payoutId);
    const { url } = await storage.putObject(key, pdf, "application/pdf");

    await db
      .update(payout)
      .set({ statementUrl: url, statementGenerationError: null })
      .where(eq(payout.id, payoutId));

    log.info({ payoutId, key }, "payout_statement_generated");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attemptNo = (job.attemptsMade ?? 0) + 1;
    log.error(
      { err: message, payoutId, attempt: attemptNo, maxAttempts },
      "payout_statement_generation_failed",
    );
    if (attemptNo >= maxAttempts) {
      await markError(message);
    }
    throw err;
  }
}
