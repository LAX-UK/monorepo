import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TruncatedText } from "./truncated-text.js";

// Radix positions its tooltip on every frame in the test runtime, which takes seconds per test.
// This stand-in keeps the contract under test: the trigger asks to open and the component decides.
vi.mock("@auction/ui/components/tooltip", async () => {
  const React = await import("react");
  const Context = React.createContext<{ open: boolean; ask: (open: boolean) => void }>({
    open: false,
    ask: () => {},
  });
  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) => <Context.Provider value={{ open, ask: onOpenChange }}>{children}</Context.Provider>,
    TooltipTrigger: ({ children }: { children: React.ReactElement<{ onFocus?: () => void }> }) => {
      const { ask } = React.useContext(Context);
      return React.cloneElement(children, { onFocus: () => ask(true) });
    },
    TooltipContent: ({ children }: { children: React.ReactNode }) => {
      const { open } = React.useContext(Context);
      return open ? <div role="tooltip">{children}</div> : null;
    },
  };
});

function setWidths(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => scrollWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => clientWidth,
  });
}

afterEach(() => {
  setWidths(0, 0);
});

function hoverTrigger(text: string | RegExp) {
  const trigger = screen.getByText(text).closest("[data-staff-truncate]") as HTMLElement;
  act(() => {
    fireEvent.focus(trigger);
  });
  return trigger;
}

describe("TruncatedText", () => {
  it("shows the full value in a tooltip when the text is cut short", () => {
    setWidths(400, 120);
    render(<TruncatedText>The Garden at Giverny, morning light</TruncatedText>);
    hoverTrigger("The Garden at Giverny, morning light");
    expect(screen.getByRole("tooltip")).toHaveTextContent("The Garden at Giverny, morning light");
  });

  it("shows no tooltip when the text fits", () => {
    setWidths(80, 120);
    render(<TruncatedText>Short title</TruncatedText>);
    hoverTrigger("Short title");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps the end of an email visible when shortening in the middle", () => {
    render(<TruncatedText mode="middle">collector.name@gmail.com</TruncatedText>);
    expect(screen.getByText("@gmail.com")).toHaveClass("shrink-0");
    expect(screen.getByText("collector.name")).toHaveClass("truncate");
  });
});
