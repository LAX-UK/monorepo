// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const recordCertificateAuthority = vi.fn();
const approveHorsCommerce = vi.fn();

vi.mock("@/server/application/print-fulfilment-actions.server", () => ({
  recordCertificateAuthority,
  approveHorsCommerce,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/artworks/a-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { CertificateAuthorityCard, laxIssuesCertificate } = await import(
  "./certificate-authority-card.client"
);
const { HorsCommerceApprovalCard } = await import("./hors-commerce-approval-card.client");

const ARTWORK = "11111111-1111-4111-8111-111111111111";

describe("laxIssuesCertificate", () => {
  const facts = (issuer: "artist" | "lax") => ({
    facts: {
      numbering: "on_print" as const,
      signature: { kind: "unsigned" as const },
      certificate: {
        kind: "included" as const,
        issuer,
        form: "digital" as const,
        arrives: { kind: "with_print" as const },
        numberedToMatch: true,
      },
    },
  });

  it("is true only when London Art Exchange issues the certificate", () => {
    expect(laxIssuesCertificate(facts("lax"))).toBe(true);
    expect(laxIssuesCertificate(facts("artist"))).toBe(false);
    expect(laxIssuesCertificate({ facts: null })).toBe(false);
    expect(
      laxIssuesCertificate({
        facts: {
          numbering: "none",
          signature: { kind: "unsigned" },
          certificate: { kind: "none" },
        },
      }),
    ).toBe(false);
  });
});

describe("CertificateAuthorityCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("explains what is missing, and keeps the button off until there is something to record", async () => {
    const { rerender } = render(
      <CertificateAuthorityCard artworkId={ARTWORK} authority={null} canWrite />,
    );
    expect(screen.getByText(/Packing waits until this is recorded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record authority" })).toBeDisabled();
    rerender(
      <CertificateAuthorityCard
        artworkId={ARTWORK}
        authority={{ reference: "Estate letter", recordedAt: "2026-11-03T10:00:00.000Z" }}
        canWrite
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Update reference" }));
    expect(
      await screen.findByText("Say where the artist's written authority is kept."),
    ).toBeInTheDocument();
    expect(recordCertificateAuthority).not.toHaveBeenCalled();
  });

  it("records the trimmed reference", async () => {
    recordCertificateAuthority.mockResolvedValue({ ok: true, data: { recordedAt: "x" } });
    render(<CertificateAuthorityCard artworkId={ARTWORK} authority={null} canWrite />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Letter of 3 October " } });
    fireEvent.click(screen.getByRole("button", { name: "Record authority" }));
    await waitFor(() =>
      expect(recordCertificateAuthority).toHaveBeenCalledWith(
        expect.objectContaining({ artworkId: ARTWORK, reference: "Letter of 3 October" }),
      ),
    );
  });

  it("shows what is recorded, read-only, to staff who cannot edit", () => {
    render(
      <CertificateAuthorityCard
        artworkId={ARTWORK}
        authority={{ reference: "Estate letter", recordedAt: "2026-11-03T10:00:00.000Z" }}
        canWrite={false}
      />,
    );
    expect(screen.getByText(/Estate letter/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("HorsCommerceApprovalCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lets a shop admin approve a proof that is not yet approved", async () => {
    approveHorsCommerce.mockResolvedValue({ ok: true, data: { approvedAt: "x", approvedBy: "y" } });
    render(
      <HorsCommerceApprovalCard
        artworkId={ARTWORK}
        horsCommerce={{ approvedAt: null }}
        canApprove
      />,
    );
    expect(screen.getByText("Needs approval")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve for sale" }));
    await waitFor(() =>
      expect(approveHorsCommerce).toHaveBeenCalledWith(
        expect.objectContaining({ artworkId: ARTWORK }),
      ),
    );
  });

  it("tells everyone else that a shop admin has to approve it", () => {
    render(
      <HorsCommerceApprovalCard
        artworkId={ARTWORK}
        horsCommerce={{ approvedAt: null }}
        canApprove={false}
      />,
    );
    expect(screen.getByText(/A shop admin needs to approve it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve for sale" })).toBeNull();
  });

  it("shows the approval once given", () => {
    render(
      <HorsCommerceApprovalCard
        artworkId={ARTWORK}
        horsCommerce={{ approvedAt: "2026-11-03T10:00:00.000Z" }}
        canApprove
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve for sale" })).toBeNull();
  });
});
