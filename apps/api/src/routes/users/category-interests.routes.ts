import { categoryInterestsPutSchema } from "@auction/validators";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserCategoryInterestsRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get("/me/category-interests", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.categoryInterestsHttp.getForUser({ userId });
    return respondUserHttpJson(c, response);
  });

  r.put(
    "/me/category-interests",
    requireAuth,
    zValidator("json", categoryInterestsPutSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { categoryIds } = c.req.valid("json");
      const response = await container.userRoutes.categoryInterestsHttp.replaceAndComplete({
        userId,
        categoryIds,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.put(
    "/me/category-interests/preferences",
    requireAuth,
    zValidator("json", categoryInterestsPutSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { categoryIds } = c.req.valid("json");
      const response = await container.userRoutes.categoryInterestsHttp.replacePreferences({
        userId,
        categoryIds,
      });
      return respondUserHttpJson(c, response);
    },
  );
}
