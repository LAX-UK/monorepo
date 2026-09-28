import {
  createWorkerContainer,
  shutdownWorkerContainer,
} from "./container/create-worker-container.js";
import { startHealthServer } from "./health-server.js";

async function start(): Promise<void> {
  const container = createWorkerContainer();
  try {
    await container.ensureReady();
  } catch (err) {
    container.log.fatal({ err }, "worker_startup_gate_failed");
    process.exit(1);
  }

  void container.projectorRunner.start();

  const { server } = startHealthServer(container);

  function shutdown(signal: NodeJS.Signals) {
    void shutdownWorkerContainer(container, signal, () =>
      Promise.resolve(
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
      ),
    );
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void start();
