/**
 * DIP: sidebar / UI preferences without coupling components to `localStorage`.
 */
export type SidebarCollapsedStore = {
  getCollapsed(): boolean;
  setCollapsed(collapsed: boolean): void;
};

const STORAGE_KEY = "lax_dashboard_sidebar_collapsed";

export function createLocalStorageSidebarCollapsedStore(): SidebarCollapsedStore {
  return {
    getCollapsed() {
      if (typeof window === "undefined") return false;
      try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        return false;
      }
    },
    setCollapsed(collapsed: boolean) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      } catch {
        /* ignore quota / private mode */
      }
    },
  };
}
