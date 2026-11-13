import { SearchFilterForm } from "@/components/marketing/search-filter-form";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

/** The form's validation chunk: refused while `fail` is set. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/components/marketing/search-filter-form.validation", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/marketing/search-filter-form.validation")
  >("@/components/marketing/search-filter-form.validation");
  return {
    get searchFilterResolver() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("Loading chunk 50891 failed");
      return actual.searchFilterResolver;
    },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/analytics/events", () => ({ trackSearch: vi.fn() }));

async function search(text: string) {
  fireEvent.change(screen.getByLabelText(/Keywords/), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
  });
}

// Transform the chunk once up front so the first test does not spend its wait on it.
beforeAll(async () => {
  await import("@/components/marketing/search-filter-form.validation");
}, 30_000);

// The tests run in order and share the module cache: the chunk fails, then it arrives.
describe("SearchFilterForm when its validation cannot be fetched", () => {
  it("says the search did not load instead of doing nothing", async () => {
    render(<SearchFilterForm initialQ="" sort="endingAsc" />);
    await search("horizon");

    expect(
      await screen.findByText("Search didn't load. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();
  });

  it("fetches the check again on the next submit and searches once it arrives", async () => {
    render(<SearchFilterForm initialQ="" sort="endingAsc" />);
    await search("horizon");
    await screen.findByText(/Search didn't load/);
    const loadsBefore = chunk.loads;
    chunk.fail = false;

    await search("horizon");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/search?offset=0&q=horizon"));
    expect(chunk.loads).toBe(loadsBefore + 1);
    expect(screen.queryByText(/Search didn't load/)).toBeNull();
  });
});
