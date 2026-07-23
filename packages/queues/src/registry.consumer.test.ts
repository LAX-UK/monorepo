import { describe, expect, it } from "vitest";
import {
  LOT_LIFECYCLE_QUEUE_NAME,
  QUEUE_REGISTRY,
  resolveEffectiveQueueConsumer,
} from "./registry.js";

describe("resolveEffectiveQueueConsumer", () => {
  const def = QUEUE_REGISTRY[LOT_LIFECYCLE_QUEUE_NAME];

  it("uses API consumer when lifecycle owner is api", () => {
    expect(
      resolveEffectiveQueueConsumer(LOT_LIFECYCLE_QUEUE_NAME, def, {
        appEnv: "test",
        marketingEventsEnabled: false,
        lifecycleExecutionOwner: "api",
      }),
    ).toBe("api");
  });

  it("uses worker consumer when lifecycle owner is worker", () => {
    expect(
      resolveEffectiveQueueConsumer(LOT_LIFECYCLE_QUEUE_NAME, def, {
        appEnv: "test",
        marketingEventsEnabled: false,
        lifecycleExecutionOwner: "worker",
      }),
    ).toBe("worker");
  });
});
