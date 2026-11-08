// @vitest-environment jsdom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const turnOnFollowEmailsAction = vi.fn();
const followEmailsStateAction = vi.fn();
vi.mock("@/lib/favorites/art-favorites-actions.server", () => ({
  followArtist: vi.fn(async () => ({ ok: true, active: true })),
  unfollowArtist: vi.fn(async () => ({ ok: true, active: false })),
  turnOnFollowEmailsAction,
  followEmailsStateAction,
}));

const { ArtArtistFollowControl } = await import("./art-artist-follow-control.client");

const auth = { signedIn: true, loginHref: "/sign-in" };
let host: HTMLDivElement;
let root: Root;

async function render(props: {
  following: boolean;
  emailsOn: boolean | null;
  stopped?: boolean;
}) {
  await act(async () => {
    root.render(
      <ArtArtistFollowControl
        slug="iris-calder"
        name="Iris Calder"
        initialFollowing={props.following}
        initialEmailsOn={props.emailsOn}
        initialStopped={props.stopped ?? false}
        auth={auth}
        manageHref="https://account.test/account/alerts"
      />,
    );
  });
}

const caption = () => host.querySelector('[data-testid="art-artist-follow-emails"]');
const click = async (el: Element | null) => {
  await act(async () => {
    (el as HTMLElement).click();
  });
};

describe("artist Follow with emails", () => {
  beforeEach(() => {
    turnOnFollowEmailsAction.mockReset();
    followEmailsStateAction.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("says nothing about email until the person follows", async () => {
    await render({ following: false, emailsOn: true });
    expect(caption()).toBeNull();
  });

  it("tells a follower emails arrive and where to manage them, without unfollowing", async () => {
    await render({ following: true, emailsOn: true });
    expect(caption()?.textContent).toContain("You follow Iris Calder. We'll email you");
    const manage = caption()?.querySelector("a");
    expect(manage?.textContent).toBe("Manage");
    expect(manage?.getAttribute("href")).toBe("https://account.test/account/alerts");
  });

  it("says nothing when it cannot tell whether emails are on", async () => {
    await render({ following: true, emailsOn: null });
    expect(caption()).toBeNull();
  });

  it("offers to turn emails back on when they are off, and shows the result", async () => {
    turnOnFollowEmailsAction.mockResolvedValue({ ok: true });
    await render({ following: true, emailsOn: false });
    expect(caption()?.textContent).toContain("Emails about followed artists are off.");
    await click(caption()?.querySelector("button") ?? null);
    expect(turnOnFollowEmailsAction).toHaveBeenCalledTimes(1);
    expect(caption()?.textContent).toContain("We'll email you when new works arrive");
  });

  it("keeps emails off and says why when they cannot be turned on", async () => {
    turnOnFollowEmailsAction.mockResolvedValue({
      ok: false,
      message: "Verify your email address in LAX Account to get these emails.",
    });
    await render({ following: true, emailsOn: false });
    await click(caption()?.querySelector("button") ?? null);
    expect(caption()?.querySelector('[role="alert"]')?.textContent).toContain("Verify your email");
    expect(caption()?.textContent).toContain("Emails about followed artists are off.");
  });

  it("says the person stopped all alerts, and points to where to turn them back on", async () => {
    followEmailsStateAction.mockResolvedValue({ on: false, stopped: true });
    await render({ following: false, emailsOn: null });
    await click(host.querySelector('[data-testid="art-artist-follow"]'));
    expect(caption()?.textContent).toContain(
      "You stopped all alerts, so we won't email you about this artist.",
    );
    expect(caption()?.querySelector("button")).toBeNull();
    const link = caption()?.querySelector("a");
    expect(link?.textContent).toBe("Turn alerts back on in LAX Account");
    expect(link?.getAttribute("href")).toBe("https://account.test/account/alerts");
    expect(turnOnFollowEmailsAction).not.toHaveBeenCalled();
  });

  it("says the person stopped all alerts on page load, before anything is pressed", async () => {
    await render({ following: true, emailsOn: false, stopped: true });
    expect(caption()?.textContent).toContain(
      "You stopped all alerts, so we won't email you about this artist.",
    );
    expect(caption()?.querySelector("button")).toBeNull();
    expect(followEmailsStateAction).not.toHaveBeenCalled();
  });

  it("asks what happened to the emails once the person follows", async () => {
    followEmailsStateAction.mockResolvedValue({ on: true, stopped: false });
    await render({ following: false, emailsOn: null });
    await click(host.querySelector('[data-testid="art-artist-follow"]'));
    expect(followEmailsStateAction).toHaveBeenCalled();
    expect(caption()?.textContent).toContain("You follow Iris Calder");
  });
});
