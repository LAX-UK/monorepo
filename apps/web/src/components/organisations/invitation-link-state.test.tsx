import type { InvitationLinkView } from "@/lib/organisations/invitation-link.vm";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-client-link="">
      {children}
    </a>
  ),
}));

import { InvitationLinkState } from "./invitation-link-state";

const view: InvitationLinkView = {
  title: "You're already a member",
  description: "Open Northbank Gallery.",
  art: { kind: "tile", initials: "NG" },
  accept: null,
  primary: { label: "Open Northbank Gallery", href: "/switch-account?to=org-1&next=%2Fhome" },
  secondary: { label: "Back to Home", href: "/home" },
  retryNotice: null,
} as unknown as InvitationLinkView;

describe("InvitationLinkState", () => {
  it("opens the account hop as a page load, not a client link", () => {
    render(<InvitationLinkState view={view} acceptAction="/accept" />);
    const primary = screen.getByRole("link", { name: "Open Northbank Gallery" });
    expect(primary).toHaveAttribute("href", "/switch-account?to=org-1&next=%2Fhome");
    expect(primary).not.toHaveAttribute("data-client-link");
  });
});
