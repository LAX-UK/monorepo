import { beforeEach, describe, expect, it, vi } from "vitest";

const bulkAction = vi.fn();
vi.mock("@/lib/actions/admin", () => ({
  adminBulkUsersResultAction: (...args: unknown[]) => bulkAction(...args),
}));

const { getUserBulkOperations } = await import("./users");

const IDS = ["user-one", "user-two"];
const REASON = "Coordinated bidding ring, reviewed by compliance.";

function operation(id: string) {
  const op = getUserBulkOperations().find((o) => o.id === id);
  if (!op) throw new Error(`no ${id} operation`);
  return op;
}

describe("user bulk operations", () => {
  beforeEach(() => bulkAction.mockReset());

  it("asks for a reason before suspending", () => {
    const prompt = operation("suspend").reasonPrompt;
    expect(prompt?.minLength).toBe(10);
    expect(prompt?.fieldLabel).toMatch(/reason/i);
  });

  it("sends the typed reason, not a fixed one", async () => {
    await operation("suspend").run(IDS, { reason: REASON });

    expect(bulkAction).toHaveBeenCalledWith({ ids: IDS, op: "suspend", reason: REASON });
  });

  it("never sends a made-up reason when none was given", async () => {
    await operation("suspend").run(IDS);

    expect(bulkAction).toHaveBeenCalledWith({ ids: IDS, op: "suspend", reason: "" });
  });

  it("unsuspends without a reason", async () => {
    expect(operation("unsuspend").reasonPrompt).toBeUndefined();

    await operation("unsuspend").run(IDS);

    expect(bulkAction).toHaveBeenCalledWith({ ids: IDS, op: "unsuspend" });
  });
});
