import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { expectRowOpensPage, resetRowLinks } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";
import { AdminSaleroomHubBoard } from "./index";

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/saleroom",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/data/http/saleroom-status.client", () => ({
  fetchSaleroomStatus: async () => null,
}));

function sale(id: string, title: string): AdminSaleListRow {
  return {
    sale: {
      id,
      title,
      status: "scheduled",
      deliveryMode: "onsite",
      startTime: "2026-11-20T18:00:00.000Z",
      endTime: "2026-11-20T21:00:00.000Z",
    },
    lots: [],
  } as unknown as AdminSaleListRow;
}

describe("AdminSaleroomHubBoard", () => {
  beforeEach(resetRowLinks);

  it("opens the sale's clerk console from its row, like its title link", () => {
    render(
      <StaffTooltipProvider>
        <AdminSaleroomHubBoard rows={[sale("sale_1", "Autumn Contemporary")]} />
      </StaffTooltipProvider>,
    );
    expectRowOpensPage({
      title: /Autumn Contemporary/,
      href: "/admin/saleroom/sale_1",
      background: "Scheduled",
    });
  });
});
