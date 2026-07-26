import type { ArtistFormValues } from "@/components/admin/artist-form/types";
import { useAdminArtistForm } from "@/components/admin/artist-form/use-admin-artist-form";
import { adminCreateArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/actions/admin", () => ({
  adminCreateArtistResultAction: vi.fn(),
  adminUpdateArtistResultAction: vi.fn(),
}));

vi.mock("@/lib/forms/validate-wizard-step", () => ({
  validateWizardStep: vi.fn(),
}));

vi.mock("@/lib/forms/apply-action-field-errors", () => ({
  applyActionFieldErrors: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const defaultValues: ArtistFormValues = {
  displayName: "Studio Test",
  kind: "artist",
  status: "approved",
  portraitUrl: "",
  heroImageUrl: "",
  shortBio: "",
  longBio: "",
  statement: "",
  nationality: "",
  location: "",
  countryCode: "",
  birthYear: "",
  deathYear: "",
  foundedYear: "",
  dissolvedYear: "",
  websiteUrl: "",
  ownerUserId: null,
  featured: false,
  verified: false,
  archived: false,
  categoryIds: [],
  attributes: {},
};

describe("useAdminArtistForm behavior", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.mocked(validateWizardStep).mockResolvedValue(true);
    vi.mocked(adminCreateArtistResultAction).mockResolvedValue({
      ok: true,
      data: { id: "artist-created" },
    });
    vi.mocked(adminUpdateArtistResultAction).mockResolvedValue({ ok: true, data: undefined });
  });

  it("redirects to artist detail after successful edit save", async () => {
    const { result } = renderHook(() =>
      useAdminArtistForm({
        mode: "edit",
        artistId: "artist-1",
        defaultValues,
      }),
    );

    await result.current.submit();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/admin/artists/artist-1");
    });
    expect(adminUpdateArtistResultAction).toHaveBeenCalledWith(
      "artist-1",
      expect.objectContaining({ displayName: "Studio Test", kind: "artist" }),
    );
  });

  it("redirects to created artist detail after successful create save", async () => {
    const { result } = renderHook(() =>
      useAdminArtistForm({
        mode: "create",
        defaultValues,
      }),
    );

    await result.current.submit();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/admin/artists/artist-created?created=1");
    });
    expect(adminCreateArtistResultAction).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Studio Test", kind: "artist" }),
    );
  });

  it("routes server field errors back to the wizard step", async () => {
    vi.mocked(adminCreateArtistResultAction).mockResolvedValue({
      ok: false,
      error: "Validation failed",
      fieldErrors: { displayName: ["Display name is required"] },
    });

    const { result } = renderHook(() =>
      useAdminArtistForm({
        mode: "create",
        defaultValues,
      }),
    );

    await result.current.submit();

    await waitFor(() => {
      expect(result.current.validationStepIndex).toBe(1);
    });
    expect(result.current.validationBanner).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("skips step validation when the form is read-only", async () => {
    const { result } = renderHook(() =>
      useAdminArtistForm({
        mode: "edit",
        artistId: "artist-1",
        defaultValues,
        readOnly: true,
      }),
    );

    await expect(result.current.handleBeforeNext(0)).resolves.toBe(true);
    expect(validateWizardStep).not.toHaveBeenCalled();
  });
});
