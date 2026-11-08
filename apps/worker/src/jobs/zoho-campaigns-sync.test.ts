import { emailHash } from "@auction/email";
import pino from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../env.js";
import { zohoCampaignsSyncJob } from "./zoho-campaigns-sync.js";

const log = pino({ level: "silent" });
const env = {
  ZOHO_CAMPAIGNS_API_KEY: "token",
  ZOHO_CAMPAIGNS_LIST_KEY: "list",
  ZOHO_API_HOST: "https://campaigns.example.test",
} as unknown as WorkerEnv;

function deps() {
  return {
    newsletterSignupSyncRepo: {
      markPushed: vi.fn(async () => undefined),
      markRejected: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    },
    optOutLift: { liftOptOut: vi.fn(async () => true) },
    env,
    log,
    data: { signupLogId: "log-1", email: "Reader@Example.com" },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("zohoCampaignsSyncJob newsletter sign-up", () => {
  it("lifts an old Campaigns opt-out once the address is pushed to the list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const d = deps();

    await zohoCampaignsSyncJob(d as never);

    expect(d.newsletterSignupSyncRepo.markPushed).toHaveBeenCalledWith("log-1", 200);
    expect(d.optOutLift.liftOptOut).toHaveBeenCalledTimes(1);
    const [hash, at] = d.optOutLift.liftOptOut.mock.calls[0] as unknown as [string, Date];
    expect(hash).toBe(emailHash("reader@example.com"));
    expect(at).toBeInstanceOf(Date);
  });

  it("does not lift when Zoho rejects the sign-up or the push fails", async () => {
    const d = deps();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 400 }));
    await zohoCampaignsSyncJob(d as never);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await expect(zohoCampaignsSyncJob(d as never)).rejects.toThrow("503");
    expect(d.optOutLift.liftOptOut).not.toHaveBeenCalled();
  });

  it("keeps the sign-up pushed when the lift itself fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const d = deps();
    d.optOutLift.liftOptOut.mockRejectedValueOnce(new Error("db down"));

    await expect(zohoCampaignsSyncJob(d as never)).resolves.toBeUndefined();

    expect(d.newsletterSignupSyncRepo.markPushed).toHaveBeenCalledTimes(1);
  });
});
