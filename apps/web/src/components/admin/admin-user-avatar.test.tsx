import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserAvatar, initialsFromName } from "./admin-user-avatar";

describe("initialsFromName", () => {
  it("uses first and last initial for multi-word names", () => {
    expect(initialsFromName("Jane Doe")).toBe("JD");
  });

  it("uses first two letters for single names", () => {
    expect(initialsFromName("Madonna")).toBe("MA");
  });
});

describe("AdminUserAvatar", () => {
  it("renders initials fallback when no image", () => {
    render(<AdminUserAvatar user={{ id: "user-1", name: "Jane Doe", image: null }} size="sm" />);
    expect(screen.getByText("JD")).toBeTruthy();
  });
});
