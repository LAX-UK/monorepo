export type BrowserConnectivityPort = {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
};

export function createBrowserConnectivityPort(): BrowserConnectivityPort {
  return {
    isOnline() {
      if (typeof navigator === "undefined") return true;
      return navigator.onLine;
    },
    subscribe(listener) {
      if (typeof window === "undefined") return () => {};
      const onOnline = () => listener(true);
      const onOffline = () => listener(false);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    },
  };
}

let defaultPort: BrowserConnectivityPort | null = null;

export function getBrowserConnectivityPort(): BrowserConnectivityPort {
  if (!defaultPort) {
    defaultPort = createBrowserConnectivityPort();
  }
  return defaultPort;
}
