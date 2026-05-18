import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities/viewer-capabilities-context";
import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import type { ReactElement } from "react";

const defaultViewer = {
  role: "staff" as const,
  staffRole: "super_admin" as const,
  name: "Test staff",
};

export function renderWithViewer(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(
    <ViewerCapabilitiesProvider user={defaultViewer}>{ui}</ViewerCapabilitiesProvider>,
    options,
  );
}
