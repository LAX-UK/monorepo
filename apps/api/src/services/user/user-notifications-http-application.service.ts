import type { IUserNotificationsHttpApplicationService } from "../interfaces/user-routes/user-notifications-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { NotificationQueryService } from "../notification-query.service.js";

export class UserNotificationsHttpApplicationService
  implements IUserNotificationsHttpApplicationService
{
  constructor(private readonly notificationQueryService: NotificationQueryService) {}

  async listNotifications(input: {
    userId: string;
    limit: number;
    offset: number;
    tab: "all" | "unread" | "archived";
    type?: string;
  }): Promise<UserHttpJson> {
    const data = await this.notificationQueryService.listForUserFiltered(input.userId, {
      limit: input.limit,
      offset: input.offset,
      tab: input.tab,
      type: input.type,
    });
    return { status: 200, body: { data } };
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
