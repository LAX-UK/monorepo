import { queuePanel } from "@/test/queue-panel";
import type { PersonEmailDeliveryView } from "@auction/types";
import { TooltipProvider } from "@auction/ui/lax/tooltip";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailDeliveryView } from "./email-delivery-view";

const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => searchParams.current,
}));
vi.mock("@/lib/actions/admin/email-delivery", () => ({ liftEmailBlockAction: vi.fn() }));

const send = (n: number) => ({
  id: `s${n}`,
  label: `Email ${n}`,
  essential: true,
  product: "bid" as const,
  status: "delivered" as const,
  createdAt: "2026-11-03T09:14:00.000Z",
  sentAt: "2026-11-03T09:14:00.000Z",
  events: [],
});

const view = (over: Partial<PersonEmailDeliveryView> = {}): PersonEmailDeliveryView => ({
  addressStatus: "bounced",
  lastDeliveredAt: null,
  alerts: null,
  block: {
    reason: "hard_bounce",
    since: "2026-10-28T16:02:00.000Z",
    providerDetail: null,
    stopsEssentialEmail: true,
    liftReasons: ["mailbox_fixed", "other"],
    noteRequired: false,
    writtenRequestRequired: false,
    lift: { allowed: true },
  },
  sends: [1, 2, 3, 4, 5, 6, 7].map(send),
  ...over,
});

function show(v: PersonEmailDeliveryView, viewerCanLift = true) {
  render(
    <TooltipProvider>
      <EmailDeliveryView
        userId="user-1"
        personName="Ana Duarte"
        email="ana@example.com"
        view={v}
        viewerCanLift={viewerCanLift}
      />
    </TooltipProvider>,
  );
}

describe("EmailDeliveryView", () => {
  it("offers the lift where the server allows it and opens the confirm", () => {
    show(view());
    fireEvent.click(screen.getByRole("button", { name: /Lift block/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("disables the lift with the server's reason in text, not a hover", () => {
    const base = view();
    if (!base.block) throw new Error("fixture");
    show(
      view({
        block: {
          ...base.block,
          lift: { allowed: false, reason: "Only an administrator can lift a complaint block" },
        },
      }),
    );
    const button = screen.getByRole("button", { name: /Lift block/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Only an administrator can lift a complaint block/)).toBeTruthy();
  });

  it("leaves the lift out for a viewer who can never lift", () => {
    show(view(), false);
    expect(screen.queryByRole("button", { name: /Lift block/ })).toBeNull();
  });

  it("shows five sends first and all of them on request", () => {
    show(view({ block: null, addressStatus: "ok" }));
    expect(screen.getByText("Showing 5 of 7")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all 7" }));
    expect(screen.getByText("Showing 7 of 7")).toBeTruthy();
  });

  it("says so when nothing has been sent", () => {
    show(view({ block: null, addressStatus: "ok", sends: [] }));
    expect(screen.getByText("No emails sent yet")).toBeTruthy();
  });
});

describe("EmailDeliveryView email panel address", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/staff/user-1");
    searchParams.current = new URLSearchParams();
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  const order = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent?.match(/Email \d/)?.[0]);

  it("puts the open email in the address and steps through the sends shown with J and K", () => {
    show(view({ block: null, addressStatus: "ok" }));
    const [first, second, third] = order();
    fireEvent.click(screen.getAllByText(second as string)[0] as HTMLElement);
    const secondId = `s${(second as string).slice(-1)}`;
    expect(window.location.search).toBe(`?emailSend=${secondId}`);
    expect(queuePanel.position()).toBe("2 of 5");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    expect(queuePanel.title(third as string)).toBeVisible();
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    expect(queuePanel.title(first as string)).toBeVisible();
  });

  it("reopens the email from the address", () => {
    searchParams.current = new URLSearchParams("emailSend=s3");
    show(view({ block: null, addressStatus: "ok" }));
    expect(queuePanel.title("Email 3")).toBeVisible();
  });

  it("closes on Back and returns focus to the email's row on Escape", async () => {
    show(view({ block: null, addressStatus: "ok" }));
    const [first] = order();
    fireEvent.click(screen.getAllByText(first as string)[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getAllByText(first as string)[0] as HTMLElement);
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    await waitFor(() => expect(queuePanel.focusedRowText()).toContain(first as string));
  });
});
