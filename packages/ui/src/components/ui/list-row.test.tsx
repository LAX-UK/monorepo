import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListRow } from "./list-row.js";

describe("ListRow", () => {
  it("renders a link row when given an href", () => {
    render(<ListRow title="Edit account" href="/account/profile" />);
    const link = screen.getByRole("link", { name: "Edit account" });
    expect(link).toHaveAttribute("href", "/account/profile");
    expect(link.className).toContain("focus-visible:ring-2");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("prefers the href over onAction", () => {
    render(<ListRow title="Help centre" href="/help" onAction={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Help centre" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a button row for onAction", () => {
    const onAction = vi.fn();
    render(<ListRow title="Sign out" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("renders a static row when disabled, even with an href", () => {
    render(<ListRow title="Language" href="/language" disabled />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Language")).toBeInTheDocument();
  });
});
