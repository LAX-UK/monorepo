import { SaleIdentityStep } from "@/components/admin/sale-form/steps/identity-step";
import { verifyStreamUrlAction } from "@/lib/actions/stream-url-verify";
import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/stream-url-verify", () => ({
  verifyStreamUrlAction: vi.fn(),
}));

vi.mock("@/lib/forms/image/use-upload-gallery", () => ({
  useUploadGallery: () => ({
    items: [],
    uploadFiles: vi.fn(),
    retry: vi.fn(),
  }),
}));

const verifyStreamUrlActionMock = vi.mocked(verifyStreamUrlAction);

function SaleIdentityHarness() {
  const form = useForm<AdminSaleFormValues>({
    defaultValues: {
      ...emptyAdminSaleFormValues(),
      title: "Spring sale",
      coverImages: ["https://cdn.example/cover.jpg"],
    },
  });

  return (
    <FormProvider {...form}>
      <SaleIdentityStep
        form={form}
        categories={[]}
        pending={false}
        previewUrlByKey={{ "https://cdn.example/cover.jpg": "https://cdn.example/cover.jpg" }}
      />
    </FormProvider>
  );
}

describe("SaleIdentityStep", () => {
  beforeEach(() => {
    verifyStreamUrlActionMock.mockReset();
  });

  it("reveals add and manage actions for cover images", () => {
    render(<SaleIdentityHarness />);

    expect(screen.getByRole("button", { name: "Add cover images" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("button", { name: "Move auction cover 1 later" })).toBeInTheDocument();
  });

  it("toggles the conditional homepage hero video URL field", () => {
    render(<SaleIdentityHarness />);

    expect(screen.queryByPlaceholderText(/youtube\.com\/watch/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Video"));
    expect(screen.getByPlaceholderText(/youtube\.com\/watch/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Cover images"));
    expect(screen.queryByPlaceholderText(/youtube\.com\/watch/)).not.toBeInTheDocument();
  });

  it("integrates hero video input with link verification", async () => {
    verifyStreamUrlActionMock.mockResolvedValue({
      ok: true,
      data: {
        status: "verified",
        provider: "youtube",
        title: "Homepage campaign",
      },
    });
    render(<SaleIdentityHarness />);
    fireEvent.click(screen.getByLabelText("Video"));

    const input = screen.getByPlaceholderText(/youtube\.com\/watch/);
    fireEvent.change(input, {
      target: { value: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify link" }));

    await waitFor(() => {
      expect(verifyStreamUrlActionMock).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      );
      expect(screen.getByText('"Homepage campaign"')).toBeInTheDocument();
    });
  });
});
