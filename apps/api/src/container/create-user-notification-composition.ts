import { NotificationQueryService } from "../services/notification-query.service.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerUserNotificationComposition = {
  notificationQueryService: NotificationQueryService;
};

export function createUserNotificationComposition(
  repos: ContainerRepositories,
): ContainerUserNotificationComposition {
  return {
    notificationQueryService: new NotificationQueryService(repos.notificationReadRepo),
  };
}
