import type {
  AdminLineCertificate,
  AdminPickAndPack,
  AdminPickLine,
} from "@auction/shop-contracts";
import { decideCertificate } from "@auction/shop-domain";
import type { StaffNameReader } from "../ports/staff-name.reader.js";
import { describeCertificate } from "./confirm-print.service.js";
import type {
  CertificateSettingsReader,
  PackLine,
  PickListReader,
  RunContext,
  StoredCertificate,
} from "./print-fulfilment.ports.js";
import { isNumberedRun, labelOfPrint } from "./print-identity.js";

/** Printed to order until a print has been made and stored. */
const MADE_CUSTODY = new Set(["stored", "in_transit", "delivered", "collected", "with_owner"]);

function certificateOf(input: {
  line: PackLine;
  context: RunContext;
  stored: StoredCertificate | undefined;
  settings: CertificateSettingsReader;
}): AdminLineCertificate {
  const { line, context, stored, settings } = input;
  if (stored) {
    return {
      status: stored.issuedAt ? "issued" : "to_send",
      certificateId: stored.certificateId,
      note: stored.issuedAt ? null : "Waiting to be sent",
      issuedAt: stored.issuedAt?.toISOString() ?? null,
    };
  }
  if (line.confirmedAt || !context.facts) {
    return { status: "none", certificateId: null, note: null, issuedAt: null };
  }
  const decision = decideCertificate(context.facts, {
    laxCertificatesEnabled: settings.laxCertificatesEnabled(),
    authorityRecorded: context.authority !== null,
  });
  return { ...describeCertificate(decision), certificateId: null, issuedAt: null };
}

/** The pick list for one order: each print sold, where it is, and where packing has got to. */
export function createGetPickAndPackService(deps: {
  reader: PickListReader;
  staffNames: StaffNameReader;
  certificateSettings: CertificateSettingsReader;
}) {
  const { reader, staffNames, certificateSettings } = deps;

  return {
    async forOrder(orderId: string): Promise<AdminPickAndPack> {
      const { lines, contexts, certificates } = await reader.forOrder(orderId);
      const byEdition = new Map(certificates.map((c) => [c.editionId, c]));
      const subjects = lines.flatMap((line) => (line.confirmedBy ? [line.confirmedBy] : []));
      const names = subjects.length > 0 ? await staffNames.namesFor(subjects) : new Map();

      const items = lines.flatMap((line): AdminPickLine[] => {
        const context = contexts.get(line.artworkId);
        if (!context) return [];
        const stored = byEdition.get(line.print.editionId);
        return [
          {
            orderLineId: line.orderLineId,
            artworkId: line.artworkId,
            artworkTitle: line.artworkTitle,
            label: labelOfPrint(line.print, context.run),
            numbered: isNumberedRun(context),
            storageLocation: line.print.storageLocation,
            printedToOrder: !MADE_CUSTODY.has(line.print.custodyStatus),
            confirmedAt: line.confirmedAt?.toISOString() ?? null,
            confirmedBy: line.confirmedBy ? (names.get(line.confirmedBy) ?? "Staff") : null,
            replacedLabel: line.swappedFrom ? labelOfPrint(line.swappedFrom, context.run) : null,
            certificate: certificateOf({
              line,
              context,
              stored,
              settings: certificateSettings,
            }),
            cancelled: line.released,
          },
        ];
      });
      return { orderId, lines: items };
    },
  };
}

export type GetPickAndPackService = ReturnType<typeof createGetPickAndPackService>;
