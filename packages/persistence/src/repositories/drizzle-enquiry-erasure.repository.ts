import type { Database } from "@auction/db";
import type {
  EnquiryErasureCounts,
  EnquiryErasureTarget,
  IEnquiryErasureRepository,
} from "../interfaces/enquiry-erasure.repository.js";
import { anonymiseEnquiries } from "../lib/anonymise-enquiries.js";

/** Staff-facing wrapper over the shared enquiry anonymisation, for services that depend on a port. */
export class DrizzleEnquiryErasureRepository implements IEnquiryErasureRepository {
  anonymiseInTransaction(
    tx: Database,
    target: EnquiryErasureTarget,
  ): Promise<EnquiryErasureCounts> {
    return anonymiseEnquiries(tx, target);
  }
}
