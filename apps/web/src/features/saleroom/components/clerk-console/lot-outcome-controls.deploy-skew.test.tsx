import { LotOutcomeControls } from "@/features/saleroom/components/clerk-console/lot-outcome-controls";
import { setClerkCommandFetchForTests } from "@/features/saleroom/lib/clerk-commands.client";
import { notify } from "@/lib/ui/notify";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const SALE = "11111111-1111-4111-8111-111111111111";
const PAGE = `/admin/saleroom/${SALE}`;

/**
 * The server after a deploy: the page no longer knows the server action ids the open console was
 * built with (Next answers 404 and the client throws `UnrecognizedActionError`), while the BFF's
 * API paths are the same on every build.
 */
function deployedServer() {
  return vi.fn(async (input: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    if (input === PAGE || headers.has("next-action")) {
      return new Response("Server action not found.", { status: 404 });
    }
    if (input.startsWith("/api/bff/admin/sales/") && init.method === "POST") {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("Not found", { status: 404 });
  });
}

async function holdHammer() {
  const hammer = screen.getByRole("button", { name: "Hold to hammer" });
  fireEvent.pointerDown(hammer, { button: 0 });
  await act(async () => {
    vi.advanceTimersByTime(700);
  });
  vi.useRealTimers();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  setClerkCommandFetchForTests(null);
});

describe("LotOutcomeControls across a deploy", () => {
  it("hammers on a console opened before the deploy, once, with no error boundary", async () => {
    const server = deployedServer();
    setClerkCommandFetchForTests(server);
    vi.useFakeTimers();

    render(<LotOutcomeControls saleId={SALE} canHammer />);
    await holdHammer();

    expect(server).toHaveBeenCalledTimes(1);
    expect(server.mock.calls[0]?.[0]).toBe(`/api/bff/admin/sales/${SALE}/saleroom/hammer`);
    expect(notify.success).toHaveBeenCalledWith("Lot hammered");
    expect(notify.error).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reports a refused hammer as a message on the console, not a crash, and does not resend it", async () => {
    const server = vi.fn(async () => new Response("Not found", { status: 404 }));
    setClerkCommandFetchForTests(server);
    vi.useFakeTimers();

    render(<LotOutcomeControls saleId={SALE} canHammer />);
    await holdHammer();

    expect(server).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith("Hammer failed");
    expect(screen.getByRole("button", { name: "Hold to hammer" })).toBeInTheDocument();
  });
});
