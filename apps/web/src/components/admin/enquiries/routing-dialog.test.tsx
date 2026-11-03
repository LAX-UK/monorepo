import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSIGNEES } from "./enquiry.fixture";
import { RoutingDialog } from "./routing-dialog";

const save = vi.fn();
const success = vi.fn();

vi.mock("@/lib/actions/admin/admin-enquiries", () => ({
  saveEnquiryRoutingAction: (...args: unknown[]) => save(...args),
  updateEnquiryAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => success(...args), error: vi.fn() },
}));

const rules = [
  { departmentSlug: "paintings", assignedToUserId: "u-sofia" },
  { departmentSlug: null, assignedToUserId: "u-tom" },
];

function renderDialog(patch: { rules?: typeof rules } = {}) {
  const onOpenChange = vi.fn();
  render(
    <RoutingDialog
      open
      onOpenChange={onOpenChange}
      rules={patch.rules ?? rules}
      assignees={ASSIGNEES}
    />,
  );
  return { onOpenChange, dialog: screen.getByRole("dialog", { name: "Enquiry routing" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  save.mockResolvedValue({ ok: true, data: rules });
});

describe("RoutingDialog", () => {
  it("lists each public department and the fallback, with today's specialist", () => {
    const { dialog } = renderDialog();
    expect(within(dialog).getByText("Paintings")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Everything else, including buying privately"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("combobox", { name: "Specialist for Paintings" }),
    ).toHaveTextContent("Sofia Okafor");
  });

  it("says where the enquiries of a department with no specialist go", () => {
    const { dialog } = renderDialog();
    expect(
      within(dialog).getByText(/have no specialist\. Their enquiries go to Tom Reid\./),
    ).toBeInTheDocument();
  });

  it("has nothing to save until something changes", () => {
    const { dialog } = renderDialog();
    expect(within(dialog).getByRole("button", { name: "Save routing" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("saves only the rows with a person, then closes and says so", async () => {
    const { dialog, onOpenChange } = renderDialog();
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Specialist for Paintings" }));
    fireEvent.click(await screen.findByRole("option", { name: "Tom Reid" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save routing" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith([
        { departmentSlug: "paintings", assignedToUserId: "u-tom" },
        { departmentSlug: null, assignedToUserId: "u-tom" },
      ]),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(success).toHaveBeenCalledWith("Routing saved");
  });

  it("keeps the dialog open and says why when saving fails", async () => {
    save.mockResolvedValue({ ok: false, error: "That person can't be given enquiries." });
    const { dialog, onOpenChange } = renderDialog();
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Specialist for Paintings" }));
    fireEvent.click(await screen.findByRole("option", { name: "Tom Reid" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save routing" }));
    expect(await within(dialog).findByText("Routing wasn't saved")).toBeInTheDocument();
    expect(within(dialog).getByText("That person can't be given enquiries.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
