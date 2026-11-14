import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WatchingView } from "./watching-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/watching",
  useSearchParams: () => new URLSearchParams(window.location.search),
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

function show(address: string) {
  window.history.replaceState(null, "", `/watching${address}`);
  return render(
    <WatchingView
      lots={[lot("1", "Harbour Light"), lot("2", "Red Door")]}
      artists={[]}
      searches={[]}
      reach={null}
      emailAccess="ok"
      organisation={null}
    />,
  );
}

describe("Watching keeps its search and order in the address", () => {
  it("writes the search to ?q= and filters the list", async () => {
    show("");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "harbour" } });
    await waitFor(() => expect(window.location.search).toBe("?q=harbour"));
    expect(screen.queryByText("Red Door")).toBeNull();
    expect(screen.getByText("Harbour Light")).toBeInTheDocument();
  });

  it("restores search from the address, as Back does", () => {
    show("?q=red");
    expect(screen.getByRole("searchbox")).toHaveValue("red");
    expect(screen.queryByText("Harbour Light")).toBeNull();
    expect(screen.getByText("Red Door")).toBeInTheDocument();
  });
});
