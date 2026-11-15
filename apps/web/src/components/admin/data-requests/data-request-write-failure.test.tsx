import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataRequestWriteFailure } from "./data-request-write-failure";
import { failureOf } from "./use-data-request-writes";

describe("DataRequestWriteFailure", () => {
  it("names the person who changed the request under a stale edit", () => {
    render(
      <DataRequestWriteFailure
        failure={{ message: "changed", stale: true, editor: "Daniel Price" }}
        title="The request couldn't be closed"
        onReload={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Daniel Price changed this request while you had it open/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("says someone else when nobody could be named", () => {
    render(
      <DataRequestWriteFailure
        failure={{ message: "changed", stale: true }}
        title="The request couldn't be closed"
        onReload={vi.fn()}
      />,
    );
    expect(screen.getByText(/Someone else changed this request/)).toBeTruthy();
  });

  it("keeps the failure's own sentence for anything but a stale edit", () => {
    render(
      <DataRequestWriteFailure
        failure={{ message: "This request is no longer open.", stale: false }}
        title="The request couldn't be closed"
        onReload={vi.fn()}
      />,
    );
    expect(screen.getByText("This request is no longer open.")).toBeTruthy();
  });
});

describe("failureOf", () => {
  it("carries the editor the server named, only for a stale edit's meta", () => {
    expect(
      failureOf({
        ok: false,
        error: "x",
        errorCode: "stale_version",
        meta: { editor: "Daniel Price" },
      }),
    ).toEqual({ message: "x", stale: true, editor: "Daniel Price" });
    expect(
      failureOf({ ok: false, error: "x", errorCode: "not_open", meta: { editor: 3 } }),
    ).toEqual({ message: "x", stale: false });
  });
});
