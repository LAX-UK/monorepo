// @vitest-environment jsdom
import type { FramingOption } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createFramingOption = vi.fn();
const saveFramingOption = vi.fn();
const setFramingOptionOffered = vi.fn();

vi.mock("@/server/application/framing-actions.server", () => ({
  createFramingOption,
  saveFramingOption,
  setFramingOptionOffered,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/framing",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { FramingCatalogue } = await import("./framing-catalogue.client");
const { FramingOptionDialog } = await import("./framing-option-dialog.client");

const base: Omit<FramingOption, "id" | "code" | "name" | "status" | "pricesPlaceholder"> = {
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 10,
  leadTimeMaxDays: 15,
  pricesPence: { up_to_40x50: 14000, up_to_60x80: 22500, up_to_80x100: 29500 },
  editionCount: 0,
  version: "2026-11-01T09:00:00.000Z",
};

const draft: FramingOption = {
  ...base,
  id: "00000000-0000-4000-8000-0000000000a1",
  code: "natural-oak",
  name: "Natural oak frame",
  status: "draft",
  pricesPlaceholder: true,
};
const active: FramingOption = {
  ...base,
  id: "00000000-0000-4000-8000-0000000000a2",
  code: "black-wood",
  name: "Black wood frame",
  frame: "black_wood",
  status: "active",
  pricesPlaceholder: false,
  editionCount: 3,
  pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
};
const paused: FramingOption = {
  ...active,
  id: "00000000-0000-4000-8000-0000000000a3",
  code: "white-wood",
  name: "White wood frame",
  status: "paused",
  editionCount: 0,
};

const saved = { ok: true, data: active };

/** The table and the phone list are both in the document without CSS; the first is the table's. */
const rowActions = (name: string) =>
  screen.getAllByRole("button", { name: `Actions for ${name}` })[0] as HTMLElement;

beforeEach(() => {
  for (const action of [createFramingOption, saveFramingOption, setFramingOptionOffered]) {
    action.mockReset();
    action.mockResolvedValue(saved);
  }
});

describe("the framing catalogue", () => {
  it("lists each option with its details, lead time, prices and status", () => {
    render(<FramingCatalogue options={[draft, active, paused]} canEdit />);
    const table = screen.getByRole("grid", { name: "Framing options" });
    const oak = within(table).getByRole("row", { name: /Natural oak frame/ });
    expect(oak).toHaveTextContent("Window mount, white conservation board · UV-filtering acrylic");
    expect(oak).toHaveTextContent("10 to 15 working days");
    expect(oak).toHaveTextContent("£140.00");
    expect(oak).toHaveTextContent("£225.00");
    expect(oak).toHaveTextContent("£295.00");
    expect(oak).toHaveTextContent("Draft");
    expect(within(table).getByRole("row", { name: /Black wood frame/ })).toHaveTextContent(
      "Offered",
    );
    expect(within(table).getByRole("row", { name: /Black wood frame/ })).toHaveTextContent(
      "3 editions",
    );
    expect(within(table).getByRole("row", { name: /White wood frame/ })).toHaveTextContent(
      "Paused",
    );
  });

  it("says when prices are still placeholders, and how many options", () => {
    render(<FramingCatalogue options={[draft, active]} canEdit />);
    const notice = screen.getByRole("status", { name: "Placeholder prices" });
    expect(notice).toHaveTextContent("One option still has placeholder prices.");
    expect(notice).toHaveTextContent("before any edition offers framing in production");
  });

  it("shows no notice once every price is real", () => {
    render(<FramingCatalogue options={[active, paused]} canEdit />);
    expect(screen.queryByText("Placeholder prices")).not.toBeInTheDocument();
  });

  it("invites staff to add the first option", () => {
    render(<FramingCatalogue options={[]} canEdit />);
    expect(screen.getByText("No framing options yet")).toBeInTheDocument();
    const adds = screen.getAllByRole("button", { name: "New framing option" });
    expect(adds.length).toBeGreaterThan(0);
  });

  it("gives staff who cannot edit the list alone, marked view only", () => {
    render(<FramingCatalogue options={[draft, active]} canEdit={false} viewOnlyRole="Read-only" />);
    expect(screen.queryByRole("button", { name: "New framing option" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    expect(screen.getByText(/View only/i)).toBeInTheDocument();
    expect(screen.getAllByText("Natural oak frame").length).toBeGreaterThan(0);
  });

  it("opens the add form from the page header", async () => {
    render(<FramingCatalogue options={[active]} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "New framing option" }));
    expect(await screen.findByRole("dialog", { name: "New framing option" })).toBeInTheDocument();
  });

  it("confirms before pausing, with the number of editions that offer the option", async () => {
    render(<FramingCatalogue options={[active]} canEdit />);
    fireEvent.click(rowActions("Black wood frame"));
    fireEvent.click(
      (await screen.findAllByRole("menuitem", { name: /Pause option/ }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog", { name: "Pause Black wood frame?" });
    expect(dialog).toHaveTextContent("3 editions offer it. Shoppers stop seeing it at once.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Pause option" }));

    await waitFor(() => expect(setFramingOptionOffered).toHaveBeenCalledTimes(1));
    expect(setFramingOptionOffered).toHaveBeenCalledWith({
      optionId: active.id,
      offered: false,
      expectedVersion: active.version,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("offers a paused option again after asking", async () => {
    render(<FramingCatalogue options={[paused]} canEdit />);
    fireEvent.click(rowActions("White wood frame"));
    fireEvent.click(
      (await screen.findAllByRole("menuitem", { name: /Offer option/ }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog", { name: "Offer White wood frame?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Offer option" }));
    await waitFor(() =>
      expect(setFramingOptionOffered).toHaveBeenCalledWith(
        expect.objectContaining({ optionId: paused.id, offered: true }),
      ),
    );
  });

  it("will not offer an option whose prices are placeholders, and says why", async () => {
    render(<FramingCatalogue options={[draft]} canEdit />);
    fireEvent.click(rowActions("Natural oak frame"));
    const offer = (
      await screen.findAllByRole("menuitem", { name: /Offer option/ })
    )[0] as HTMLElement;
    expect(offer).toHaveAttribute("aria-disabled", "true");
    expect(offer).toHaveTextContent("Replace the placeholder prices first");
  });
});

describe("the framing option form", () => {
  const renderDialog = (option: FramingOption | null) => {
    const onClose = vi.fn();
    render(<FramingOptionDialog option={option} onClose={onClose} />);
    return {
      onClose,
      dialog: screen.getByRole("dialog", {
        name: option ? `Edit ${option.name}` : "New framing option",
      }),
    };
  };

  it("names everything to fix in a summary and against each field, and sends nothing", async () => {
    const { dialog } = renderDialog(null);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add option" }));

    const summary = await within(dialog).findByRole("alert");
    expect(summary).toHaveTextContent("Enter the name shoppers see");
    expect(summary).toHaveTextContent("Enter the shortest lead time");
    expect(summary).toHaveTextContent("Enter a price for up to 40 × 50 cm");
    expect(summary).toHaveTextContent("Enter a price for up to 80 × 100 cm");
    expect(within(dialog).getAllByText("Enter the name shoppers see")).toHaveLength(2);
    expect(createFramingOption).not.toHaveBeenCalled();
  });

  it("sends a new option with whole pence and the days as numbers", async () => {
    const { dialog, onClose } = renderDialog(null);
    fireEvent.change(within(dialog).getByLabelText("Name shoppers see"), {
      target: { value: "Walnut frame" },
    });
    fireEvent.change(within(dialog).getByLabelText("Shortest"), { target: { value: "15" } });
    fireEvent.change(within(dialog).getByLabelText("Longest"), { target: { value: "20" } });
    fireEvent.change(within(dialog).getByLabelText("Up to 40 × 50 cm"), {
      target: { value: "160" },
    });
    fireEvent.change(within(dialog).getByLabelText("Up to 60 × 80 cm"), {
      target: { value: "250.50" },
    });
    fireEvent.change(within(dialog).getByLabelText("Up to 80 × 100 cm"), {
      target: { value: "£325" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add option" }));

    await waitFor(() => expect(createFramingOption).toHaveBeenCalledTimes(1));
    expect(createFramingOption).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        name: "Walnut frame",
        leadTimeMinDays: 15,
        leadTimeMaxDays: 20,
        pricesPence: { up_to_40x50: 16000, up_to_60x80: 25050, up_to_80x100: 32500 },
        offered: false,
      }),
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps Offered off while the prices are still placeholders, and says so", () => {
    const { dialog } = renderDialog(draft);
    expect(within(dialog).getByText("Placeholder prices")).toBeInTheDocument();
    const offered = within(dialog).getByRole("checkbox", { name: /Offered/ });
    expect(offered).toBeDisabled();
    expect(
      within(dialog).getByText("Enter the framer's prices to offer this option."),
    ).toBeInTheDocument();
  });

  it("allows Offered once a price has been replaced, and saves from the version it opened", async () => {
    const { dialog } = renderDialog(draft);
    fireEvent.change(within(dialog).getByLabelText("Up to 60 × 80 cm"), {
      target: { value: "210" },
    });
    expect(within(dialog).queryByText("Placeholder prices")).not.toBeInTheDocument();
    const offered = within(dialog).getByRole("checkbox", { name: /Offered/ });
    expect(offered).toBeEnabled();
    fireEvent.click(offered);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save option" }));

    await waitFor(() => expect(saveFramingOption).toHaveBeenCalledTimes(1));
    expect(saveFramingOption).toHaveBeenCalledWith({
      optionId: draft.id,
      payload: expect.objectContaining({
        offered: true,
        pricesPence: { up_to_40x50: 14000, up_to_60x80: 21000, up_to_80x100: 29500 },
      }),
      expectedVersion: draft.version,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("stays open and says so when someone else saved first", async () => {
    saveFramingOption.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This framing option was changed by someone else since it was opened",
    });
    const { dialog, onClose } = renderDialog(active);
    fireEvent.change(within(dialog).getByLabelText("Name shoppers see"), {
      target: { value: "Black frame" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save option" }));
    expect(
      await within(dialog).findByText(/changed by someone else since it was opened/),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("rechecks a field as soon as it is fixed after a first attempt", async () => {
    const { dialog } = renderDialog(null);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add option" }));
    await within(dialog).findByRole("alert");
    fireEvent.change(within(dialog).getByLabelText("Name shoppers see"), {
      target: { value: "Walnut frame" },
    });
    await waitFor(() =>
      expect(within(dialog).queryByText("Enter the name shoppers see")).not.toBeInTheDocument(),
    );
    expect(within(dialog).getAllByText(/Enter the shortest lead time/).length).toBeGreaterThan(0);
  });
});
