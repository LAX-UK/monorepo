import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/toaster-host", () => ({
  ToasterHost: () => <div data-testid="toaster-host" />,
}));

import { resetToastBridge, runToast } from "@/lib/ui/toast-bridge";
import { Toaster } from "./toaster";

describe("Toaster", () => {
  beforeEach(() => resetToastBridge());

  it("draws nothing, and loads no host, until a toast is raised", () => {
    const { queryByTestId } = render(<Toaster />);
    expect(queryByTestId("toaster-host")).toBeNull();
  });

  it("mounts the host when the first toast is raised", async () => {
    const { queryByTestId } = render(<Toaster />);
    act(() => runToast(() => undefined));
    await waitFor(() => expect(queryByTestId("toaster-host")).not.toBeNull());
  });
});
