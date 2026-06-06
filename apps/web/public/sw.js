const DEFAULT_ICON = "/favicons/android-chrome-192x192.png";
const DEFAULT_BADGE = "/favicons/favicon-32x32.png";

function parsePushPayload(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Update", body: event.data?.text() ?? "" };
  }
  const title = typeof data.title === "string" ? data.title : "Auction update";
  const body = typeof data.body === "string" ? data.body : "";
  const url = typeof data.url === "string" ? data.url : "/";
  const tag = typeof data.tag === "string" ? data.tag : "lax-notification";
  const icon = typeof data.icon === "string" ? data.icon : DEFAULT_ICON;
  const badge = typeof data.badge === "string" ? data.badge : DEFAULT_BADGE;
  return { title, body, url, tag, icon, badge };
}

self.addEventListener("push", (event) => {
  const { title, body, url, tag, icon, badge } = parsePushPayload(event);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  const origin = self.location.origin;
  const full = url.startsWith("http") ? url : `${origin}${url.startsWith("/") ? url : `/${url}`}`;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if (!client.url.startsWith(origin) || !("focus" in client)) continue;
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(full);
            } catch {
              // navigate() is not supported in all browsers; fall through to focus/openWindow.
            }
          }
          return client.focus();
        }
        return self.clients.openWindow(full);
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      // Subscription may already be refreshed on pushManager when clients are open.
      await self.registration.pushManager.getSubscription();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED" });
      }
    })(),
  );
});
