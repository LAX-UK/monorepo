import type { IEmailService } from "@auction/email";
import type {
  INotificationWriteRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type pino from "pino";
import { createDefaultProjectorRegistry } from "./projector-registry.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export function createProjectorRunner(options: {
  transactionRunner: ITransactionRunner;
  notificationWriteRepo: INotificationWriteRepository;
  log: pino.Logger;
  heartbeat: () => Promise<void>;
  buildContext: () => ProjectorRunContext;
  /** transactional email outbox for impersonation notices. */
  emailService?: IEmailService;
}) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const registry = createDefaultProjectorRegistry();

  async function tick() {
    const ctx = options.buildContext();
    await registry.runAll(ctx);
    await options.heartbeat();
  }

  async function loop() {
    if (stopped) return;
    try {
      await tick();
    } catch (err) {
      options.log.error({ err }, "projector tick failed");
    }
    if (!stopped) timer = setTimeout(loop, 1500);
  }

  return {
    start() {
      void loop();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
