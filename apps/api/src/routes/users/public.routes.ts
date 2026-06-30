import { registerBodySchema, userIdParamSchema } from "@auction/validators";
import { buildWebsiteUserEvent } from "../../lib/marketing-event-factory.js";
import { isOrgModuleEnabled, orgModuleDisabledResponse } from "../../lib/org-module-enabled.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserPublicRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireTurnstile } = deps;

  r.post("/register", zValidator("json", registerBodySchema), requireTurnstile, async (c) => {
    if (container.env?.DISABLE_NEW_USER_REGISTRATION) {
      return c.json(
        { error: "New registrations are temporarily disabled", code: "registration_disabled" },
        503,
      );
    }
    const body = c.req.valid("json");
    const { turnstileToken: _turnstile, ...reg } = body;
    const orgModuleEnabled = isOrgModuleEnabled(container.env.WEB_ORIGIN);
    // Platform invites (staff/client role grants) must keep working when the org
    // module is hidden; only organisation personas and entity-scoped invites are gated.
    if (!orgModuleEnabled && reg.persona === "organisation") {
      const disabled = orgModuleDisabledResponse();
      return c.json(disabled, 403);
    }
    const result = await container.registrationService.register({
      firstName: reg.firstName,
      lastName: reg.lastName,
      email: reg.email,
      password: reg.password,
      persona: reg.persona,
      ...(reg.inviteToken !== undefined ? { inviteToken: reg.inviteToken } : {}),
      allowEntityInvites: orgModuleEnabled,
      ...("mobile" in reg && reg.mobile !== undefined
        ? { mobile: reg.mobile, mobileCountry: reg.mobileCountry }
        : {}),
    });
    if (!result.ok) {
      return c.json({ error: result.message }, result.status as 400);
    }
    const marketingEventId = crypto.randomUUID();
    await container.marketingEventService.emit(
      buildWebsiteUserEvent(c, {
        name: "Lead",
        eventId: marketingEventId,
        userId: result.userId,
        customData: { method: "email" },
      }),
    );
    return c.json({ data: { userId: result.userId, marketingEventId } }, 201);
  });

  r.get("/public/artists", async (c) => {
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(c.req.query("limit") ?? "24", 10) || 24),
    );
    const offset = Math.max(0, Number.parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const rows = await container.userService.listPublicArtists({ limit, offset });
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        image: await container.mediaUrlResolver.resolve(row.image),
      })),
    );
    return c.json({ data });
  });

  r.get("/public/:userId", zValidator("param", userIdParamSchema), async (c) => {
    const { userId: id } = c.req.valid("param");
    const row = await container.userService.getById(id);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    const image = await container.mediaUrlResolver.resolve(row.image);
    return c.json({
      data: { id: row.id, name: row.name, image },
    });
  });
}
