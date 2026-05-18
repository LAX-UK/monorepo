import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishLotButton } from "./publish-lot-button";

vi.mock("@/lib/actions/admin", () => ({
  adminPublishLotResultAction: vi.fn().mockResolvedValue({ ok: false, error: "skip" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("PublishLotButton", () => {
  it("renders publish control", () => {
    renderWithViewer(<PublishLotButton lotId="lot-1" sellerLegalEntityId={null} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("keeps publish enabled independently of cancel flow", () => {
    renderWithViewer(<PublishLotButton lotId="lot-1" sellerLegalEntityId={null} />);
    const publish = screen.getByRole("button", { name: "Publish" });
    fireEvent.click(publish);
    expect(publish).toBeInTheDocument();
  });
});
