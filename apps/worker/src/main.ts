import {
  createWorkerContainer,
  shutdownWorkerContainer,
} from "./container/create-worker-container.js";
import { startHealthServer } from "./health-server.js";

const container = createWorkerContainer();
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
