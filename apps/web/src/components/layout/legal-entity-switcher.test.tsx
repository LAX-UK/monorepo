import { LegalEntitySwitcher } from "@/components/layout/legal-entity-switcher";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-hydrated", () => ({
  useHydrated: () => true,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/organisations",
  useRouter: () => ({ refresh: vi.fn() }),
}));

const personal = {
  id: "personal-1",
  displayName: "Mahmoud Amr",
  kind: "individual" as const,
  subkind: "private_collector" as const,
  status: "connect_pending" as const,
  role: "owner" as const,
  isPrimaryAdmin: true,
};

const org = {
  id: "org-1",
  displayName: "test one",
  kind: "organisation" as const,
  subkind: "dealer" as const,
  status: "lead" as const,
  role: "owner" as const,
  isPrimaryAdmin: true,
};

describe("LegalEntitySwitcher", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("opens workspace menu on trigger click", () => {
    render(
      <LegalEntitySwitcher acting={personal} memberships={[personal, org]} orgModuleEnabled />,
    );

    const trigger = screen.getByTestId("legal-entity-switcher");
    expect(trigger).not.toBeDisabled();

    fireEvent.click(trigger);
    expect(screen.getByText("Current context")).toBeInTheDocument();
    expect(screen.getByText("test one")).toBeInTheDocument();
  });
});
