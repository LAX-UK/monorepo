import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { MyArtistApplication } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import { decideApplyPageView } from "./apply-page.vm";
import {
  EMPTY_ARTIST_APPLICATION_FORM,
  applicationFieldId,
  completedSteps,
  formFromApplication,
  mergeServerWorks,
  saveBodyFromForm,
  stepErrors,
  withSpareLink,
} from "./artist-application-form";
import { checkApplicationImage, isSameOriginRequest } from "./artist-application-upload";
import { createBffArtistApplicationGateway } from "./bff-artist-application.gateway.server";

const NOW = new Date("2026-10-28T12:00:00Z");

const APPLICATION: MyArtistApplication = {
  id: "0b6a7c1e-2f3d-4a5b-8c9d-0e1f2a3b4c5d",
  reference: "LAX-AP-10001",
  status: "draft",
  artistName: "Ada Moreno",
  location: "Lisbon",
  website: null,
  socialLinks: ["https://instagram.com/ada"],
  shortBio: "Painter.",
  statement: null,
  representation: null,
  exhibitions: null,
  consentToContact: false,
  works: [
    {
      mediaKey: "k1",
      imageUrl: "/k1.jpg",
      width: 10,
      height: 10,
      title: "Tide",
      year: 2024,
      medium: null,
      size: null,
      kind: null,
    },
  ],
  messageToArtist: null,
  editable: true,
  blockers: [],
  submittedAt: null,
  decidedAt: null,
  updatedAt: NOW.toISOString(),
  version: 3,
};

const SIGNED_IN: ArtViewerState = {
  kind: "authenticated",
  displayName: "Ada",
  email: "ada@example.com",
  accountHref: "/account",
  logoutHref: "/logout",
};

describe("application form", () => {
  it("fills from a saved application and keeps a spare link box", () => {
    const form = formFromApplication(APPLICATION);
    expect(form.socialLinks).toEqual(["https://instagram.com/ada", ""]);
    expect(form.works[0]).toMatchObject({ title: "Tide", year: "2024", kind: "" });
  });

  it("keeps one empty box after the last link and never moves the one being typed in", () => {
    expect(withSpareLink(["a.example"])).toEqual(["a.example", ""]);
    expect(withSpareLink(["a.example", "", ""])).toEqual(["a.example", ""]);
    expect(withSpareLink(["", "b.example", ""])).toEqual(["", "b.example", ""]);
    expect(withSpareLink(["a", "b", "c", "d"])).toEqual(["a", "b", "c", "d"]);
  });

  it("sends trimmed answers, blank ones as null, and years as numbers", () => {
    const body = saveBodyFromForm(
      {
        ...formFromApplication(APPLICATION),
        location: "  ",
        socialLinks: ["https://instagram.com/ada", ""],
      },
      3,
    );
    expect(body).toMatchObject({
      expectedVersion: 3,
      location: null,
      socialLinks: ["https://instagram.com/ada"],
      works: [{ mediaKey: "k1", year: 2024, kind: null }],
    });
  });

  it("checks a step against the domain's rules, with the field for each message", () => {
    const errors = stepErrors(EMPTY_ARTIST_APPLICATION_FORM, "about", NOW);
    expect(Object.keys(errors)).toEqual(["artistName", "location", "shortBio"]);
    expect(stepErrors(formFromApplication(APPLICATION), "about", NOW)).toEqual({});
  });

  it("refuses a link that is not a web address and a year that is not one", () => {
    const form = {
      ...formFromApplication(APPLICATION),
      website: "not a site",
      works: [{ ...formFromApplication(APPLICATION).works[0], year: "20x4" }] as ReturnType<
        typeof formFromApplication
      >["works"],
    };
    expect(stepErrors(form, "about", NOW).website).toContain("web address");
    expect(stepErrors(form, "work", NOW)["works.0.year"]).toContain("like 2024");
  });

  it("marks a step done only when nothing in it is missing", () => {
    expect(completedSteps(formFromApplication(APPLICATION), NOW)).toEqual(["about"]);
  });

  it("keeps typed answers when the server adds a work", () => {
    const form = { ...formFromApplication(APPLICATION) };
    form.works = [{ ...form.works[0], title: "Typed title" } as (typeof form.works)[number]];
    const merged = mergeServerWorks(form, {
      ...APPLICATION,
      works: [
        ...APPLICATION.works,
        {
          ...APPLICATION.works[0],
          mediaKey: "k2",
          title: null,
        } as MyArtistApplication["works"][number],
      ],
    });
    expect(merged.works.map((work) => work.title)).toEqual(["Typed title", ""]);
  });

  it("gives every field an id the error summary can link to", () => {
    expect(applicationFieldId("works.2.title")).toBe("application-works-2-title");
  });
});

describe("apply page", () => {
  const base = { justSent: false, returnPath: "/for-artists/apply" };

  it("asks a visitor to sign in and come back", () => {
    const view = decideApplyPageView({
      ...base,
      viewer: { kind: "guest", loginHref: "/login", registerHref: "/register" },
      state: null,
    });
    expect(view).toEqual({
      kind: "sign_in",
      loginHref: "/login?returnTo=%2Ffor-artists%2Fapply",
      registerHref: "/register?returnTo=%2Ffor-artists%2Fapply",
    });
  });

  it("shows the form for a first application and for a draft", () => {
    expect(
      decideApplyPageView({
        ...base,
        viewer: SIGNED_IN,
        state: { kind: "ok", value: { application: null, next: "start", availableFrom: null } },
      }).kind,
    ).toBe("form");
    expect(
      decideApplyPageView({
        ...base,
        viewer: SIGNED_IN,
        state: {
          kind: "ok",
          value: { application: APPLICATION, next: "continue", availableFrom: null },
        },
      }),
    ).toMatchObject({ kind: "form", application: APPLICATION, question: null });
  });

  it("puts the gallery's question above the form", () => {
    const asked = {
      ...APPLICATION,
      status: "more_info_needed" as const,
      messageToArtist: "Frame sizes?",
    };
    expect(
      decideApplyPageView({
        ...base,
        viewer: SIGNED_IN,
        state: { kind: "ok", value: { application: asked, next: "continue", availableFrom: null } },
      }),
    ).toMatchObject({ kind: "form", question: "Frame sizes?" });
  });

  it("confirms once after sending, then shows where it stands", () => {
    const sent = { ...APPLICATION, status: "submitted" as const, editable: false };
    const state = {
      kind: "ok" as const,
      value: { application: sent, next: "continue" as const, availableFrom: null },
    };
    expect(decideApplyPageView({ ...base, justSent: true, viewer: SIGNED_IN, state }).kind).toBe(
      "sent",
    );
    expect(decideApplyPageView({ ...base, viewer: SIGNED_IN, state }).kind).toBe("status");
  });

  it("explains a decline with the date to apply again, and opens a new form once it passes", () => {
    const declined = { ...APPLICATION, status: "declined" as const, editable: false };
    expect(
      decideApplyPageView({
        ...base,
        viewer: SIGNED_IN,
        state: {
          kind: "ok",
          value: { application: declined, next: "wait", availableFrom: "2027-04-28T12:00:00.000Z" },
        },
      }),
    ).toMatchObject({ kind: "declined", availableFrom: "2027-04-28T12:00:00.000Z" });
    expect(
      decideApplyPageView({
        ...base,
        viewer: SIGNED_IN,
        state: { kind: "ok", value: { application: declined, next: "start", availableFrom: null } },
      }),
    ).toMatchObject({ kind: "form", application: null, previous: declined });
  });

  it("says when the application could not be read", () => {
    expect(
      decideApplyPageView({ ...base, viewer: SIGNED_IN, state: { kind: "unavailable" } }).kind,
    ).toBe("unavailable");
  });
});

describe("uploads", () => {
  it("checks type and size before sending", () => {
    expect(checkApplicationImage({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toEqual({
      ok: true,
    });
    expect(checkApplicationImage({ name: "a.gif", type: "image/gif", size: 1000 })).toMatchObject({
      ok: false,
    });
    expect(
      checkApplicationImage({ name: "big.png", type: "image/png", size: 11 * 1024 * 1024 }),
    ).toMatchObject({ ok: false, message: expect.stringContaining("10 MB") });
  });

  it("accepts uploads from lax.art only", () => {
    const headers = (origin: string | null) => ({ get: () => origin });
    expect(isSameOriginRequest(headers("https://www.thelax.art"), "www.thelax.art")).toBe(true);
    expect(isSameOriginRequest(headers("https://evil.example"), "www.thelax.art")).toBe(false);
    expect(isSameOriginRequest(headers(null), "www.thelax.art")).toBe(false);
  });
});

describe("application gateway", () => {
  const ok = (body: unknown) => ({ kind: "response" as const, status: 200, body });

  it("signs an upload, stores the bytes and confirms the image", async () => {
    const mutate = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          key: "shop/artist-application/1.jpg",
          uploadUrl: "https://store/1",
          requiredHeaders: {},
        }),
      )
      .mockResolvedValueOnce(ok(APPLICATION));
    const putObject = vi.fn(async () => new Response(null, { status: 200 }));
    const gateway = createBffArtistApplicationGateway({
      read: vi.fn(),
      mutation: { mutate },
      putObject,
    });
    const result = await gateway.uploadImage(APPLICATION.id, {
      bytes: new ArrayBuffer(4),
      contentType: "image/jpeg",
    });
    expect(result.kind).toBe("ok");
    expect(putObject).toHaveBeenCalledWith(
      "https://store/1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mutate).toHaveBeenLastCalledWith(
      `/commerce/me/artist-application/${APPLICATION.id}/images/confirm`,
      { method: "POST", body: { key: "shop/artist-application/1.jpg" } },
    );
  });

  it("reads a signed-out answer and a refusal", async () => {
    const gateway = createBffArtistApplicationGateway({
      read: vi.fn(async () => Response.json({ error: "sign_in_required" }, { status: 401 })),
      mutation: {
        mutate: vi.fn(async () => ({
          kind: "response" as const,
          status: 409,
          body: { message: "This application has been sent and can no longer be changed" },
        })),
      },
    });
    expect((await gateway.readState()).kind).toBe("signed_out");
    expect(await gateway.start()).toMatchObject({ kind: "refused", status: 409 });
  });
});
