import { PLATFORM_ADMIN_ACCESS } from "@/lib/navigation/staff-nav-access";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Can } from "./can";
import { ViewerCapabilitiesProvider } from "./viewer-capabilities-context";

describe("Can", () => {
  it("renders children when capability passes", () => {
    render(
      <ViewerCapabilitiesProvider user={{ role: "staff", staffRole: "super_admin", name: "A" }}>
        <Can requirement={PLATFORM_ADMIN_ACCESS}>
          <span>allowed</span>
        </Can>
      </ViewerCapabilitiesProvider>,
    );
    expect(screen.getByText("allowed")).toBeTruthy();
  });
});
