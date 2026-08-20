import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import type { IIdentitySubjectClient } from "../services/interfaces/identity-issuer-client.js";
import type { ContainerInfra } from "./create-infra.js";
import { createPlatformCore } from "./create-platform-core.js";
import { createPlatformIdentityServices } from "./create-platform-identity-services.js";
import { createPlatformNotificationServices } from "./create-platform-notification-services.js";
import { createPlatformPayoutServices } from "./create-platform-payout-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.types.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type { ContainerPlatformServices } from "./create-platform-services.types.js";

export type CreatePlatformServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  identitySubjects: IIdentitySubjectClient;
};

export function createPlatformServices(
  input: CreatePlatformServicesInput,
): ContainerPlatformServices {
  const { env, db, infra, repos, identitySubjects } = input;

  const core = createPlatformCore(db, repos, env);
  const payout = createPlatformPayoutServices({ env, db, infra, repos, core });
  const notification = createPlatformNotificationServices({ env, infra, repos, core });
  const identity = createPlatformIdentityServices({
    env,
    db,
    infra,
    repos,
    core,
    identitySubjects,
    stripeConnectService: payout.stripeConnectService,
  });

  return {
    ...core,
    ...payout,
    ...notification,
    ...identity,
  };
}
