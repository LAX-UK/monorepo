import {
  alertSignupSchema,
  alertStopSchema,
  alertTokenSchema,
  alertTopicSwitchSchema,
  bidAlertTopicSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerAlertRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { ALERTS_READ_SCOPE, ALERTS_WRITE_SCOPE } from "../middleware/bid-scope-policy.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const previewQuerySchema = z.object({
  t: z.string().min(1).max(2048),
  kind: z.enum(["confirm", "stop"]),
});

/**
 * LAX Bid's email alerts: visitor sign-up with double opt-in, the confirm and stop links, and a
 * signed-in client's own switches. Nothing here changes state on a GET.
 */
export function createAlertRoutes(
  container: ContainerAlertRoutesSlice,
  authenticator: IAuthenticator,
) {
  // A signed-in client's own browser session, or LAX Account acting as them with its narrow scopes.
  const requireAlertsRead = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
    acceptedScopes: ["bid.read", ALERTS_READ_SCOPE],
  });
  const requireAlertsWrite = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
    acceptedScopes: ["bid.write", ALERTS_WRITE_SCOPE],
  });
  const engine = () => container.alertEngine;
  const r = new Hono<{ Variables: { userId?: string } }>();

  // The answer is the same whether or not the address is already on the list.
  r.post("/subscribe", zValidator("json", alertSignupSchema), async (c) => {
    const { email, source } = c.req.valid("json");
    await engine().subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email,
      source: source ?? "web_home_alerts",
    });
    return c.json({ ok: true });
  });

  // What a link would do, so its page can say so before the button is pressed.
  r.get("/link-preview", zValidator("query", previewQuerySchema), async (c) => {
    const { t, kind } = c.req.valid("query");
    const data =
      kind === "confirm"
        ? await engine().confirm.preview(t, "bid")
        : await engine().stop.preview(t, "bid");
    return c.json({ data });
  });

  r.post("/confirm", zValidator("json", alertTokenSchema), async (c) => {
    const { token } = c.req.valid("json");
    return c.json({ ok: true, outcome: await engine().confirm.confirm(token, "bid") });
  });

  r.post("/stop", zValidator("json", alertStopSchema), async (c) => {
    const { token, scope, topic, via } = c.req.valid("json");
    const outcome =
      via === "one_click"
        ? await engine().stop.stopOneClick(token, "bid")
        : await engine().stop.stop(
            token,
            "bid",
            scope === "topic" && topic ? { scope, topic } : { scope: "all" },
          );
    return c.json({ ok: outcome !== "invalid", outcome }, outcome === "invalid" ? 400 : 200);
  });

  r.get("/me", requireAlertsRead, async (c) => {
    const view = await engine().preferences.view("bid", c.get("userId") as string);
    return c.json({ data: view });
  });

  r.put(
    "/me/topics/:topic",
    requireAlertsWrite,
    zValidator("param", z.object({ topic: bidAlertTopicSchema })),
    zValidator("json", alertTopicSwitchSchema),
    async (c) => {
      const { topic } = c.req.valid("param");
      const { on, email, restart } = c.req.valid("json");
      const outcome = await engine().preferences.setTopic({
        product: "bid",
        subjectId: c.get("userId") as string,
        topic,
        on,
        ...(email === undefined ? {} : { email }),
        ...(restart ? { restartStopped: true } : {}),
      });
      if (outcome === "saved") return c.json({ ok: true });
      const error =
        outcome === "unverified"
          ? "Verify your email address to get alerts."
          : outcome === "blocked"
            ? "Alerts to this address were stopped. Contact us to switch them back on."
            : outcome === "stopped"
              ? "You stopped all alerts. Turn them back on in Settings."
              : "We couldn't find your account.";
      return c.json({ ok: false, error, reason: outcome }, 409);
    },
  );

  return r;
}
