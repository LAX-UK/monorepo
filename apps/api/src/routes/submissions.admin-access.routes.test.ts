import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createSubmissionRoutes } from "./submissions.js";

const submissionId = "33333333-3333-4333-8333-333333333333";

function mount(staffRole: string | null) {
  const app = new Hono();
  const listSubmissions = vi.fn();
  const startReview = vi.fn();
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireSubmissionsLegalEntityContext: vi.fn((_c, next) => next()),
    submissionRoutes: stubSubmissionRouteServices({
      adminHttp: { listSubmissions, startReview } as never,
    }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "staff-1", role: "staff", staffRole }),
  };
  app.route("/submissions", createSubmissionRoutes(container, authenticator));
  return { app, listSubmissions, startReview };
}

describe("submissions admin access", () => {
  it("GET /submissions returns 403 for staff_viewer", async () => {
    const { app, listSubmissions } = mount("staff_viewer");
    const res = await app.request("http://t/submissions?limit=10&offset=0");
    expect(res.status).toBe(403);
    expect(listSubmissions).not.toHaveBeenCalled();
  });

  it("GET /submissions allows catalogue_manager", async () => {
    const { app, listSubmissions } = mount("catalogue_manager");
    listSubmissions.mockResolvedValue({ status: 200, body: { data: [], total: 0 } });
    const res = await app.request("http://t/submissions?limit=10&offset=0");
    expect(res.status).toBe(200);
    expect(listSubmissions).toHaveBeenCalled();
  });

  it("POST /submissions/:id/review/start returns 403 for staff_viewer", async () => {
    const { app, startReview } = mount("staff_viewer");
    const res = await app.request(`http://t/submissions/${submissionId}/review/start`, {
      method: "POST",
    });
    expect(res.status).toBe(403);
    expect(startReview).not.toHaveBeenCalled();
  });
});
