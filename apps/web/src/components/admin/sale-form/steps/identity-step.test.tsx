import { SaleIdentityStep } from "@/components/admin/sale-form/steps/identity-step";
import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/forms/image/use-upload-gallery", () => ({
  useUploadGallery: () => ({
    items: [],
    uploadFiles: vi.fn(),
    retry: vi.fn(),
  }),
}));

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

describe("SaleIdentityStep cover images", () => {
  it("reveals add and manage actions for cover images", () => {
    render(<SaleIdentityHarness />);

    expect(screen.getByRole("button", { name: "Add cover images" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("button", { name: "Move auction cover 1 later" })).toBeInTheDocument();
  });
});
