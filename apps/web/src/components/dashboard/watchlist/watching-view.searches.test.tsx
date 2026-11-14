import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchingView } from "./watching-view";

const refresh = vi.fn();
const switchEmail = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/watching",
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (m: string) => success(m), error: (...a: unknown[]) => error(...a) },
}));
vi.mock("@/lib/data/http/saved-searches.client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/http/saved-searches.client")>()),
  deleteSavedSearch: vi.fn(),
}));
vi.mock("@/lib/watching/search-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/watching/search-email")>()),
  switchSearchEmail: (...a: unknown[]) => switchEmail(...a),
}));

const search = (id: string, label: string, notifyEmail: boolean) => ({
  id,
  label,
  query: { q: label },
  notifyEmail,
  createdAt: "2026-11-01T00:00:00Z",
});

const SEARCHES = [search("a", "Search: harbour", true), search("b", "Search: oil", false)];
const reach = (emailOn: boolean) => ({
  artists: { emailOn: true, appOn: true },
  searches: { emailOn, appOn: emailOn },
});

function show(over: Partial<React.ComponentProps<typeof WatchingView>> = {}) {
  render(
    <WatchingView
      query={{ view: "searches", q: "", sort: "closing" }}
      lots={[]}
      artists={[]}
      searches={SEARCHES}
      reach={reach(true)}
      emailAccess="ok"
      organisation={null}
      {...over}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("Watching: a saved search's email control", () => {
  it("is a held switch with the reason and a way to put it right once alerts are stopped", () => {
    show({ emailAccess: "stopped", reach: reach(false) });
    const held = screen.getByRole("switch", { name: "Email alerts for Search: oil" });
    expect(held).toHaveAttribute("aria-disabled", "true");
    expect(held).toHaveAccessibleDescription("You stopped all alerts");
    expect(screen.getAllByRole("link", { name: "Turn alerts back on" })[0]).toHaveAttribute(
      "href",
      "/settings#alerts",
    );
    fireEvent.click(held);
    expect(switchEmail).not.toHaveBeenCalled();
  });

  it("is held with the verification reason for an unverified address", () => {
    show({ emailAccess: "unverified" });
    expect(
      screen.getByRole("switch", { name: "Email alerts for Search: oil" }),
    ).toHaveAccessibleDescription("Verify your email address to get alerts");
    expect(screen.getAllByRole("link", { name: "Verify your email" }).length).toBeGreaterThan(0);
  });

  it("describes why a switch is off when saved-search email is off", () => {
    show({ reach: reach(false) });
    expect(
      screen.getByRole("switch", { name: "Email alerts for Search: harbour" }),
    ).toHaveAccessibleDescription(/^Email is off for saved searches/);
  });

  it("turns one search on at once when nothing else would come back with it", async () => {
    switchEmail.mockResolvedValue({ ok: true });
    show();
    fireEvent.click(screen.getByRole("switch", { name: "Email alerts for Search: oil" }));
    await waitFor(() =>
      expect(switchEmail).toHaveBeenCalledWith({
        id: "b",
        on: true,
        previous: false,
        access: "ok",
      }),
    );
    expect(success).toHaveBeenCalledWith("Email alerts are on for this search");
  });

  it("asks first when saved-search email is off and another search is waiting, then names what came back", async () => {
    switchEmail.mockResolvedValue({ ok: true });
    show({ reach: reach(false) });
    fireEvent.click(screen.getByRole("switch", { name: "Email alerts for Search: oil" }));
    expect(
      await screen.findByText(
        "This also turns on email for 1 other saved search that already had it switched on.",
      ),
    ).toBeInTheDocument();
    expect(switchEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        "Email alerts are on for this search and 1 other saved search",
      ),
    );
  });
});
