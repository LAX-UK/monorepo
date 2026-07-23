import type { SubmissionRouteServices } from "./index.js";

type SubmissionRoutePick<K extends keyof SubmissionRouteServices> = {
  submissionRoutes: Pick<SubmissionRouteServices, K>;
};

export type SubmissionSellerRoutesContainer = SubmissionRoutePick<"sellerHttp" | "documentHttp"> &
  Pick<
    import("../../../container.js").Container,
    "userSuspensionChecker" | "requireSubmissionsLegalEntityContext"
  >;

export type SubmissionAdminRoutesContainer = SubmissionRoutePick<"adminHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type SubmissionDocumentRoutesContainer = SubmissionRoutePick<"documentHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type SubmissionRoutesContainer = SubmissionRoutePick<
  "sellerHttp" | "adminHttp" | "documentHttp"
> &
  Pick<
    import("../../../container.js").Container,
    "userSuspensionChecker" | "requireSubmissionsLegalEntityContext"
  >;
