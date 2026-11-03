import type { Database } from "@auction/db";
import type { ShopApiEnv } from "../../env.js";
import { createAnonymisePurgedIdentitiesRunner } from "../../infrastructure/scheduler/anonymise-purged-identities.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createPersonalDataAnonymisationTask(
  db: Database,
  env: ShopApiEnv,
): ShopSchedulerTask {
  const run = createAnonymisePurgedIdentitiesRunner(db, {
    domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  });
  return {
    name: "personal-data-anonymisation",
    run: async (now) => {
      await run(now);
    },
  };
}
