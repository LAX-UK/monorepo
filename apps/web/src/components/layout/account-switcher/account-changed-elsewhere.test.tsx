import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let announce: ((accountId: string) => void) | null = null;
vi.mock("@/lib/legal-entity/account-switch-channel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal-entity/account-switch-channel")>()),
  onAccountSwitch: (listener: (accountId: string) => void) => {
    announce = listener;
    return () => {
      announce = null;
    };
  },
}));

let browserAccount: string | undefined = "org-1";
vi.mock("@/lib/legal-entity/client-acting-context", () => ({
  getClientActingLegalEntityId: () => browserAccount,
}));

import { AccountChangedElsewhere } from "./account-changed-elsewhere";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
}

function noticeCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )lax_account_notice=([^;]*)/);
  return match?.[1] ? decodeURIComponent(decodeURIComponent(match[1])) : null;
}

describe("AccountChangedElsewhere", () => {
  beforeEach(() => {
    refresh.mockClear();
    browserAccount = "org-1";
    setVisibility("visible");
    document.cookie = "lax_account_notice=; path=/; max-age=0";
  });

  afterEach(() => {
    announce = null;
  });

  it("re-renders this tab for the new account and says why, as soon as another tab switches", () => {
    render(<AccountChangedElsewhere renderedAccountId="org-1" />);
    browserAccount = "me";
    act(() => announce?.("me"));
    expect(refresh).toHaveBeenCalledOnce();
    expect(noticeCookie()).toBe(JSON.stringify({ kind: "switched_elsewhere", accountId: "me" }));
  });

  it("waits until the person comes back to a hidden tab", () => {
    render(<AccountChangedElsewhere renderedAccountId="org-1" />);
    setVisibility("hidden");
    browserAccount = "me";
    act(() => announce?.("me"));
    expect(refresh).not.toHaveBeenCalled();
    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does nothing while the browser still uses the account this page shows", () => {
    render(<AccountChangedElsewhere renderedAccountId="org-1" />);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(noticeCookie()).toBeNull();
  });
});
