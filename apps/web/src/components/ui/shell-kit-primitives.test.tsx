import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";
import { Surface } from "@auction/ui/components/surface";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("Surface", () => {
  it("applies card variant classes by default", () => {
    const { container } = render(<Surface data-testid="surface">Content</Surface>);
    const el = container.firstElementChild;
    expect(el).toHaveClass("rounded-2xl", "border-border-hairline");
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("merges section variant and padding", () => {
    const { container } = render(
      <Surface variant="section" padding="md" className="extra">
        Section
      </Surface>,
    );
    const el = container.firstElementChild;
    expect(el).toHaveClass("rounded-xl", "p-4", "extra");
  });

  it("applies interactive hover styles when interactive", () => {
    const { container } = render(<Surface interactive>Tap</Surface>);
    expect(container.firstElementChild).toHaveClass("hover:bg-surface-container-high/50");
  });
});

describe("ListRow", () => {
  it("renders static row content", () => {
    render(
      <ListRow
        title="Notifications"
        subtitle="Email and push"
        value="On"
        trailing={<span>›</span>}
      />,
    );
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Email and push")).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();
  });

  it("renders button when onAction is provided", () => {
    const onAction = vi.fn();
    render(<ListRow title="Row" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Row" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("does not call onAction when disabled", () => {
    const onAction = vi.fn();
    render(<ListRow title="Row" onAction={onAction} disabled />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("InsetGroup", () => {
  it("renders label, grouped surface, and footer", () => {
    render(
      <InsetGroup label="Account" footer="Changes sync across devices.">
        <ListRow title="Profile" />
        <ListRow title="Security" />
      </InsetGroup>,
    );
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Changes sync across devices.")).toBeInTheDocument();
  });

  it("wraps children in inset Surface", () => {
    const { container } = render(
      <InsetGroup>
        <ListRow title="Only row" />
      </InsetGroup>,
    );
    const inset = container.querySelector(".rounded-xl.border-border-hairline");
    expect(inset).toBeTruthy();
  });
});
