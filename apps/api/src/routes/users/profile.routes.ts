import type { UpdateAddressInput } from "@auction/persistence";
import {
  addressIdParamSchema,
  createAddressBodySchema,
  formatPhoneDisplay,
  updateAddressBodySchema,
  updateProfileSchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserProfileRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth, requireAuthAllowSuspended } = deps;

  r.patch("/me/profile", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    await container.profileService.updateProfile(userId, body);
    return c.json({ ok: true });
  });

  r.get("/me/addresses", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.addressService.list(userId);
    return c.json({ data });
  });

  r.post("/me/addresses", requireAuth, zValidator("json", createAddressBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const row = await container.addressService.create(userId, body);
    return c.json({ data: row }, 201);
  });

  r.patch(
    "/me/addresses/:id",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    zValidator("json", updateAddressBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await container.addressService.update(userId, id, body as UpdateAddressInput);
      if (!row) return c.json({ error: "Not found" }, 404);
      return c.json({ data: row });
    },
  );

  r.delete(
    "/me/addresses/:id",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const ok = await container.addressService.delete(userId, id);
      if (!ok) return c.json({ error: "Not found" }, 404);
      return c.body(null, 204);
    },
  );

  r.post(
    "/me/addresses/:id/default",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const existing = await container.addressService.list(userId);
      if (!existing.some((a) => a.id === id)) return c.json({ error: "Not found" }, 404);
      await container.addressService.setDefault(userId, id);
      return c.json({ ok: true });
    },
  );

  r.get("/me", requireAuthAllowSuspended, async (c) => {
    const userId = c.get("userId") as string;
    const [row, uiPrefs] = await Promise.all([
      container.profileService.getProfile(userId),
      container.uiPreferenceService.getForUser(userId),
    ]);
    if (!row) {
      return c.json({ error: "User not found" }, 404);
    }
    const image = await container.mediaUrlResolver.resolve(row.image);
    return c.json({
      data: {
        id: row.id,
        email: row.email,
        name: row.name,
        mobile: row.mobile,
        mobileCountry: row.mobileCountry,
        phoneNumber: row.phoneNumber,
        phoneNumberVerified: row.phoneNumberVerified,
        mobileDisplay: formatPhoneDisplay(row.phoneNumber ?? row.mobile),
        role: row.role,
        staffRole: row.staffRole,
        image,
        emailVerified: row.emailVerified,
        emailStatus: row.emailStatus,
        emailStatusChangedAt: row.emailStatusChangedAt,
        pendingNewEmail: row.pendingNewEmail,
        hasSeenActingContextTooltip: row.hasSeenActingContextTooltip,
        kycStatus: row.kycStatus,
        signupPersona: row.signupPersona,
        deletionRequestedAt: row.deletionRequestedAt,
        twoFactorEnabled: row.twoFactorEnabled,
        suspended: row.suspended,
        uiPreferences: uiPrefs,
      },
    });
  });
}
