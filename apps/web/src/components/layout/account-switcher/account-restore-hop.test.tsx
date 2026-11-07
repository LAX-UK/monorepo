import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountRestoreHop } from "./account-restore-hop";

const replace = vi.fn();
const realLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", { value: { replace }, configurable: true });
});

afterEach(() => {
  Object.defineProperty(window, "location", { value: realLocation, configurable: true });
  vi.clearAllMocks();
});

const HREF = "/restore-account?next=%2Fhome";

describe("AccountRestoreHop", () => {
  it("loads the restore hop as a page, once", () => {
    const { rerender } = render(<AccountRestoreHop href={HREF} />);
    rerender(<AccountRestoreHop href={HREF} />);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(HREF);
  });

  it("says what is happening and offers a plain link if the script does not run", () => {
    render(<AccountRestoreHop href={HREF} />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening your account…");
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", HREF);
  });
});
