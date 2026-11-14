import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchingView } from "./watching-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/watching",
}));

const lot = (id: string, title: string) =>
  ({
    lotId: id,
    title,
    href: `/lot/${id}`,
    lotLabel: "Lot 1",
    saleTitle: "Sale",
    moment: "Closes soon",
    reminder: null,
    ended: false,
    image: null,
    displayStyle: "document",
    figure: { label: "Current bid", value: "£100" },
    standing: { label: "Watching", tone: "neutral", shape: "ring" },
  }) as never;

function show(query: { view: "lots"; q: string; sort: "closing" | "added" }) {
  return render(
    <WatchingView
      query={query}
      lots={[lot("1", "Harbour Light"), lot("2", "Red Door")]}
      artists={[]}
      searches={[]}
      reach={null}
      emailAccess="ok"
      organisation={null}
    />,
  );
}

beforeEach(() => window.history.replaceState(null, "", "/watching"));

describe("Watching keeps its search and order in the address", () => {
  it("writes the search to ?q= and filters the list", async () => {
    show({ view: "lots", q: "", sort: "closing" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "harbour" } });
    await waitFor(() => expect(window.location.search).toBe("?q=harbour"));
    expect(screen.queryByText("Red Door")).toBeNull();
    expect(screen.getByText("Harbour Light")).toBeInTheDocument();
  });

  it("restores search from the address, as Back does", () => {
    show({ view: "lots", q: "red", sort: "closing" });
    expect(screen.getByRole("searchbox")).toHaveValue("red");
    expect(screen.queryByText("Harbour Light")).toBeNull();
    expect(screen.getByText("Red Door")).toBeInTheDocument();
  });
});
