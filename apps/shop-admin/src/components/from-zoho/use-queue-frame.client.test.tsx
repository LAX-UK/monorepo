// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho",
  useSearchParams: () => new URLSearchParams(),
}));

const { useQueueFrame } = await import("./use-queue-frame.client");

function Frame({ unlinked }: { unlinked?: number }) {
  const { views } = useQueueFrame({}, { new: 3, decisions: 1 }, unlinked);
  return <div>{views}</div>;
}

describe("the From Zoho tabs", () => {
  it("shows Link lax.art with how many are not linked while any are", () => {
    render(<Frame unlinked={12} />);
    expect(screen.getByRole("link", { name: /Link lax\.art/ })).toHaveAttribute(
      "href",
      "/from-zoho?tab=link",
    );
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("hides Link lax.art once every original is linked", () => {
    render(<Frame unlinked={0} />);
    expect(screen.queryByRole("link", { name: /Link lax\.art/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Last check/ })).toBeInTheDocument();
  });

  it("hides it when the count is not known", () => {
    render(<Frame />);
    expect(screen.queryByRole("link", { name: /Link lax\.art/ })).toBeNull();
  });
});
