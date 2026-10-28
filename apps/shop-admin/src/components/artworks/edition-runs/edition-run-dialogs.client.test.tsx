// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addOpenEditionStock = vi.fn();
const createProofListing = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/server/application/edition-run-actions.server", () => ({
  addOpenEditionStock,
  createProofListing,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
}));
// Radix dialogs and radios run focus and layout loops jsdom cannot settle; these keep their
// open, choose and check contracts so the dialogs' own behaviour is what is tested.
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@auction/ui/components/radio-group", async () => {
  const { createContext, useContext } = await import("react");
  const Group = createContext<{
    value?: string | undefined;
    onValueChange?: ((value: string) => void) | undefined;
  }>({});
  return {
    RadioGroup: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => <Group.Provider value={{ value, onValueChange }}>{children}</Group.Provider>,
    RadioGroupItem: function Item({
      id,
      value,
      disabled,
    }: {
      id?: string;
      value: string;
      disabled?: boolean;
    }) {
      const group = useContext(Group);
      return (
        <input
          type="radio"
          id={id}
          disabled={disabled}
          checked={group.value === value}
          onChange={() => group.onValueChange?.(value)}
        />
      );
    },
  };
});
vi.mock("@auction/ui/components/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      id={id}
      checked={checked === true}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

const { AddPrintsDialog } = await import("./add-prints-dialog.client");
const { ProofListingDialog } = await import("./proof-listing-dialog.client");

const ARTWORK = "11111111-1111-4111-8111-111111111111";

function typeInto(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("Add prints", () => {
  beforeEach(() => {
    addOpenEditionStock.mockReset();
    toastSuccess.mockReset();
  });
  afterEach(cleanup);

  function open() {
    const onAdded = vi.fn();
    render(
      <AddPrintsDialog
        open
        onOpenChange={() => undefined}
        artworkId={ARTWORK}
        defaultArtistPct={50}
        nextStockRef={41}
        onAdded={onAdded}
      />,
    );
    return onAdded;
  }

  it("proposes the default split and says which stock references it creates", () => {
    open();
    expect(screen.getByLabelText("How many")).toHaveValue("10");
    expect(screen.getByLabelText("Artist")).toHaveValue("5");
    expect(screen.getByLabelText("LAX")).toHaveValue("5");
    expect(screen.getByText(/Creates OE-0041 to OE-0050/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 10 prints" })).toBeInTheDocument();
  });

  it("asks where printed stock is kept before adding it", () => {
    open();
    fireEvent.click(screen.getByLabelText("Already printed"));
    fireEvent.click(screen.getByRole("button", { name: "Add 10 prints" }));
    expect(screen.getByText("Say where the printed stock is stored")).toBeInTheDocument();
    expect(addOpenEditionStock).not.toHaveBeenCalled();
  });

  it("adds the batch with the split staff changed", async () => {
    addOpenEditionStock.mockResolvedValue({
      ok: true,
      data: { batchId: "b", firstStockRef: 41, quantity: 10, laxPrintsOnSale: 2 },
    });
    const onAdded = open();
    typeInto("Artist", "8");
    typeInto("LAX", "2");
    fireEvent.click(screen.getByLabelText("Already printed"));
    typeInto(/Storage/, "Plan chest C, drawer 1");
    fireEvent.click(screen.getByRole("button", { name: "Add 10 prints" }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(addOpenEditionStock.mock.calls[0]?.[0].body).toEqual({
      artistCount: 8,
      laxCount: 2,
      custody: "stored",
      storageLocation: "Plan chest C, drawer 1",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Added 10 prints. 2 of LAX's on sale now.");
  });
});

describe("Create proof listing", () => {
  beforeEach(() => {
    createProofListing.mockReset();
    push.mockReset();
  });
  afterEach(cleanup);

  function open(permissions = { setPrice: true, approveHorsCommerce: false }) {
    render(
      <ProofListingDialog
        open
        onOpenChange={() => undefined}
        artworkId={ARTWORK}
        title="Harbour at dusk"
        available={{ ap: 3, pp: 0, hc: 1 }}
        permissions={permissions}
      />,
    );
  }

  it("offers only the proofs kept, and hors commerce only to a shop admin", () => {
    open();
    const group = screen.getByRole("group", { name: "Proofs" });
    expect(within(group).getByLabelText(/^Artist's proof/)).not.toBeDisabled();
    expect(within(group).getByLabelText(/^Printer's proof/)).toBeDisabled();
    expect(within(group).getByLabelText(/^Hors commerce/)).toBeDisabled();
    expect(group.textContent).toContain("Needs a shop admin's approval");
  });

  it("lists the artist's proofs owned by the artist, then opens the new draft", async () => {
    createProofListing.mockResolvedValue({
      ok: true,
      data: { artworkId: "22222222-2222-4222-8222-222222222222", slug: "x", version: "v" },
    });
    open();
    fireEvent.click(screen.getByLabelText(/^Artist's proof/));
    expect(screen.getByLabelText("How many to list")).toHaveValue("3");
    expect(screen.getByLabelText("The artist")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Create proof listing" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/artworks/22222222-2222-4222-8222-222222222222"),
    );
    expect(createProofListing.mock.calls[0]?.[0].body).toEqual({
      proofType: "ap",
      count: 3,
      owner: "artist",
    });
  });

  it("needs a shop admin's approval for hors commerce proofs", () => {
    open({ setPrice: false, approveHorsCommerce: true });
    fireEvent.click(screen.getByLabelText(/^Hors commerce/));
    expect(screen.getByLabelText("LAX")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Create proof listing" }));
    expect(
      screen.getByText("Approve listing a hors commerce proof, or choose another type"),
    ).toBeInTheDocument();
    expect(createProofListing).not.toHaveBeenCalled();
  });
});
