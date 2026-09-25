import type { AccountOnboardingSubmitBody } from "@auction/validators";
import type { WebsiteEventContext } from "../../../lib/marketing-event-factory.js";
import type { UserHttpJson } from "./user-route-http.js";

export interface IUserAccountOnboardingHttpApplicationService {
  complete(input: {
    userId: string;
    body: AccountOnboardingSubmitBody;
    marketingContext?: WebsiteEventContext;
  }): Promise<UserHttpJson>;
}
