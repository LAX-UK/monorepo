import type { IUserNotificationsHttpApplicationService } from "../interfaces/user-routes/user-notifications-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { NotificationQueryService } from "../notification-query.service.js";
import type { INotificationAccountMuteService } from "../notifications/notification-account-mute.service.js";

export class UserNotificationsHttpApplicationService
  implements IUserNotificationsHttpApplicationService
{
  constructor(
    private readonly notificationQueryService: NotificationQueryService,
    private readonly mutes: INotificationAccountMuteService,
  ) {}

  async listNotifications(
    input: Parameters<IUserNotificationsHttpApplicationService["listNotifications"]>[0],
  ): Promise<UserHttpJson> {
    const data = await this.notificationQueryService.listForUserFiltered(input.userId, {
      limit: input.limit,
      offset: input.offset,
      tab: input.tab,
      type: input.type,
      account: input.account,
      query: input.query,
    });
    return { status: 200, body: { data } };
  }

  async listMutes(input: { userId: string }): Promise<UserHttpJson> {
    return { status: 200, body: { data: await this.mutes.list(input.userId) } };
  }

  async muteAccount(input: { userId: string; legalEntityId: string }): Promise<UserHttpJson> {
    const result = await this.mutes.mute(input.userId, input.legalEntityId);
    return result.match(
      () => ({ status: 204, body: null }),
      (e) => ({ status: e.status, body: { error: e.code, message: e.message } }),
    );
  }

  async unmuteAccount(input: { userId: string; legalEntityId: string }): Promise<UserHttpJson> {
    await this.mutes.unmute(input.userId, input.legalEntityId);
    return { status: 204, body: null };
  }

  async markManyRead(input: { userId: string; ids: string[] }): Promise<UserHttpJson> {
    const count = await this.notificationQueryService.markManyRead(input.userId, input.ids);
    return { status: 200, body: { data: { count } } };
  }

  async archiveNotification(input: {
    userId: string;
    notificationId: string;
  }): Promise<UserHttpJson> {
    const archived = await this.notificationQueryService.archive(
      input.userId,
      input.notificationId,
    );
    if (!archived) return { status: 404, body: { error: "Not found" } };
    return { status: 204, body: null };
  }

  async markRead(input: { userId: string; notificationId: string }): Promise<UserHttpJson> {
    const updated = await this.notificationQueryService.markRead(
      input.userId,
      input.notificationId,
    );
    if (!updated) return { status: 404, body: { error: "Not found" } };
    return { status: 204, body: null };
  }

  async markAllRead(input: { userId: string }): Promise<UserHttpJson> {
    const count = await this.notificationQueryService.markAllRead(input.userId);
    return { status: 200, body: { data: { count } } };
  }
}
