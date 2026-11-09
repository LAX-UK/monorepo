import { describe, expect, it, vi } from "vitest";
import { RetentionHoldAlerts } from "./kyc-retention-hold-alert.js";

const holds = [
  { reference: "PS-0042", kind: "no_end" as const },
  { reference: "PS-0050", kind: "stale" as const },
];

function setup(
  over: {
    recipients?: Array<{ id: string; email: string; firstName: string | null }>;
    admin?: string;
    now?: Date;
  } = {},
) {
  const enqueue = vi.fn(async (_message: Record<string, unknown>) => undefined);
  const alerts = new RetentionHoldAlerts({
    emailService: { enqueue: enqueue as never },
    complianceRecipients: {
      listRecipients: async () =>
        over.recipients ?? [{ id: "c1", email: "mlro@lax.test", firstName: "Mo" }],
    },
    ...(over.admin ? { adminEmailAddress: over.admin } : {}),
    supportContactEmail: "support@lax.test",
    now: () => over.now ?? new Date("2031-06-18T10:00:00Z"),
  });
  return { alerts, enqueue };
}

describe("RetentionHoldAlerts", () => {
  it("emails each compliance recipient the deals and what is wrong with each", async () => {
    const { alerts, enqueue } = setup({
      recipients: [
        { id: "c1", email: "mlro@lax.test", firstName: "Mo" },
        { id: "c2", email: "deputy@lax.test", firstName: null },
      ],
    });
    await alerts.needAttention(holds);
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[0]?.[0]).toMatchObject({
      template: "kyc-retention-hold-notice",
      to: "mlro@lax.test",
      userId: "c1",
      vars: {
        recipientFirstName: "Mo",
        count: 2,
        lines: [
          expect.stringContaining("PS-0042: ended, but no end date is recorded"),
          expect.stringContaining("PS-0050: still open"),
        ],
      },
    });
  });

  it("keys the message on the week, so the same holds are raised once a week", async () => {
    const monday = setup({ now: new Date("2031-06-16T08:00:00Z") });
    const sunday = setup({ now: new Date("2031-06-22T23:00:00Z") });
    const next = setup({ now: new Date("2031-06-23T00:30:00Z") });
    for (const { alerts } of [monday, sunday, next]) await alerts.needAttention(holds);
    const key = (s: { enqueue: { mock: { calls: unknown[][] } } }) =>
      (s.enqueue.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey;
    expect(key(monday)).toBe("kyc-retention-hold-notice:2031-06-16:c1");
    expect(key(sunday)).toBe(key(monday));
    expect(key(next)).toBe("kyc-retention-hold-notice:2031-06-23:c1");
  });

  it("falls back to the admin address when nobody is a compliance recipient", async () => {
    const { alerts, enqueue } = setup({ recipients: [], admin: "admin@lax.test" });
    await alerts.needAttention(holds);
    expect(enqueue.mock.calls[0]?.[0]).toMatchObject({
      to: "admin@lax.test",
      recipientResolution: "snapshot",
    });
  });

  it("sends nothing for no holds, and never loses the alert silently when there is nobody", async () => {
    const quiet = setup();
    await quiet.alerts.needAttention([]);
    expect(quiet.enqueue).not.toHaveBeenCalled();
    const nobody = setup({ recipients: [] });
    await nobody.alerts.needAttention(holds);
    expect(nobody.enqueue).not.toHaveBeenCalled();
  });

  it("shows the first twenty deals and counts the rest", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      reference: `PS-${String(i + 1).padStart(4, "0")}`,
      kind: "no_end" as const,
    }));
    const { alerts, enqueue } = setup();
    await alerts.needAttention(many);
    const vars = (enqueue.mock.calls[0]?.[0] as { vars: { lines: string[]; count: number } }).vars;
    expect(vars.lines).toHaveLength(20);
    expect(vars.count).toBe(25);
  });
});
