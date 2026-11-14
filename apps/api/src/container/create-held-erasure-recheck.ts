import { DrizzleStaffRoleAssignmentReader } from "@auction/persistence/repositories";
import type { Container } from "../container.js";
import { DrizzleBidUserContextLoader } from "../infrastructure/drizzle-bid-user-context.loader.js";
import { reportHeldErasureNeedsStaff } from "../infrastructure/held-erasure-alert.js";
import { HeldErasureRecheckService } from "../services/admin/data-requests/held-erasure-recheck.service.js";
import { BidUserHeldErasureActors } from "./adapters/bid-user-held-erasure-actors.js";
import { DrizzleHeldErasures } from "./adapters/drizzle-data-request-held-erasures.js";

/** Wires the recheck of data request erasures a private sale deal held (PS-5F2). */
export function createHeldErasureRecheck(
  container: Pick<Container, "db" | "admin">,
): HeldErasureRecheckService {
  return new HeldErasureRecheckService({
    queue: new DrizzleHeldErasures(container.db),
    erasures: container.admin.dataRequests,
    actors: new BidUserHeldErasureActors(
      new DrizzleBidUserContextLoader(
        container.db,
        new DrizzleStaffRoleAssignmentReader(container.db),
      ),
    ),
    onNeedsStaff: reportHeldErasureNeedsStaff,
  });
}
