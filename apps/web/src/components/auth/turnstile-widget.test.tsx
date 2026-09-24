import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { TURNSTILE_LOAD_ERROR_MESSAGE } from "@/lib/auth/turnstile-after-submit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady?: () => void }) => (
    <button type="button" data-testid="load-script" onClick={onReady}>
      load
    </button>
  ),
}));

describe("TurnstileWidget", () => {
  const reset = vi.fn();
  const remove = vi.fn();
  const renderWidget = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    renderWidget.mockReturnValue("widget-id");
    window.turnstile = {
      render: renderWidget,
      reset,
      remove,
    };
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "turnstile");
  });

  it("renders after Script onReady, including when the script was already cached", async () => {
    render(<TurnstileWidget siteKey="site-key" onToken={vi.fn()} />);

    fireEvent.click(screen.getByTestId("load-script"));

    await waitFor(() => {
      expect(renderWidget).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ sitekey: "site-key" }),
      );
    });
  });

  it("shows widget errors, clears them after recovery, and exposes reset", async () => {
    const onToken = vi.fn();
    const onError = vi.fn();
    const onReady = vi.fn();
    render(
      <TurnstileWidget siteKey="site-key" onToken={onToken} onError={onError} onReady={onReady} />,
    );
    fireEvent.click(screen.getByTestId("load-script"));

    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    const options = renderWidget.mock.calls[0]?.[1] as {
      callback: (token: string) => void;
      "error-callback": () => void;
    };

    act(() => options["error-callback"]());
    expect(onError).toHaveBeenCalledOnce();
    expect(screen.getByText(TURNSTILE_LOAD_ERROR_MESSAGE)).toBeVisible();

    act(() => options.callback("fresh-token"));
    expect(onToken).toHaveBeenCalledWith("fresh-token");
    expect(screen.queryByText(TURNSTILE_LOAD_ERROR_MESSAGE)).not.toBeInTheDocument();

    const api = onReady.mock.calls[0]?.[0] as { reset: () => void };
    api.reset();
    expect(reset).toHaveBeenCalledWith("widget-id");
  });
});
