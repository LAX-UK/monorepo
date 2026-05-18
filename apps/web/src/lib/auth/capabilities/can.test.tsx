import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Can } from "./can";
import { ViewerCapabilitiesProvider } from "./viewer-capabilities-context";

describe("Can", () => {
  it("renders children when capability passes", () => {
    render(
      <ViewerCapabilitiesProvider user={{ role: "staff", staffRole: "super_admin", name: "A" }}>
        <Can requirement="platform.admin.full">
          <span>allowed</span>
        </Can>
      </ViewerCapabilitiesProvider>,
    );
    expect(screen.getByText("allowed")).toBeTruthy();
  });
});
