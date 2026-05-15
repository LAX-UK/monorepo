import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminReviewArtistResultAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminArtistReviewPanel } from "./admin-artist-review-panel";

describe("AdminArtistReviewPanel", () => {
  it("shows Approve and Reject buttons when artist is pending", () => {
    render(<AdminArtistReviewPanel artistId="art-1" currentStatus="pending" />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("shows already-reviewed message for approved artist", () => {
    render(<AdminArtistReviewPanel artistId="art-1" currentStatus="approved" />);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
  });

  it("shows already-reviewed message for rejected artist", () => {
    render(<AdminArtistReviewPanel artistId="art-1" currentStatus="rejected" />);
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
  });

  it("renders review form when status is undefined (treated as pending)", () => {
    render(<AdminArtistReviewPanel artistId="art-1" currentStatus={undefined} />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
  });
});
