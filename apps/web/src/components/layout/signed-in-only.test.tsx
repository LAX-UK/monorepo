import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let user: { id: string } | null = null;
vi.mock("@/lib/auth/use-app-session", () => ({ useAppSession: () => ({ user, pending: false }) }));

import { whenSignedIn } from "./signed-in-only";

const Part = ({ label }: { label: string }) => <p>{label}</p>;

describe("whenSignedIn", () => {
  beforeEach(() => {
    user = null;
  });

  it("draws nothing for a guest", () => {
    const Gated = whenSignedIn(Part);
    const { container } = render(<Gated label="Extras" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("draws the part, with its props, for a signed-in visitor", () => {
    user = { id: "u1" };
    const Gated = whenSignedIn(Part);
    render(<Gated label="Extras" />);
    expect(screen.getByText("Extras")).toBeInTheDocument();
  });
});
