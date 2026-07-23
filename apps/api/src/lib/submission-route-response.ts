import type { Context } from "hono";
import type { SubmissionHttpJson } from "../services/interfaces/submission-routes/submission-route-http.js";
import { asHttpStatus } from "./http-status.js";

export function respondSubmissionHttpJson(c: Context, response: SubmissionHttpJson) {
  if (response.status === 204) return c.body(null, 204);
  return c.json(response.body, asHttpStatus(response.status));
}
