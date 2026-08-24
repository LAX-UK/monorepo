import { MARKETING_PROMPT_SESSION_KEY } from "@/lib/marketing/prompts/persistence";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingPromptOrchestrator } from "./marketing-prompt-orchestrator";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  search: "",
  session: { user: null as { id: string } | null, pending: false },
  trackMarketingPrompt: vi.fn(),
  trackSellCtaClick: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => mocks.session,
}));

vi.mock("@/lib/analytics/events", () => ({
  trackMarketingPrompt: mocks.trackMarketingPrompt,
}));

vi.mock("@/lib/analytics/sell-funnel", () => ({
  trackSellCtaClick: mocks.trackSellCtaClick,
}));

vi.mock("./marketing-prompt-dialog", () => ({
  MarketingPromptDialog: ({
    variant,
    onDismiss,
    onCta,
  }: {
    variant: "selling" | "signup";
    onDismiss: () => void;
    onCta: () => void;
  }) => (
    <dialog open aria-label={`${variant} prompt`}>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
      <button type="button" onClick={onCta}>
        Continue
      </button>
    </dialog>
  ),
}));

function navigate(pathname: string, rerender: () => void, search = "") {
  mocks.pathname = pathname;
  mocks.search = search;
  rerender();
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("MarketingPromptOrchestrator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    mocks.pathname = "/";
    mocks.search = "";
    mocks.session = { user: null, pending: false };
    mocks.trackMarketingPrompt.mockReset();
    mocks.trackSellCtaClick.mockReset();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for active dwell and three eligible guest pages", () => {
    const view = render(<MarketingPromptOrchestrator enabled />);
    const rerender = () => view.rerender(<MarketingPromptOrchestrator enabled />);

    advance(45_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    navigate("/search", rerender);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    navigate("/artists", rerender);
    expect(screen.getByRole("dialog", { name: "signup prompt" })).toBeInTheDocument();
    expect(mocks.trackMarketingPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ action: "impression", variant: "signup" }),
    );
  });

  it("records selling intent and waits until a later eligible route", () => {
    mocks.pathname = "/sell";
    const view = render(<MarketingPromptOrchestrator enabled />);
    const rerender = () => view.rerender(<MarketingPromptOrchestrator enabled />);

    advance(16_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem(MARKETING_PROMPT_SESSION_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        activeDwellMs: expect.any(Number),
        sellingIntentTrigger: "sell-content",
      }),
    );

    navigate("/search", rerender);
    expect(screen.getByRole("dialog", { name: "selling prompt" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(mocks.trackMarketingPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cta", trigger: "sell-content", variant: "selling" }),
    );
    expect(mocks.trackSellCtaClick).toHaveBeenCalledWith("contextual_marketing_prompt");
  });

  it("pauses dwell while hidden and defers to an existing dialog", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    window.sessionStorage.setItem(
      MARKETING_PROMPT_SESSION_KEY,
      JSON.stringify({
        activeDwellMs: 44_000,
        eligiblePageViews: 2,
        lastEligiblePath: "/search",
        shownVariant: null,
        sellingIntentTrigger: null,
      }),
    );

    const view = render(<MarketingPromptOrchestrator enabled />);
    const rerender = () => view.rerender(<MarketingPromptOrchestrator enabled />);
    advance(10_000);
    navigate("/artists", rerender);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const competing = document.createElement("div");
    competing.setAttribute("role", "dialog");
    competing.setAttribute("data-state", "open");
    document.body.append(competing);
    advance(1_000);
    expect(screen.queryByRole("dialog", { name: "signup prompt" })).not.toBeInTheDocument();

    competing.remove();
    advance(1_000);
    expect(screen.getByRole("dialog", { name: "signup prompt" })).toBeInTheDocument();
  });

  it("caps the session after dismissal", () => {
    window.sessionStorage.setItem(
      MARKETING_PROMPT_SESSION_KEY,
      JSON.stringify({
        activeDwellMs: 45_000,
        eligiblePageViews: 2,
        lastEligiblePath: "/search",
        shownVariant: null,
        sellingIntentTrigger: null,
      }),
    );
    const view = render(<MarketingPromptOrchestrator enabled />);
    const rerender = () => view.rerender(<MarketingPromptOrchestrator enabled />);

    navigate("/artists", rerender);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    navigate("/archive", rerender);
    advance(5_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      mocks.trackMarketingPrompt.mock.calls.filter(([input]) => input.action === "impression"),
    ).toHaveLength(1);
  });
});
