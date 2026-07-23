import type { IAdminOnsiteEventsApplicationService } from "../interfaces/admin-routes/admin-satellite-routes.js";
import type { IOnsiteEventAdminService } from "../interfaces/onsite-event-admin-service.js";
import type { IOnsiteEventStaffCheckInService } from "../interfaces/onsite-event-staff-check-in-service.js";

export class AdminOnsiteEventsApplicationService implements IAdminOnsiteEventsApplicationService {
  constructor(
    private readonly admin: IOnsiteEventAdminService,
    private readonly staffCheckIn: IOnsiteEventStaffCheckInService,
  ) {}

  listAdminEvents(...args: Parameters<IOnsiteEventAdminService["listAdminEvents"]>) {
    return this.admin.listAdminEvents(...args);
  }

  createAdminEvent(...args: Parameters<IOnsiteEventAdminService["createAdminEvent"]>) {
    return this.admin.createAdminEvent(...args);
  }

  getAdminEventDetail(...args: Parameters<IOnsiteEventAdminService["getAdminEventDetail"]>) {
    return this.admin.getAdminEventDetail(...args);
  }

  updateAdminEvent(...args: Parameters<IOnsiteEventAdminService["updateAdminEvent"]>) {
    return this.admin.updateAdminEvent(...args);
  }

  listAdminRsvps(...args: Parameters<IOnsiteEventAdminService["listAdminRsvps"]>) {
    return this.admin.listAdminRsvps(...args);
  }

  exportAdminCsv(...args: Parameters<IOnsiteEventAdminService["exportAdminCsv"]>) {
    return this.admin.exportAdminCsv(...args);
  }

  resendPass(...args: Parameters<IOnsiteEventAdminService["resendPass"]>) {
    return this.admin.resendPass(...args);
  }

  setCheckInDryRun(...args: Parameters<IOnsiteEventAdminService["setCheckInDryRun"]>) {
    return this.admin.setCheckInDryRun(...args);
  }

  checkIn(...args: Parameters<IOnsiteEventStaffCheckInService["checkIn"]>) {
    return this.staffCheckIn.checkIn(...args);
  }

  searchGuests(...args: Parameters<IOnsiteEventStaffCheckInService["searchGuests"]>) {
    return this.staffCheckIn.searchGuests(...args);
  }

  getCheckInStats(...args: Parameters<IOnsiteEventStaffCheckInService["getCheckInStats"]>) {
    return this.staffCheckIn.getCheckInStats(...args);
  }

  recordPassResend(...args: Parameters<IOnsiteEventStaffCheckInService["recordPassResend"]>) {
    return this.staffCheckIn.recordPassResend(...args);
  }
}
