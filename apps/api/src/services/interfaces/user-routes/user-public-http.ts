import type { registerBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { WebsiteEventContext } from "../../../lib/marketing-event-factory.js";
import type { UserHttpJson } from "./user-route-http.js";

type RegisterBodyInput = z.infer<typeof registerBodySchema>;

export interface IUserPublicHttpApplicationService {
  register(input: {
    body: Omit<RegisterBodyInput, "turnstileToken">;
    webOrigin: string;
    registrationDisabled: boolean;
    marketingContext: WebsiteEventContext;
    headers?: Headers;
  }): Promise<UserHttpJson>;

  listPublicArtists(input: { limit: number; offset: number }): Promise<UserHttpJson>;

  getPublicUserProfile(input: { userId: string }): Promise<UserHttpJson>;
}
