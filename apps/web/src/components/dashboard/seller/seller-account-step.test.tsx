import type { SellerAccountOption } from "@/lib/seller/seller-account-options";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SellerAccountStep } from "./seller-account-step";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const personal: SellerAccountOption = {
  id: "me",
  kind: "personal",
  name: "Jane Smith",
  roleLabel: null,
  canSubmit: true,
  submitBlockedReason: null,
  sellingNote: null,
};
const gallery: SellerAccountOption = {
  id: "gallery",
  kind: "organisation",
  name: "Northbank Gallery",
  roleLabel: "Admin",
  canSubmit: true,
  submitBlockedReason: null,
  sellingNote: null,
};
const newGallery: SellerAccountOption = {
  id: "new",
  kind: "organisation",
  name: "Harbour Studio",
  roleLabel: "Owner",
  canSubmit: false,
  submitBlockedReason: "We're still checking this organisation's documents.",
  sellingNote: {
    summary: "Under review. You can save a draft now.",
    notice: "We're still checking this organisation's documents.",
    step: null,
  },
};
const documentsNeeded: SellerAccountOption = {
  ...newGallery,
  id: "docs",
  name: "Crowley Fine Art Ltd",
  sellingNote: {
    summary: "Documents needed. You can save a draft now.",
    notice: "We're waiting for this organisation's documents.",
    step: {
      label: "Continue setup",
      href: "/onboarding/organisation/step/documents?entityId=docs",
    },
  },
};

function renderStep(
  options: SellerAccountOption[],
  selectedId: string,
  registerHref: string | null = "/onboarding/organisation?fresh=1",
) {
  const handlers = {
    onSelect: vi.fn(),
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    onSaveDraft: vi.fn(),
  };
  render(
    <SellerAccountStep
      options={options}
      selectedId={selectedId}
      registerHref={registerHref}
      busy={false}
      {...handlers}
    />,
  );
  return handlers;
}

describe("SellerAccountStep", () => {
  it("fixes the seller to Personal when there is no organisation", () => {
    const handlers = renderStep([personal], "me");
    expect(screen.getByRole("heading", { name: "Who is selling?" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(/sold under your own name/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send to our specialists" }));
    expect(handlers.onSubmit).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Register an organisation" })).toHaveAttribute(
      "href",
      "/onboarding/organisation?fresh=1",
    );
  });

  it("lists organisations with the person's role and names the account on the button", () => {
    const handlers = renderStep([personal, gallery], "gallery");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Northbank Gallery" })).toBeChecked();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Personal" }));
    expect(handlers.onSelect).toHaveBeenCalledWith("me");
    expect(screen.getByRole("button", { name: "Send as Northbank Gallery" })).toBeEnabled();
  });

  it("lets an organisation under review save a draft, saying why it cannot submit", () => {
    const handlers = renderStep([personal, newGallery], "new");
    expect(screen.getByText("We're still checking this organisation's documents.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Submit/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(handlers.onSaveDraft).toHaveBeenCalled();
  });

  it("tells an organisation waiting on documents what to do, with the step", () => {
    renderStep([personal, documentsNeeded], "docs");
    expect(screen.getByText("Documents needed. You can save a draft now.")).toBeInTheDocument();
    expect(screen.getByText("We're waiting for this organisation's documents.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Continue setup" })).toHaveAttribute(
      "href",
      "/onboarding/organisation/step/documents?entityId=docs",
    );
  });

  it("offers no step while LAX is reviewing", () => {
    renderStep([personal, newGallery], "new");
    expect(screen.getByText("Under review. You can save a draft now.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue setup" })).not.toBeInTheDocument();
  });

  it("does not offer to register an organisation to someone already acting for one", () => {
    renderStep([personal, gallery], "gallery", null);
    expect(screen.queryByText(/Selling for a business/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Register an organisation" }),
    ).not.toBeInTheDocument();
  });

  it("goes back to the work", () => {
    const handlers = renderStep([personal], "me");
    fireEvent.click(screen.getByRole("button", { name: "Back to the work" }));
    expect(handlers.onBack).toHaveBeenCalled();
  });
});
