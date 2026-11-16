/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DeliveryQuoteSent } from "./delivery-quote-sent";

describe("DeliveryQuoteSent", () => {
  afterEach(cleanup);

  it("links to how delivery outside the UK works, as a plain link", () => {
    render(
      <DeliveryQuoteSent orderReference="SH-1" country="FR" holdUntil="2026-11-20T12:00:00Z" />,
    );
    const link = screen.getByRole("link", { name: "How delivery outside the UK works" });
    expect(link.getAttribute("href")).toBe("/help#delivery-outside-uk");
  });
});
