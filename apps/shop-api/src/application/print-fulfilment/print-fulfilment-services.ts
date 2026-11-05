import type { StaffNameReader } from "../ports/staff-name.reader.js";
import { createCertificatesService } from "./certificates.service.js";
import { createConfirmPrintService } from "./confirm-print.service.js";
import { createGetPickAndPackService } from "./get-pick-and-pack.service.js";
import type {
  CertificateSettingsReader,
  Clock,
  PickListReader,
  PrintFulfilmentUnitOfWork,
} from "./print-fulfilment.ports.js";
import { createSwapPrintService } from "./swap-print.service.js";

/** The packing use cases (pick list, confirm, swap, certificates), wired to one unit of work. */
export function createPrintFulfilmentServices(deps: {
  uow: PrintFulfilmentUnitOfWork;
  pickList: PickListReader;
  staffNames: StaffNameReader;
  certificateSettings: CertificateSettingsReader;
  clock: Clock;
}) {
  return {
    pickAndPack: createGetPickAndPackService({
      reader: deps.pickList,
      staffNames: deps.staffNames,
      certificateSettings: deps.certificateSettings,
    }),
    confirm: createConfirmPrintService(deps),
    swap: createSwapPrintService(deps),
    certificates: createCertificatesService(deps),
  };
}

export type PrintFulfilmentServices = ReturnType<typeof createPrintFulfilmentServices>;
