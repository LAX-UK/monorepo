import type { ILegalEntityRepository } from "@auction/persistence";
import type { IPaymentWriteRepository } from "@auction/persistence";
import type { IAddressRepository, IProfileReader } from "@auction/persistence";
import type { BillToContext } from "@auction/types";
import type { AppLogger } from "../lib/logger.js";

export type InvoiceAddressingResult = {
  billTo: BillToContext;
  /** Ops-visible issues (missing org address, missing individual default address, etc.). */
  warnings: string[];
};

function formatOrgAddressLines(addr: {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
}): string[] {
  const lines: string[] = [addr.line1];
  if (addr.line2?.trim()) lines.push(addr.line2.trim());
  const cityPart = [addr.city, addr.state].filter(Boolean).join(", ");
  lines.push([cityPart, addr.postalCode].filter(Boolean).join(" ").trim());
  lines.push(addr.country);
  return lines.filter((l) => l.length > 0);
}

function formatUserAddressLines(addr: {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
}): string[] {
  return formatOrgAddressLines(addr);
}

function pickDefaultUserAddress(
  rows: Awaited<ReturnType<IAddressRepository["listByUser"]>>,
): (typeof rows)[0] | null {
  if (rows.length === 0) return null;
  const def = rows.find((r) => r.isDefault);
  if (def) return def;
  const billingish = rows.find((r) => r.addressType === "billing" || r.addressType === "both");
  return billingish ?? rows[0] ?? null;
}

export class InvoiceAddressingService {
  constructor(
    private readonly payments: IPaymentWriteRepository,
    private readonly legalEntities: ILegalEntityRepository,
    private readonly profiles: IProfileReader,
    private readonly addresses: IAddressRepository,
    private readonly log: AppLogger,
  ) {}

  async resolveForPayment(paymentId: string): Promise<InvoiceAddressingResult> {
    const warnings: string[] = [];
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      warnings.push("payment_not_found");
      this.log.warn({ paymentId }, "invoice_addressing_payment_not_found");
      return {
        billTo: {
          kind: "individual",
          billToName: "",
          addressLines: [],
          vatLine: null,
          addressIncomplete: true,
        },
        warnings,
      };
    }

    const buyerLeId = payment.buyerLegalEntityId;
    if (!buyerLeId) {
      warnings.push("missing_buyer_legal_entity_id");
      this.log.warn({ paymentId }, "invoice_addressing_missing_buyer_legal_entity");
      return {
        billTo: {
          kind: "individual",
          billToName: "",
          addressLines: [],
          vatLine: null,
          addressIncomplete: true,
        },
        warnings,
      };
    }

    const entity = await this.legalEntities.findById(buyerLeId);
    if (!entity) {
      warnings.push("legal_entity_not_found");
      this.log.warn(
        { paymentId, buyerLegalEntityId: buyerLeId },
        "invoice_addressing_entity_not_found",
      );
      return {
        billTo: {
          kind: "individual",
          billToName: "",
          addressLines: [],
          vatLine: null,
          addressIncomplete: true,
        },
        warnings,
      };
    }

    if (entity.kind === "organisation") {
      const name = entity.legalName?.trim() || entity.displayName.trim() || "—";
      const addr = await this.legalEntities.findPreferredBillToLegalEntityAddress(entity.id);
      let addressLines: string[] = [];
      let addressIncomplete = false;
      if (!addr) {
        addressIncomplete = true;
        warnings.push("organisation_missing_legal_entity_address");
        this.log.warn(
          { paymentId, legalEntityId: entity.id },
          "invoice_addressing_org_missing_legal_entity_address",
        );
      } else {
        addressLines = formatOrgAddressLines(addr);
      }
      const vat = entity.vatNumber?.trim();
      const vatLine = vat ? `VAT: ${vat}` : null;
      return {
        billTo: {
          kind: "organisation",
          billToName: name,
          addressLines,
          vatLine,
          addressIncomplete,
        },
        warnings,
      };
    }

    const userId = payment.paidByUserId;
    if (!userId) {
      warnings.push("missing_paid_by_user_id");
      this.log.warn({ paymentId }, "invoice_addressing_missing_paid_by_user");
      return {
        billTo: {
          kind: "individual",
          billToName: entity.displayName.trim() || "—",
          addressLines: [],
          vatLine: null,
          addressIncomplete: true,
        },
        warnings,
      };
    }

    const profile = await this.profiles.getProfile(userId);
    const billToName = profile?.name?.trim() || entity.displayName.trim() || "—";
    const rows = await this.addresses.listByUser(userId);
    const addr = pickDefaultUserAddress(rows);
    let addressLines: string[] = [];
    let addressIncomplete = false;
    if (!addr) {
      addressIncomplete = true;
      warnings.push("individual_missing_default_user_address");
      this.log.warn({ paymentId, userId }, "invoice_addressing_individual_missing_user_address");
    } else {
      addressLines = formatUserAddressLines(addr);
    }

    return {
      billTo: {
        kind: "individual",
        billToName,
        addressLines,
        vatLine: null,
        addressIncomplete,
      },
      warnings,
    };
  }
}
