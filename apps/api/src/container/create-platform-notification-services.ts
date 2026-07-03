import type { Env } from "../env.js";
import { EmailNotificationChannel } from "../infrastructure/email-notification.channel.js";
import { InAppNotificationChannel } from "../infrastructure/in-app-notification.channel.js";
import { NoOpPushSender } from "../infrastructure/no-op-push.sender.js";
import { PushNotificationChannel } from "../infrastructure/push-notification.channel.js";
import { RedisNotificationSender } from "../infrastructure/redis-notification.sender.js";
import { RedisUserNotificationPublisher } from "../infrastructure/redis-user-notification.publisher.js";
import { WebPushSender } from "../infrastructure/web-push.sender.js";
import { WhatsappNotificationChannel } from "../infrastructure/whatsapp-notification.channel.js";
import type { IPushSender } from "../services/interfaces/push.js";
import { NotificationOutboxProcessor } from "../services/notification-outbox.processor.js";
import { NotificationOutboxService } from "../services/notification-outbox.service.js";
import { NotificationDispatcher } from "../services/notification.dispatcher.js";
import { NotificationService } from "../services/notification.service.js";
import { QuietHoursChecker } from "../services/quiet-hours.checker.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformCore } from "./create-platform-core.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerPlatformNotificationServices = {
  userNotificationPublisher: RedisUserNotificationPublisher;
  notificationService: NotificationService;
  notificationDispatcher: NotificationDispatcher;
  notificationOutboxService: NotificationOutboxService;
  notificationOutboxProcessor: NotificationOutboxProcessor;
};

export type CreatePlatformNotificationServicesInput = {
  env: Env;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  core: ContainerPlatformCore;
};

export function createPlatformNotificationServices(
  input: CreatePlatformNotificationServicesInput,
): ContainerPlatformNotificationServices {
  const { env, infra, repos } = input;
  const { redis, emailService } = infra;
  const {
    notificationWriteRepo,
    pushSubscriptionRepository,
    userRepo,
    notificationPreferenceRepository,
    notificationOutboxRepository,
  } = repos;

  const notifier = new RedisNotificationSender(redis);
  const userNotificationPublisher = new RedisUserNotificationPublisher(redis);
  const notificationService = new NotificationService(notifier, notifier);

  const quietHoursChecker = new QuietHoursChecker();
  const pushSender: IPushSender =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? new WebPushSender(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT)
      : new NoOpPushSender();

  const inAppChannel = new InAppNotificationChannel(
    notificationWriteRepo,
    userNotificationPublisher,
    infra.cache,
  );
  const pushChannel = new PushNotificationChannel(pushSender, pushSubscriptionRepository);
  const emailChannel = new EmailNotificationChannel(
    emailService,
    userRepo,
    env.WEB_ORIGIN,
    env.EMAIL_UNSUBSCRIBE_SECRET,
  );
  const channels = env.ENABLE_WHATSAPP_CHANNEL
    ? [inAppChannel, pushChannel, emailChannel, new WhatsappNotificationChannel()]
    : [inAppChannel, pushChannel, emailChannel];
  const notificationDispatcher = new NotificationDispatcher(
    channels,
    notificationPreferenceRepository,
    quietHoursChecker,
  );
  const notificationOutboxService = new NotificationOutboxService(notificationOutboxRepository);
  const notificationOutboxProcessor = new NotificationOutboxProcessor(
    notificationOutboxRepository,
    notificationDispatcher,
  );

  return {
    userNotificationPublisher,
    notificationService,
    notificationDispatcher,
    notificationOutboxService,
    notificationOutboxProcessor,
  };
}
