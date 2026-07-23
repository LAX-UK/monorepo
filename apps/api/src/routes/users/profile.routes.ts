import type { UpdateAddressInput } from "@auction/persistence/interfaces";
import {
  addressIdParamSchema,
  createAddressBodySchema,
  updateAddressBodySchema,
  updateProfileSchema,
} from "@auction/validators";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserProfileRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth, requireAuthAllowSuspended } = deps;

  r.patch("/me/profile", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const response = await container.userRoutes.profileHttp.updateProfile({ userId, body });
    return respondUserHttpJson(c, response);
  });

  r.get("/me/addresses", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.profileHttp.listAddresses({ userId });
    return respondUserHttpJson(c, response);
  });

  r.post("/me/addresses", requireAuth, zValidator("json", createAddressBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const response = await container.userRoutes.profileHttp.createAddress({ userId, body });
    return respondUserHttpJson(c, response);
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
      const response = await container.userRoutes.profileHttp.updateAddress({
        userId,
        id,
        body: body as UpdateAddressInput,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.delete(
    "/me/addresses/:id",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const response = await container.userRoutes.profileHttp.deleteAddress({ userId, id });
      return respondUserHttpJson(c, response);
    },
  );

  r.post(
    "/me/addresses/:id/default",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const response = await container.userRoutes.profileHttp.setDefaultAddress({ userId, id });
      return respondUserHttpJson(c, response);
    },
  );

  r.get("/me", requireAuthAllowSuspended, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.profileHttp.getMe({ userId });
    return respondUserHttpJson(c, response);
  });
}
