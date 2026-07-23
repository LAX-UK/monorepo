import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogPostCreateSessionProvider } from "./catalog-post-create-session";
import { CatalogWhatsNextBanner } from "./catalog-whats-next-banner";

const replace = vi.fn();
const readiness = {
  items: [{ id: "images", label: "Images", ok: false, severity: "required" as const }],
  completeCount: 0,
  totalCount: 1,
  percent: 0,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("created=1"),
}));

describe("CatalogWhatsNextBanner", () => {
  it("stays visible after URL param is stripped", () => {
    render(
      <CatalogPostCreateSessionProvider>
        <CatalogWhatsNextBanner
          entityLabel="lot"
          readiness={readiness}
          dismissKey="lot-1-readiness"
        />
      </CatalogPostCreateSessionProvider>,
    );

    expect(screen.getByText(/Your lot draft is saved/i)).toBeInTheDocument();
    expect(replace).toHaveBeenCalled();
    expect(screen.getByText(/Your lot draft is saved/i)).toBeInTheDocument();
  });
});
