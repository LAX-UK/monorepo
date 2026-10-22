// @vitest-environment jsdom
import type { HelpArticleDetail } from "@/lib/help-forms";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveHelpArticle = vi.fn();
const getHelpArticleDetail = vi.fn();
const setHelpArticlePublication = vi.fn();
const issueHelpPreviewToken = vi.fn();
const replace = vi.fn();

vi.mock("@/server/application/admin-help-actions.server", () => ({
  saveHelpArticle,
  getHelpArticleDetail,
  setHelpArticlePublication,
  issueHelpPreviewToken,
}));
// The shared editor imports the editorial actions for its other entities.
vi.mock("@/server/application/admin-editorial-actions.server", () => ({
  saveEditorialEntity: vi.fn(),
  getEditorialEntityDetail: vi.fn(),
  setEditorialPublication: vi.fn(),
  issueEditorialPreviewToken: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/help/h-1",
}));
vi.mock("@auction/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui")>()),
  toast: { success: vi.fn() },
}));

const { HelpArticleEditor } = await import("./help-article-editor.client");

const OPENED = "2026-03-01T10:00:00.000Z";
const THEIRS = "2026-03-01T11:30:00.000Z";
const NEW_VERSION = "2026-03-01T11:45:00.000Z";
const CATEGORIES = [
  { value: "11111111-1111-4111-8111-111111111111", label: "Buying" },
  { value: "22222222-2222-4222-8222-222222222222", label: "Returns" },
];

const detail: HelpArticleDetail = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "how-do-i-pay",
  question: "How do I pay?",
  categoryId: CATEGORIES[0]?.value ?? "",
  categoryTitle: "Buying",
  position: 0,
  status: "draft",
  updatedAt: OPENED,
  updatedBy: "editor",
  body: [],
  seoTitle: null,
  seoDescription: null,
};

function renderEditor(saved: HelpArticleDetail | null = detail) {
  return render(
    <HelpArticleEditor
      detail={saved}
      categories={CATEGORIES}
      defaultCategoryId={CATEGORIES[1]?.value ?? ""}
      artPublicUrl="https://lax.test"
    />,
  );
}

function editQuestion(value: string) {
  fireEvent.change(screen.getByLabelText(/Question/), { target: { value } });
}

describe("help article editor", () => {
  beforeEach(() => {
    for (const action of [
      saveHelpArticle,
      getHelpArticleDetail,
      setHelpArticlePublication,
      issueHelpPreviewToken,
      replace,
    ]) {
      action.mockReset();
    }
    saveHelpArticle.mockResolvedValue({ ok: true, data: { id: detail.id, version: NEW_VERSION } });
  });

  it("saves the answer as body blocks against the version it opened", async () => {
    renderEditor();
    editQuestion("How do I pay for an artwork?");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(saveHelpArticle).toHaveBeenCalledTimes(1));
    expect(saveHelpArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: detail.id,
        expectedVersion: OPENED,
        payload: expect.objectContaining({
          question: "How do I pay for an artwork?",
          categoryId: detail.categoryId,
          slug: "how-do-i-pay",
          body: [],
        }),
      }),
    );
    expect(await screen.findByText("Saved 11:45")).toBeInTheDocument();
  });

  it("lists the problems and sends nothing when the question is blank", async () => {
    renderEditor();
    editQuestion("");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the question.");
    expect(saveHelpArticle).not.toHaveBeenCalled();
  });

  it("starts a new question in the category the list was filtered to and opens it once created", async () => {
    saveHelpArticle.mockResolvedValue({ ok: true, data: { id: "new-id", version: null } });
    renderEditor(null);
    editQuestion("Do you deliver abroad?");
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "deliver-abroad" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/help/new-id"));
    expect(saveHelpArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: null,
        expectedVersion: null,
        payload: expect.objectContaining({ categoryId: CATEGORIES[1]?.value }),
      }),
    );
  });

  it("offers reload or overwrite when someone else saved first", async () => {
    saveHelpArticle.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "changed",
      currentVersion: THEIRS,
    });
    renderEditor();
    editQuestion("My wording");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByText("Someone else saved this question at 11:30"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep my changes" })).toBeInTheDocument();
  });

  it("asks before publishing and names the question", async () => {
    setHelpArticlePublication.mockResolvedValue({ ok: true, data: { version: NEW_VERSION } });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Publish “How do I pay\?”/)).toBeInTheDocument();
    expect(setHelpArticlePublication).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() =>
      expect(setHelpArticlePublication).toHaveBeenCalledWith(
        expect.objectContaining({ id: detail.id, published: true }),
      ),
    );
  });

  it("creates a preview link for a saved question", async () => {
    issueHelpPreviewToken.mockResolvedValue({
      ok: true,
      data: { token: "abc.def", expiresAt: "2026-03-01T10:15:00.000Z" },
    });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Create preview link" }));
    await waitFor(() =>
      expect(issueHelpPreviewToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: detail.id }),
      ),
    );
    expect(await screen.findByRole("region", { name: "Draft preview link" })).toBeInTheDocument();
  });
});
