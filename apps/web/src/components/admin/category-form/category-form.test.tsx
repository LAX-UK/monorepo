import { AdminCategoryForm } from "@/components/admin/category-form";
import type { Category } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, refreshMock, createMock, updateMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => "/admin/categories/new",
}));
vi.mock("@/lib/actions/admin", () => ({
  adminCreateCategoryResultAction: (...args: unknown[]) => createMock(...args),
  adminUpdateCategoryResultAction: (...args: unknown[]) => updateMock(...args),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const categories: Category[] = [
  {
    id: "cat-1",
    name: "Prints",
    slug: "prints",
    parentId: null,
    sortOrder: 0,
    archived: false,
    description: null,
    heroImageKey: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const blank = {
  name: "",
  description: "",
  parentId: null,
  sortOrder: 0,
  archived: false,
  heroImageKey: null,
};

describe("AdminCategoryForm", () => {
  beforeEach(() => {
    for (const fn of [pushMock, refreshMock, createMock, updateMock]) fn.mockReset();
  });

  it("keeps Create category enabled and says the name is missing when submitted empty", async () => {
    render(<AdminCategoryForm mode="create" categories={categories} defaultValues={blank} />);
    const submit = screen.getByRole("button", { name: "Create category" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(screen.getByRole("alert", { name: "There is a problem" })).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Name is required")).toHaveLength(2);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates the category and opens its page", async () => {
    createMock.mockResolvedValue({ ok: true, data: { id: "cat-9" } });
    render(<AdminCategoryForm mode="create" categories={categories} defaultValues={blank} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Etchings" } });
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/categories/cat-9"));
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Etchings" }),
      expect.stringMatching(/^category-create-/),
    );
  });

  it("offers Archived only when editing, and stays on the page after saving", async () => {
    updateMock.mockResolvedValue({ ok: true });
    render(
      <AdminCategoryForm
        mode="edit"
        categoryId="cat-1"
        name="Prints"
        slug="prints"
        categories={categories}
        defaultValues={{ ...blank, name: "Prints" }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Archived/ })).toBeInTheDocument();
    expect(screen.getByText("/prints")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("keeps the form and says why when the save is refused", async () => {
    createMock.mockResolvedValue({ ok: false, error: "A category with that name exists." });
    render(<AdminCategoryForm mode="create" categories={categories} defaultValues={blank} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Prints" } });
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));
    expect(await screen.findByText("A category with that name exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Prints");
  });
});
