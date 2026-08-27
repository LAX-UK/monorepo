import { describe, expect, it } from "vitest";
import { connectionPolicy } from "./connection.policy";
import { policyContext } from "./policy-test-context";

describe("connectionPolicy", () => {
  it("allows when the connection can submit bids", () => {
    expect(connectionPolicy.evaluate(policyContext()).kind).toBe("allow");
  });

  it("blocks offline live bidding with a status action", () => {
    const decision = connectionPolicy.evaluate(
      policyContext({
        connectionBlocked: true,
        connectionState: "offline",
        connectionMessage: "No connection — live bidding is paused.",
      }),
    );
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.viewId).toBe("connection-unavailable");
    expect(decision.presentation.tone).toBe("warning");
    expect(decision.presentation.title).toBe("Live bidding temporarily unavailable");
    expect(decision.presentation.action).toMatchObject({ kind: "status", label: "Offline" });
    expect(decision.presentation.preview).toBeDefined();
  });
});
