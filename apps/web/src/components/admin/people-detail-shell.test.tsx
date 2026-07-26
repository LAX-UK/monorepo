import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PeopleDetailShell } from "./people-detail-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/clients/u1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/admin/catalog", () => ({
  CatalogBreadcrumbs: ({ segments }: { segments: { label: string }[] }) => (
    <nav>{segments.map((s) => s.label).join(" / ")}</nav>
  ),
  CatalogDetailMobileMeta: ({ entityId }: { entityId?: string }) => (
    <div data-testid="mobile-meta" data-entity-id={entityId} />
  ),
  CatalogDetailShell: ({
    aside,
    children,
    mobileMeta,
    description,
  }: {
    aside?: React.ReactNode;
    children?: React.ReactNode;
    mobileMeta?: React.ReactNode;
    description?: string;
  }) => (
    <div>
      {description ? <p data-testid="description">{description}</p> : null}
      <div data-testid="aside">{aside}</div>
      <div data-testid="mobile-meta-slot">{mobileMeta}</div>
      {children}
    </div>
  ),
  CatalogDetailQueryTabs: ({
    tabs,
  }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) => (
    <div>
      {tabs.map((tab) => (
        <section key={tab.id} aria-label={tab.label}>
          {tab.content}
        </section>
      ))}
    </div>
  ),
}));

vi.mock("@/components/admin/admin-pin-page-button", () => ({
  AdminPinPageButton: () => null,
}));

vi.mock("@/components/admin/admin-user-attention-banner", () => ({
  AdminUserAttentionBanner: () => null,
}));

vi.mock("@/components/admin/admin-user-detail-header-meta", () => ({
  AdminUserDetailHeaderMeta: () => null,
}));

vi.mock("@/components/admin/editable-titles", () => ({
  AdminUserDisplayNameEditableTitle: ({ value }: { value: string }) => <h1>{value}</h1>,
}));

vi.mock("@/components/admin/user-detail-context-rail", () => ({
  UserDetailContextRail: () => <div data-testid="client-context-rail">Client context</div>,
}));

vi.mock("@/components/admin/admin-user-account-controls", () => ({
  AdminUserAccountControls: () => <div data-testid="account-controls">Account controls</div>,
}));

vi.mock("@/components/admin/admin-user-danger-zone", () => ({
  AdminUserDangerZone: () => <section data-testid="danger-zone">Danger zone</section>,
}));

const baseUser = {
  id: "u1",
  name: "Test Client",
  email: "client@example.com",
  role: "user",
  staffRole: null,
  signupPersona: "individual",
  suspendedAt: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
} as unknown as AdminUserDetailPayload;

describe("PeopleDetailShell", () => {
  it("does not render a desktop aside rail", () => {
    render(
      <PeopleDetailShell
        user={baseUser}
        listHref="/admin/clients"
        listLabel="Clients"
        tabs={[{ id: "overview", label: "Overview", content: <p>Overview body</p> }]}
      />,
    );

    expect(screen.queryByTestId("aside")).toBeEmptyDOMElement();
  });

  it("keeps account controls and danger zone in the main column for mobile scroll reachability", () => {
    render(
      <PeopleDetailShell
        user={baseUser}
        listHref="/admin/clients"
        listLabel="Clients"
        tabs={[{ id: "overview", label: "Overview", content: <p>Overview body</p> }]}
      />,
    );

    expect(screen.getByTestId("mobile-meta")).toHaveAttribute("data-entity-id", "u1");
    expect(screen.getByTestId("account-controls")).toBeInTheDocument();
    expect(screen.getByTestId("danger-zone")).toBeInTheDocument();
  });

  it("renders client context rail in the main column", () => {
    render(
      <PeopleDetailShell
        user={baseUser}
        listHref="/admin/clients"
        listLabel="Clients"
        tabs={[{ id: "overview", label: "Overview", content: <p>Overview body</p> }]}
      />,
    );

    expect(screen.getByTestId("client-context-rail")).toBeInTheDocument();
  });

  it("uses email-only description for clients (persona shown in header meta badge)", () => {
    render(
      <PeopleDetailShell
        user={baseUser}
        listHref="/admin/clients"
        listLabel="Clients"
        tabs={[{ id: "overview", label: "Overview", content: <p>Overview body</p> }]}
      />,
    );

    expect(screen.getByTestId("description")).toHaveTextContent("client@example.com");
    expect(screen.getByTestId("description")).not.toHaveTextContent("Individual");
  });

  it("omits client context rail for staff detail", () => {
    render(
      <PeopleDetailShell
        user={{ ...baseUser, role: "staff", staffRole: "admin" }}
        listHref="/admin/staff"
        listLabel="Staff"
        showContextRail={false}
        tabs={[
          {
            id: "permissions",
            label: "Permissions",
            content: <p>Permissions body</p>,
          },
        ]}
      />,
    );

    expect(screen.queryByTestId("client-context-rail")).not.toBeInTheDocument();
  });
});
