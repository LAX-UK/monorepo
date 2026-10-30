import type { INotificationAccountMuteStore } from "@auction/persistence/interfaces";
import type { NotificationAccountMute } from "@auction/types";
import { type Result, err, ok } from "neverthrow";

export type NotificationAccountMuteError = {
  code: "not_an_organisation_member";
  status: 404;
  message: string;
};

const NOT_MEMBER: NotificationAccountMuteError = {
  code: "not_an_organisation_member",
  status: 404,
  message: "You can only mute an organisation you belong to",
};

export interface INotificationAccountMuteService {
  list(userId: string): Promise<NotificationAccountMute[]>;
  mute(userId: string, legalEntityId: string): Promise<Result<void, NotificationAccountMuteError>>;
  /** Unmuting is always allowed (also after leaving the organisation) and idempotent. */
  unmute(userId: string, legalEntityId: string): Promise<void>;
}

/**
 * A member's "Don't notify me about this organisation". Only organisations the person belongs to
 * can be muted; their personal account cannot. Delivery honours mutes on every channel.
 */
export class NotificationAccountMuteService implements INotificationAccountMuteService {
  constructor(private readonly store: INotificationAccountMuteStore) {}

  async list(userId: string): Promise<NotificationAccountMute[]> {
    const rows = await this.store.listForUser(userId);
    return rows.map((r) => ({ ...r, mutedAt: r.mutedAt.toISOString() }));
  }

  async mute(
    userId: string,
    legalEntityId: string,
  ): Promise<Result<void, NotificationAccountMuteError>> {
    if (!(await this.store.isMemberOfOrganisation(userId, legalEntityId))) return err(NOT_MEMBER);
    await this.store.mute(userId, legalEntityId);
    return ok(undefined);
  }

  async unmute(userId: string, legalEntityId: string): Promise<void> {
    await this.store.unmute(userId, legalEntityId);
  }
}
