// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAdminJson, loadAdminSession, redirect } = vi.hoisted(() => ({
  fetchAdminJson: vi.fn(),
  loadAdminSession: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));
vi.mock("@/server/application/load-admin-data", () => ({ fetchAdminJson, loadAdminSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/admin-breadcrumbs", () => ({ AdminBreadcrumbs: () => null }));
vi.mock("@/components/admin-retry-button.client", () => ({ AdminRetryButton: () => null }));
vi.mock("@/components/home-features/home-features-editor.client", () => ({
  HomeFeaturesEditor: ({ cover }: { cover: unknown }) => (
    <div data-testid="editor" data-cover={cover === null ? "none" : "some"} />
  ),
}));

const { default: FeaturedOnHomePage } = await import("./page");

const FEATURES = { data: { prints: [], artists: [], categories: [] } };
const COVER = { data: { cover: null, minimumWidth: 2400 } };

function respond(cover: { status: string; data?: unknown }) {
  fetchAdminJson.mockImplementation(async (path: string) =>
    path === "home-cover" ? cover : { status: "ok", ...FEATURES },
  );
}

describe("Featured on home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadAdminSession.mockResolvedValue({
      status: "ok",
      data: { role: "editor", capabilities: ["editorial.publish"] },
    });
  });

  it("passes the cover to the editor when it loads", async () => {
    respond({ status: "ok", ...COVER });
    render(await FeaturedOnHomePage());
    expect(screen.getByTestId("editor").dataset.cover).toBe("some");
  });

  it.each(["not_found", "failed", "forbidden"])(
    "still renders the features editor when the cover read is %s",
    async (status) => {
      respond({ status });
      render(await FeaturedOnHomePage());
      expect(screen.getByTestId("editor").dataset.cover).toBe("none");
      expect(screen.queryByText("This page did not load")).toBeNull();
    },
  );

  it("still redirects to sign in when the cover read is unauthorized", async () => {
    respond({ status: "unauthorized" });
    await expect(FeaturedOnHomePage()).rejects.toThrow("redirect:/login");
  });

  it("fails the page when the features themselves cannot be read", async () => {
    fetchAdminJson.mockImplementation(async (path: string) =>
      path === "home-cover" ? { status: "ok", ...COVER } : { status: "failed" },
    );
    render(await FeaturedOnHomePage());
    expect(screen.queryByTestId("editor")).toBeNull();
  });
});
