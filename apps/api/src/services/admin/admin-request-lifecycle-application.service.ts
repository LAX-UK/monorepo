import type { ImpersonationAuditService } from "../impersonation-audit.service.js";
import type { IAdminRequestLifecycleService } from "../interfaces/admin-routes.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.js";

export class AdminRequestLifecycleApplicationService implements IAdminRequestLifecycleService {
  constructor(
    private readonly impersonationAudit: ImpersonationAuditService,
    private readonly userSuspensionChecker: IUserSuspensionChecker,
  ) {}

  reconcileAdminRequestCookie(input: {
    actorUserId: string;
    cookieHeader: string | undefined;
  }): Promise<void> {
    return this.impersonationAudit.reconcileFromAdminRequestCookie(input);
  }

  isSuspended(userId: string): Promise<boolean> {
    return this.userSuspensionChecker.isSuspended(userId);
  }
}
