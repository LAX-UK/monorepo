import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
const saveContactDetailsAction = vi.fn();
vi.mock("@/lib/organisation-team/organisation-team.actions", () => ({
  saveContactDetailsAction: (...args: unknown[]) => saveContactDetailsAction(...args),
}));

import { ContactDetailsCard } from "./contact-details-card";

const details = {
  email: "hello@northbank.gallery",
  phone: null,
  website: "https://northbank.gallery",
  updatedAt: null,
  canEdit: true,
};

describe("ContactDetailsCard", () => {
  beforeEach(() => {
    saveContactDetailsAction.mockReset();
    refresh.mockReset();
  });

  it("shows each detail, with Add for one not given", () => {
    render(<ContactDetailsCard legalEntityId="org" details={details} />);
    expect(screen.getByText("hello@northbank.gallery")).toBeInTheDocument();
    expect(screen.getByText("northbank.gallery")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add phone" })).toBeInTheDocument();
  });

  it("saves the whole set when one detail changes", async () => {
    saveContactDetailsAction.mockResolvedValue({ ok: true });
    render(<ContactDetailsCard legalEntityId="org" details={details} />);
    fireEvent.click(screen.getByRole("button", { name: "Add phone" }));
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "+44 20 7946 0321" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(saveContactDetailsAction).toHaveBeenCalledWith("org", {
        email: "hello@northbank.gallery",
        phone: "+44 20 7946 0321",
        website: "https://northbank.gallery",
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says what is wrong before sending, and shows a refusal", async () => {
    saveContactDetailsAction.mockResolvedValue({ ok: false, error: "Only owners and admins can." });
    render(<ContactDetailsCard legalEntityId="org" details={details} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit email" }));
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Enter an email address like name@example.com"),
    ).toBeInTheDocument();
    expect(saveContactDetailsAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "a@b.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Only owners and admins can.")).toBeInTheDocument();
  });

  it("offers no changes to a member who only reads", () => {
    render(
      <ContactDetailsCard
        legalEntityId="org"
        details={{ ...details, phone: null, canEdit: false }}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });
});
