import { isSafeNextPath } from "@/lib/auth/safe-next-path";

export function postLoginHandoffHref(
  requestedNext: string | null | undefined,
  options: { withWelcomeBack?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (requestedNext && isSafeNextPath(requestedNext)) {
    params.set("next", requestedNext);
  }
  if (options.withWelcomeBack === true) {
    params.set("welcome", "back");
  }
  const query = params.toString();
  return query ? `/auth/post-login?${query}` : "/auth/post-login";
}
