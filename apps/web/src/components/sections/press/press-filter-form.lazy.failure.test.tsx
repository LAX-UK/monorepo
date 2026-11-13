import { PressFilterForm } from "@/components/sections/press/press-filter-form";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

/** The form's validation chunk: refused while `fail` is set. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/components/sections/press/press-filter-form.validation", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/sections/press/press-filter-form.validation")
  >("@/components/sections/press/press-filter-form.validation");
  return {
    get pressFilterResolver() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("Loading chunk 50891 failed");
      return actual.pressFilterResolver;
    },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const initialParams = { q: "", year: null, mentionType: null, page: 1 };

async function apply(text: string) {
  fireEvent.change(screen.getByLabelText(/Search/), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  });
}

// Transform the chunk once up front so the first test does not spend its wait on it.
beforeAll(async () => {
  await import("@/components/sections/press/press-filter-form.validation");
}, 30_000);

// The tests run in order and share the module cache: the chunk fails, then it arrives.
describe("PressFilterForm when its validation cannot be fetched", () => {
  it("says the search did not load instead of doing nothing", async () => {
    render(<PressFilterForm initialParams={initialParams} years={[2026]} />);
    await apply("BBC");

    expect(
      await screen.findByText("Search didn't load. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("fetches the check again on the next submit and filters once it arrives", async () => {
    render(<PressFilterForm initialParams={initialParams} years={[2026]} />);
    await apply("BBC");
    await screen.findByText(/Search didn't load/);
    const loadsBefore = chunk.loads;
    chunk.fail = false;

    await apply("BBC");

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0]?.[0]).toContain("q=BBC");
    expect(chunk.loads).toBe(loadsBefore + 1);
    expect(screen.queryByText(/Search didn't load/)).toBeNull();
  });
});
