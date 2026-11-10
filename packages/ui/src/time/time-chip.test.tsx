// The device is in London for these tests; a visitor elsewhere has chosen their zone.
process.env.TZ = "Europe/London";

import { chosenZoneCookieValue } from "@auction/datetime";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OfficialTime } from "./official-time.js";
import { TimeChip } from "./time-chip.js";
import { ViewerZoneProvider } from "./viewer-zone-context.js";

const CLOSE = "2026-11-12T18:00:00Z";
const LONDON = "Europe/London";

function choose(zone: string | null) {
  document.cookie = "lax_tz=; max-age=0; path=/";
  if (zone) document.cookie = `lax_tz=${encodeURIComponent(chosenZoneCookieValue(zone))}; path=/`;
}

function renderChip(zone: string | null, ui?: ReactNode) {
  choose(zone);
  return render(
    <ViewerZoneProvider initial={null}>
      {ui ?? <TimeChip instant={CLOSE} officialZone={LONDON} />}
    </ViewerZoneProvider>,
  );
}

describe("TimeChip", () => {
  beforeEach(() => choose(null));
  afterEach(() => choose(null));

  it("shows the visitor's time and city on the same day", () => {
    renderChip("Africa/Cairo");
    const chip = screen.getByRole("button");
    expect(chip).toHaveTextContent("20:00 in Cairo");
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(chip.className).not.toContain("bg-lax-info-bg");
  });

  it("names the day and takes the info tint when the day differs", () => {
    renderChip("Australia/Sydney");
    const chip = screen.getByRole("button");
    expect(chip).toHaveTextContent("Fri 13 Nov, 05:00 in Sydney");
    expect(chip.className).toContain("bg-lax-info-bg");
    expect(within(chip).getByText("Fri 13 Nov").tagName).toBe("B");
  });

  it("is named by the full sentence, including the next day", () => {
    renderChip("Australia/Sydney");
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Your time: Friday 13 November at 05:00 in Sydney, the next day. Show details.",
    );
  });

  it("draws nothing for a UK, unknown or placeholder zone", () => {
    for (const zone of ["Europe/London", "Europe/Dublin", null]) {
      const { container, unmount } = renderChip(zone);
      expect(container.querySelector("button")).toBeNull();
      unmount();
    }
  });

  it("is not a live region", () => {
    const { container } = renderChip("Africa/Cairo");
    expect(container.querySelector("[aria-live],[role=status],[role=alert]")).toBeNull();
  });

  it("opens a non-modal panel with both clocks in full and the day in words", () => {
    renderChip("Australia/Sydney");
    const chip = screen.getByRole("button");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("dialog", { name: "Your time" });
    expect(panel).not.toHaveAttribute("aria-modal");
    expect(chip).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveTextContent("Sydney · chosen on this device");
    expect(panel).toHaveTextContent("Fri 13 Nov, 05:00");
    expect(panel).toHaveTextContent("Next day");
    expect(panel).toHaveTextContent("Official sale time · London");
    expect(panel).toHaveTextContent("Thu 12 Nov, 18:00 GMT");
    for (const time of panel.querySelectorAll("time")) {
      expect(time).toHaveAttribute("datetime", "2026-11-12T18:00:00.000Z");
    }
    expect(within(panel).getByRole("button", { name: "Change time zone" })).toBeVisible();
  });

  it("says Previous day west of the sale when the date falls behind", () => {
    renderChip(
      "Pacific/Honolulu",
      <TimeChip instant="2026-11-12T05:00:00Z" officialZone={LONDON} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Previous day");
  });

  it("closes on Escape and returns focus to the chip", () => {
    renderChip("Africa/Cairo");
    const chip = screen.getByRole("button");
    chip.focus();
    fireEvent.click(chip);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Your time" })).toBeNull();
    expect(chip).toHaveFocus();
  });

  it("closes on a press outside without stealing focus", () => {
    renderChip("Africa/Cairo");
    fireEvent.click(screen.getByRole("button"));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Your time" })).toBeNull();
  });

  it("closes when focus tabs out of it", () => {
    const { container } = renderChip("Africa/Cairo");
    const chip = screen.getByRole("button");
    const outside = document.createElement("button");
    document.body.append(outside);
    try {
      fireEvent.click(chip);
      act(() => outside.focus());
      expect(container.querySelector("[role=dialog]")).toBeNull();
    } finally {
      outside.remove();
    }
  });

  it("opens the zone dialog from the panel and saves a chosen zone to the cookie only", async () => {
    renderChip("Africa/Cairo");
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "Change time zone" }));
    const dialog = await screen.findByRole("dialog", { name: "Time zone" });
    expect(dialog).toHaveTextContent("Saved on this device. Sign in to use it in your emails too.");
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search cities" }), {
      target: { value: "Sydney" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Sydney/ }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    expect(decodeURIComponent(document.cookie)).toContain("lax_tz=fixed:Australia/Sydney");
    expect(
      await screen.findByRole("button", { name: /Friday 13 November at 05:00 in Sydney/ }),
    ).toBeVisible();
  });

  it("goes back to the device's own zone from Automatic, storing it plain", async () => {
    renderChip("Africa/Cairo");
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "Change time zone" }));
    const dialog = await screen.findByRole("dialog", { name: "Time zone" });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Automatic/ }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    expect(decodeURIComponent(document.cookie)).toContain("lax_tz=Europe/London");
    expect(decodeURIComponent(document.cookie)).not.toContain("fixed:");
    expect(screen.queryByRole("button", { name: /Your time:/ })).toBeNull();
  });

  it("tells a visitor on a chosen zone where their device is", () => {
    renderChip("Africa/Cairo");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog", { name: "Your time" })).toHaveTextContent(
      "This device is on London time.",
    );
  });

  it("explains an empty search", async () => {
    renderChip("Africa/Cairo");
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "Change time zone" }));
    const dialog = await screen.findByRole("dialog", { name: "Time zone" });
    fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "Abc" } });
    expect(dialog).toHaveTextContent("No city matches “Abc”. Try a nearby large city.");
  });
});

describe("OfficialTime", () => {
  beforeEach(() => choose(null));

  it("keeps the official line unchanged and marks it with its instant", () => {
    renderChip(
      null,
      <OfficialTime instant={CLOSE} officialZone={LONDON} now={new Date("2026-11-10T09:00:00Z")} />,
    );
    const time = screen.getByText("Thu 12 Nov, 18:00 GMT");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", CLOSE);
  });

  it("names the sale's city for screen readers without changing the printed words", () => {
    renderChip(
      null,
      <OfficialTime instant={CLOSE} officialZone="Europe/Paris" now={new Date(CLOSE)} />,
    );
    const time = document.querySelector("time");
    expect(time).toHaveTextContent(/Paris time$/);
    expect(time?.querySelector(".sr-only")).toHaveTextContent("Paris time");
  });

  it("prints the caller's words in place of the moment", () => {
    renderChip(
      "Africa/Cairo",
      <OfficialTime instant={CLOSE} officialZone={LONDON} now={new Date(CLOSE)}>
        Closes Thu 12 Nov, 18:00 GMT
      </OfficialTime>,
    );
    expect(screen.getByText("Closes Thu 12 Nov, 18:00 GMT").tagName).toBe("TIME");
    expect(screen.getByRole("button")).toHaveTextContent("20:00 in Cairo");
  });

  it("leaves the chip's row empty when there is nothing to add, so CSS can hold or drop it", () => {
    const { container } = renderChip(
      "Europe/London",
      <OfficialTime instant={CLOSE} officialZone={LONDON} now={new Date(CLOSE)} />,
    );
    expect(container.querySelector(".tz-chip-slot")).toBeEmptyDOMElement();
  });

  it("leaves the row empty for a visitor on the sale's own clock, whatever London reads", () => {
    // Paris is away from London, so the head script held the row; on a Paris sale nothing fills it.
    document.documentElement.classList.add("tz-away");
    const { container } = renderChip(
      "Europe/Paris",
      <OfficialTime instant={CLOSE} officialZone="Europe/Paris" now={new Date(CLOSE)} />,
    );
    expect(container.querySelector(".tz-chip-slot")).toBeEmptyDOMElement();
    // The page has drawn, so the hold ends and the empty row takes no room.
    expect(document.documentElement).toHaveClass("tz-ready");
    document.documentElement.className = "";
  });

  it("draws the chip in the inline slot variant, not as a separate row", () => {
    const { container } = renderChip(
      "Africa/Cairo",
      <OfficialTime
        instant={CLOSE}
        officialZone={LONDON}
        now={new Date(CLOSE)}
        placement="inline"
      />,
    );
    const slot = container.querySelector(".tz-chip-slot");
    expect(slot).toHaveClass("tz-chip-slot--inline");
    expect(slot?.tagName).toBe("DIV");
  });
});

describe("TimeChip plain", () => {
  beforeEach(() => choose(null));
  afterEach(() => choose(null));

  it("is text with a hidden prefix, no button, border or chevron", () => {
    const { container } = renderChip(
      "Africa/Cairo",
      <TimeChip instant={CLOSE} officialZone={LONDON} variant="plain" />,
    );
    expect(container.querySelector("button")).toBeNull();
    expect(container).toHaveTextContent("Your time: 20:00 in Cairo");
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-11-12T18:00:00.000Z");
    expect(container.querySelector("svg.lucide-chevron-down")).toBeNull();
  });

  it("keeps the named day and the tint when the day differs", () => {
    const { container } = renderChip(
      "Australia/Sydney",
      <TimeChip instant={CLOSE} officialZone={LONDON} variant="plain" />,
    );
    expect(container).toHaveTextContent("Fri 13 Nov, 05:00 in Sydney");
    expect(container.querySelector(".bg-lax-info-bg")).not.toBeNull();
  });

  it("draws nothing for a UK visitor", () => {
    const { container } = renderChip(
      "Europe/London",
      <TimeChip instant={CLOSE} officialZone={LONDON} variant="plain" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
