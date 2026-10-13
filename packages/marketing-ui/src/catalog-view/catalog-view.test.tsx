import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  readMarketingViewParam,
  replaceMarketingViewUrl,
  resetMarketingViewClientState,
} from "./catalog-view-url-store.js";
import { buildViewHref, resolveCatalogLayoutView, viewCookieName } from "./catalog-view.js";
import { MarketingCatalogView } from "./marketing-catalog-view.js";

afterEach(() => {
  resetMarketingViewClientState();
  window.history.replaceState({}, "", "/");
});

describe("resolveCatalogLayoutView", () => {
  const modes = ["grid", "list"] as const;

  it("prefers the URL, then the cookie, then the fallback", () => {
    expect(
      resolveCatalogLayoutView({ urlView: "list", cookieRaw: "grid", modes, fallback: "grid" }),
    ).toBe("list");
    expect(
      resolveCatalogLayoutView({ urlView: null, cookieRaw: "list", modes, fallback: "grid" }),
    ).toBe("list");
    expect(
      resolveCatalogLayoutView({ urlView: undefined, cookieRaw: null, modes, fallback: "grid" }),
    ).toBe("grid");
  });

  it("ignores values the surface does not support", () => {
    expect(
      resolveCatalogLayoutView({ urlView: "card", cookieRaw: "nonsense", modes, fallback: "grid" }),
    ).toBe("grid");
  });

  it("scopes cookies per route", () => {
    expect(viewCookieName("artworks")).toBe("lax_view_artworks");
  });
});

describe("buildViewHref", () => {
  it("keeps cursor pagination when the surface opts out of clearing", () => {
    expect(
      buildViewHref("/artworks", "cursor=abc&q=oil", "list", {
        defaultView: "grid",
        clearParams: [],
      }),
    ).toBe("/artworks?cursor=abc&q=oil&view=list");
  });
});

describe("view URL store", () => {
  it("does not leak a client-chosen view into another pathname", () => {
    window.history.replaceState({}, "", "/artworks");
    replaceMarketingViewUrl("/artworks?view=list", "list");
    expect(readMarketingViewParam("grid", "grid")).toBe("list");

    window.history.pushState({}, "", "/categories/painting");
    expect(readMarketingViewParam("grid", "grid")).toBe("grid");
  });
});

describe("MarketingCatalogView", () => {
  it("mounts only the active layout and follows client view changes", () => {
    window.history.replaceState({}, "", "/artworks");
    render(
      <MarketingCatalogView value="grid" grid={<p>grid layout</p>} list={<p>list layout</p>} />,
    );
    expect(screen.getByText("grid layout")).toBeInTheDocument();
    expect(screen.queryByText("list layout")).toBeNull();

    act(() => replaceMarketingViewUrl("/artworks?view=list", "list"));
    expect(screen.getByText("list layout")).toBeInTheDocument();
    expect(screen.queryByText("grid layout")).toBeNull();
  });
});
