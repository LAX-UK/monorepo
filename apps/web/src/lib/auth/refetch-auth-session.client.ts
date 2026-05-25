/** Invalidate Better Auth client session cache after sign-in or sign-out. */
export async function refetchAuthSessionClient(
  refetch: (opts?: { query?: { disableCookieCache?: boolean } }) => Promise<void>,
): Promise<void> {
  await refetch({ query: { disableCookieCache: true } });
}
