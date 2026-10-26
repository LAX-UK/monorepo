// @vitest-environment jsdom
import type { HelpArticleDetail } from "@/lib/help-forms";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveHelpArticle = vi.fn();
const getHelpArticleDetail = vi.fn();
const setHelpArticlePublication = vi.fn();
const issueHelpPreviewToken = vi.fn();
const replace = vi.fn();
const push = vi.fn();

vi.mock("@/server/application/admin-help-actions.server", () => ({
  saveHelpArticle,
  getHelpArticleDetail,
  setHelpArticlePublication,
  issueHelpPreviewToken,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/help/h-1",
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

/** The form's own primary button, not the header copy of it. */
function formButton(name: string) {
  const form = screen.getByRole("form");
  return within(form).getByRole("button", { name });
}

describe("help article editor", () => {
  beforeEach(() => {
    for (const action of [
      saveHelpArticle,
      getHelpArticleDetail,
      setHelpArticlePublication,
      issueHelpPreviewToken,
      replace,
      push,
    ]) {
      action.mockReset();
    }
    saveHelpArticle.mockResolvedValue({ ok: true, data: { id: detail.id, version: NEW_VERSION } });
  });

  it("saves the answer as body blocks against the version it opened", async () => {
    renderEditor();
    editQuestion("How do I pay for an artwork?");
    fireEvent.click(formButton("Save changes"));
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
    expect(
      await within(screen.getByRole("form")).findByRole("button", { name: "Saved" }),
    ).toBeDisabled();
  });

  it("lists the problems and sends nothing when the question is blank", async () => {
    renderEditor();
    editQuestion("");
    fireEvent.click(formButton("Save changes"));
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Enter the question.");
    expect(saveHelpArticle).not.toHaveBeenCalled();
  });

  it("clears a problem as soon as the field is fixed", async () => {
    renderEditor();
    editQuestion("");
    fireEvent.click(formButton("Save changes"));
    await screen.findByRole("alert");
    editQuestion("How do I pay?!");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("starts a new question in the category the list was filtered to and opens it once created", async () => {
    saveHelpArticle.mockResolvedValue({ ok: true, data: { id: "new-id", version: null } });
    renderEditor(null);
    editQuestion("Do you deliver abroad?");
    fireEvent.click(formButton("Create draft"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/help/new-id"));
    expect(saveHelpArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: null,
        expectedVersion: null,
        payload: expect.objectContaining({
          categoryId: CATEGORIES[1]?.value,
          slug: "do-you-deliver-abroad",
        }),
      }),
    );
  });

  it("stays on the form with the refusal when a save fails", async () => {
    saveHelpArticle.mockResolvedValue({ ok: false, kind: "failed", message: "" });
    renderEditor();
    editQuestion("My wording");
    fireEvent.click(formButton("Save changes"));
    expect(await screen.findByText(/Could not save the question/)).toBeInTheDocument();
    expect(formButton("Save changes")).toBeEnabled();
  });

  it("offers loading theirs or saving over it when someone else saved first", async () => {
    saveHelpArticle.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "changed",
      currentVersion: THEIRS,
    });
    renderEditor();
    editQuestion("My wording");
    fireEvent.click(formButton("Save changes"));
    expect(
      await screen.findByText("Someone else saved this question after you opened it"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load their version" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save mine over it" }));
    await waitFor(() =>
      expect(saveHelpArticle).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedVersion: THEIRS }),
      ),
    );
  });

  it("asks before publishing, names the question and says what changes on lax.art", async () => {
    setHelpArticlePublication.mockResolvedValue({ ok: true, data: { version: NEW_VERSION } });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Publish “How do I pay\?”/)).toBeInTheDocument();
    expect(within(dialog).getByText(/appear in the Help centre on lax\.art/)).toBeInTheDocument();
    expect(setHelpArticlePublication).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish question" }));
    await waitFor(() =>
      expect(setHelpArticlePublication).toHaveBeenCalledWith(
        expect.objectContaining({ id: detail.id, published: true }),
      ),
    );
  });

  it("asks before leaving with unsaved edits", async () => {
    renderEditor();
    editQuestion("Something else");
    fireEvent.click(screen.getByRole("link", { name: "Cancel" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/Discard changes/i);
  });
});
