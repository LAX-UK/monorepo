import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonAvatar } from "./person-avatar";

describe("PersonAvatar", () => {
  it("shows the initials on a plain tile, without the hatched artwork placeholder", () => {
    const { container } = render(<PersonAvatar src={null} name="Jane Smith" initials="JS" />);
    expect(screen.getByText("JS")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("img", { name: /placeholder/i })).toBeNull();
  });
});
