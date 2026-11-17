// @vitest-environment jsdom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actions = vi.hoisted(() => ({
  saveArtworkFavorite: vi.fn(async () => ({ ok: true, active: true })),
  removeArtworkFavorite: vi.fn(async () => ({ ok: true, active: false })),
  followArtist: vi.fn(async () => ({ ok: true, active: true })),
  unfollowArtist: vi.fn(async () => ({ ok: true, active: false })),
}));
vi.mock("@/lib/favorites/art-favorites-actions.server", () => actions);

const { ArtViewerChromeProvider, useArtViewerChrome } = await import("./art-viewer-chrome.client");
const { ArtPageViewerProvider } = await import("./art-page-viewer.client");
const { ArtArtworkFavoriteToggle } = await import(
  "@/components/favorites/art-artwork-favorite-toggle.client"
);
const { ArtArtistFollowButton } = await import(
  "@/components/favorites/art-artist-follow-button.client"
);

const GUEST = { kind: "guest", loginHref: "/login", registerHref: "/register" } as const;
const SIGNED_IN = {
  kind: "authenticated",
  displayName: "Ada Lovelace",
  email: "ada@example.test",
  accountHref: "/account",
  logoutHref: "/logout",
} as const;
const GUEST_AUTH = { signedIn: false, loginHref: "/login?returnTo=%2F" };

let host: HTMLDivElement;
let root: Root;

function AccountName() {
  const { account, replyDot, settled } = useArtViewerChrome();
  return (
    <p data-testid="account" data-settled={settled ? "true" : "false"}>
      {account.kind === "authenticated" ? account.displayName : account.kind}
      {replyDot ? " (reply)" : ""}
    </p>
  );
}

function page() {
  return (
    <ArtViewerChromeProvider guest={GUEST}>
      <AccountName />
      <ArtPageViewerProvider loginHref="/login?returnTo=%2F">
        <ArtArtworkFavoriteToggle
          slug="warm-basket"
          title="Warm basket"
          initialSaved={false}
          auth={GUEST_AUTH}
        />
        <ArtArtistFollowButton
          slug="flora-powers"
          name="Flora Powers"
          initialFollowing={false}
          auth={GUEST_AUTH}
        />
      </ArtPageViewerProvider>
    </ArtViewerChromeProvider>
  );
}

function respond(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (path: string) =>
    path in routes ? Response.json(routes[path]) : new Response(null, { status: 404 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderAndSettle() {
  await act(async () => {
    root.render(page());
  });
  // Let the chrome read, then the favourites read it unlocks, settle.
  for (let i = 0; i < 3; i++) await act(async () => {});
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const heart = () => host.querySelector<HTMLButtonElement>("button[aria-pressed]");
const follow = () => host.querySelector<HTMLButtonElement>('[data-testid="art-artist-follow"]');

describe("prerendered page viewer", () => {
  it("draws a guest, then the signed-in visitor with their saved works and follows", async () => {
    const fetchMock = respond({
      "/api/viewer": { account: SIGNED_IN, replyDot: true },
      "/api/viewer/favourites": {
        savedArtworkSlugs: ["warm-basket"],
        followedArtistSlugs: ["flora-powers"],
      },
    });

    await renderAndSettle();

    expect(host.querySelector('[data-testid="account"]')?.textContent).toBe("Ada Lovelace (reply)");
    expect(heart()?.getAttribute("aria-pressed")).toBe("true");
    expect(heart()?.getAttribute("aria-label")).toBe("Save Warm basket to favourites");
    expect(follow()?.getAttribute("aria-pressed")).toBe("true");
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/viewer",
      "/api/viewer/favourites",
    ]);
  });

  it("keeps a guest as drawn and never reads favourites for them", async () => {
    const fetchMock = respond({ "/api/viewer": { account: GUEST, replyDot: false } });

    await renderAndSettle();

    expect(host.querySelector('[data-testid="account"]')?.textContent).toBe("guest");
    expect(heart()?.getAttribute("aria-pressed")).toBe("false");
    expect(heart()?.getAttribute("aria-label")).toBe("Sign in to save Warm basket");
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(["/api/viewer"]);
  });

  it("is unsettled until the visitor is read, so the account controls can wait", async () => {
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    );
    await act(async () => {
      root.render(page());
    });
    const account = () => host.querySelector('[data-testid="account"]');
    expect(account()?.getAttribute("data-settled")).toBe("false");

    await act(async () => answer(Response.json({ account: SIGNED_IN, replyDot: false })));
    for (let i = 0; i < 3; i++) await act(async () => {});
    expect(account()?.getAttribute("data-settled")).toBe("true");
    expect(account()?.textContent).toBe("Ada Lovelace");
  });

  it("settles as the guest drawing when the visitor cannot be read", async () => {
    respond({});

    await renderAndSettle();

    expect(host.querySelector('[data-testid="account"]')?.getAttribute("data-settled")).toBe(
      "true",
    );
    expect(host.querySelector('[data-testid="account"]')?.textContent).toBe("guest");
    expect(heart()?.getAttribute("aria-pressed")).toBe("false");
  });

  it("asks the server not to redraw the page when a favourite changes", async () => {
    respond({
      "/api/viewer": { account: SIGNED_IN, replyDot: false },
      "/api/viewer/favourites": { savedArtworkSlugs: [], followedArtistSlugs: [] },
    });
    await renderAndSettle();

    await act(async () => {
      heart()?.click();
    });
    await act(async () => {
      follow()?.click();
    });

    expect(actions.saveArtworkFavorite).toHaveBeenCalledWith("warm-basket", { revalidate: false });
    expect(actions.followArtist).toHaveBeenCalledWith("flora-powers", { revalidate: false });
  });
});
