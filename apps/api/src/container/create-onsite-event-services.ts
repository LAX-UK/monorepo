import type { Database } from "@auction/db";
import { DrizzleGuestPaddleReader } from "@auction/persistence";
import type { Env } from "../env.js";
import { createBaseLogger } from "../lib/logger.js";
import type { IOnsiteEventAdminService } from "../services/interfaces/onsite-event-admin-service.js";
import type { IOnsiteEventPassService } from "../services/interfaces/onsite-event-pass-service.js";
import type { IOnsiteEventPublicRsvpService } from "../services/interfaces/onsite-event-public-rsvp-service.js";
import type { IOnsiteEventStaffCheckInService } from "../services/interfaces/onsite-event-staff-check-in-service.js";
import { OnsiteEventAdminService } from "../services/onsite-event-admin.service.js";
import { OnsiteEventNotifier } from "../services/onsite-event-notifier.js";
import { OnsiteEventPassTokenService } from "../services/onsite-event-pass-token.service.js";
import { OnsiteEventPassService } from "../services/onsite-event-pass.service.js";
import { OnsiteEventPublicRsvpService } from "../services/onsite-event-public-rsvp.service.js";
import { OnsiteEventSaleLinkService } from "../services/onsite-event-sale-link.service.js";
import { OnsiteEventStaffCheckInService } from "../services/onsite-event-staff-check-in.service.js";
import { PassQrRenderService } from "../services/pass-qr-render.service.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerOnsiteEventServices = {
  onsiteEventPublicRsvpService: IOnsiteEventPublicRsvpService;
  onsiteEventAdminService: IOnsiteEventAdminService;
  onsiteEventPassService: IOnsiteEventPassService;
  onsiteEventStaffCheckInService: IOnsiteEventStaffCheckInService;
};

export type CreateOnsiteEventServicesInput = {
  env: Env;
  db: Database;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
};

export function createOnsiteEventServices(
  input: CreateOnsiteEventServicesInput,
): ContainerOnsiteEventServices {
  const { env, db, repos, platform } = input;
  const {
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventClientReader,
    onsiteEventCheckInLogRepo,
  } = repos;
  const { transactionalMailer } = platform;

  const passQrRenderService = new PassQrRenderService();
  const onsiteEventLog = createBaseLogger(env).child({ component: "onsite_event" });
  const onsiteEventNotifier = new OnsiteEventNotifier(
    transactionalMailer,
    passQrRenderService,
    env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
    onsiteEventLog.child({ module: "notifier" }),
  );
  const onsiteEventSaleLinkService = new OnsiteEventSaleLinkService(
    onsiteEventRepo,
    repos.saleRepo,
  );
  const onsiteEventPassTokenService = new OnsiteEventPassTokenService(
    env.CHECK_IN_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET,
  );
  const onsiteEventPublicRsvpService = new OnsiteEventPublicRsvpService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventClientReader,
    onsiteEventSaleLinkService,
    onsiteEventPassTokenService,
    onsiteEventNotifier,
    onsiteEventLog.child({ module: "public_rsvp" }),
  );
  const onsiteEventAdminService = new OnsiteEventAdminService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventSaleLinkService,
    onsiteEventPassTokenService,
    onsiteEventNotifier,
    onsiteEventLog.child({ module: "admin" }),
  );
  const guestPaddleReader = new DrizzleGuestPaddleReader(db);
  const onsiteEventPassService = new OnsiteEventPassService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    passQrRenderService,
    guestPaddleReader,
  );
  const onsiteEventStaffCheckInService = new OnsiteEventStaffCheckInService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventCheckInLogRepo,
    onsiteEventLog.child({ module: "staff_check_in" }),
  );

  return {
    onsiteEventPublicRsvpService,
    onsiteEventAdminService,
    onsiteEventPassService,
    onsiteEventStaffCheckInService,
  };
}
