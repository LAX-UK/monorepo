/** Asks the server to drop the flash message stored for `path`, now that the page has shown it. */
export async function requestAdminFlashClear(path: string): Promise<void> {
  await fetch("/api/admin/flash", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
    keepalive: true,
  }).catch(() => undefined);
}
