import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConsentProvider, useConsent } from "./context";
import type { ConsentSnapshot } from "./cookie";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/analytics/consent/actions", () => ({ setConsentAction: vi.fn() }));

const accepted: ConsentSnapshot = {
  v: 1,
  ts: "2026-11-13T12:00:00.000Z",
  necessary: true,
  analytics: true,
  marketing: false,
};

/** Something open on the page: its state is lost if the provider remounts what it wraps. */
function OpenSheet() {
  const [open] = useState(() => ({ id: Math.random() }));
  const { snapshot, showBanner } = useConsent();
  return (
    <p data-testid="sheet" data-instance={open.id}>
      {showBanner ? "banner" : "no banner"} {snapshot?.analytics ? "analytics" : "no analytics"}
    </p>
  );
}

describe("ConsentProvider", () => {
  it("adopts a new choice from the server without remounting the page under it", () => {
    const { rerender } = render(
      <ConsentProvider initialSnapshot={null}>
        <OpenSheet />
      </ConsentProvider>,
    );
    const before = screen.getByTestId("sheet");
    expect(before).toHaveTextContent("banner no analytics");
    const instance = before.dataset.instance;

    rerender(
      <ConsentProvider initialSnapshot={accepted}>
        <OpenSheet />
      </ConsentProvider>,
    );

    const after = screen.getByTestId("sheet");
    expect(after).toHaveTextContent("no banner analytics");
    expect(after.dataset.instance).toBe(instance);
  });

  it("shows the banner again when the server reads no choice", () => {
    const { rerender } = render(
      <ConsentProvider initialSnapshot={accepted}>
        <OpenSheet />
      </ConsentProvider>,
    );
    expect(screen.getByTestId("sheet")).toHaveTextContent("no banner analytics");

    rerender(
      <ConsentProvider initialSnapshot={null}>
        <OpenSheet />
      </ConsentProvider>,
    );
    expect(screen.getByTestId("sheet")).toHaveTextContent("banner no analytics");
  });
});
