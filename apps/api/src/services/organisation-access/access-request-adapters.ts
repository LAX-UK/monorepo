import type {
  AccessRequestRow,
  ILegalEntityNotificationRecipientReader,
} from "@auction/persistence/interfaces";
import { memberChangeOutcome } from "../identity/identity-legal-entity-member-http-application.service.js";
import type { IMemberManagementService } from "../interfaces/member-management.js";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import type { IOrganisationNames } from "../interfaces/organisation-names.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { IAccessRequestNotifier, IMemberRoleChanger } from "./access-request.service.js";

/** Gives the role through the member service, so every member-change rule applies. */
export class MemberServiceRoleChanger implements IMemberRoleChanger {
  constructor(private readonly members: Pick<IMemberManagementService, "updateRole">) {}

  async change(input: {
    actingUserId: string;
    legalEntityId: string;
    memberId: string;
    role: Parameters<IMemberManagementService["updateRole"]>[3]["role"];
  }) {
    try {
      await this.members.updateRole(input.actingUserId, input.legalEntityId, input.memberId, {
        role: input.role,
      });
      return { ok: true as const };
    } catch (err) {
      // Unknown failures rethrow from here; refusals come back as an error outcome.
      const outcome = memberChangeOutcome(err);
      if (outcome.kind !== "err") throw err;
      const { message, status, code, hint } = outcome.error;
      return {
        ok: false as const,
        error: {
          code: code ?? "member_change_refused",
          status: accessStatus(status),
          message,
          ...(hint ? { hint } : {}),
        },
      };
    }
  }
}

/** The member service's refusal statuses, as the access request API answers them. */
function accessStatus(status: number): 400 | 403 | 404 | 409 {
  return status === 400 || status === 404 || status === 409 ? status : 403;
}

/**
 * Tells owners and admins of a new request, and the requester of the decision, in the product
 * and by email (the notification types map to their templates). Best effort: a notice that
 * cannot be sent never undoes the request or the decision.
 */
export class AccessRequestNotifier implements IAccessRequestNotifier {
  constructor(
    private readonly recipients: ILegalEntityNotificationRecipientReader,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly factory: Pick<
      INotificationFactory,
      "createAccessRequested" | "createAccessRequestDecided"
    >,
    private readonly organisations: IOrganisationNames,
  ) {}

  private organisationName(legalEntityId: string): Promise<string | null> {
    return this.organisations.nameOf(legalEntityId).catch(() => null);
  }

  async requested(request: AccessRequestRow): Promise<void> {
    try {
      const [deciders, name] = await Promise.all([
        this.recipients.listUserIdsForAudience(request.legalEntityId, "admin"),
        this.organisationName(request.legalEntityId),
      ]);
      for (const userId of deciders.filter((id) => id !== request.requesterUserId)) {
        await this.send(userId, this.factory.createAccessRequested(userId, request, name), request);
      }
    } catch (err) {
      console.error("[AccessRequestNotifier] request notice failed", { id: request.id, err });
    }
  }

  async decided(request: AccessRequestRow): Promise<void> {
    try {
      const userId = request.requesterUserId;
      const name = await this.organisationName(request.legalEntityId);
      await this.send(
        userId,
        this.factory.createAccessRequestDecided(userId, request, name),
        request,
      );
    } catch (err) {
      console.error("[AccessRequestNotifier] decision notice failed", { id: request.id, err });
    }
  }

  private async send(
    userId: string,
    row: ReturnType<INotificationFactory["createAccessRequested"]>,
    request: AccessRequestRow,
  ): Promise<void> {
    const key = `access-request:${request.id}:${request.status}:${userId}`;
    const payload = notificationRowToPayload(row);
    await this.dispatcher.dispatch(userId, {
      ...payload,
      meta: { ...payload.meta, outboxIdempotencyKey: key, emailIdempotencyKey: key },
    });
  }
}
