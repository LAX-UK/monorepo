/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnnouncerProvider, useAnnounce } from "./announcer";

function Trigger({ message, politeness }: { message: string; politeness?: "assertive" }) {
  const announce = useAnnounce();
  return (
    <button type="button" onClick={() => announce(message, politeness)}>
      go
    </button>
  );
}

describe("AnnouncerProvider", () => {
  it("announces results in the polite region", () => {
    render(
      <AnnouncerProvider>
        <Trigger message="Preferences saved" />
      </AnnouncerProvider>,
    );
    act(() => screen.getByText("go").click());
    expect(screen.getByRole("status")).toHaveTextContent("Preferences saved");
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("keeps the assertive region for failures", () => {
    render(
      <AnnouncerProvider>
        <Trigger message="Could not save" politeness="assertive" />
      </AnnouncerProvider>,
    );
    act(() => screen.getByText("go").click());
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces the same sentence again", () => {
    render(
      <AnnouncerProvider>
        <Trigger message="Saved" />
      </AnnouncerProvider>,
    );
    act(() => screen.getByText("go").click());
    const first = screen.getByRole("status").textContent;
    act(() => screen.getByText("go").click());
    expect(screen.getByRole("status").textContent).not.toBe(first);
  });

  it("does nothing without a provider", () => {
    render(<Trigger message="Saved" />);
    expect(() => act(() => screen.getByText("go").click())).not.toThrow();
  });
});
