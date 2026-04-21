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

const SAVED_VIEW_PREFIX = "lax_table_saved_view:";

export type SavedTableViewStore = {
  getView(pathname: string): string | null;
  setView(pathname: string, viewId: string): void;
};

/** Persisted saved filter preset id per route (e.g. `/admin/lots`). */
export function createSavedTableViewStore(): SavedTableViewStore {
  return {
    getView(pathname: string) {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(`${SAVED_VIEW_PREFIX}${pathname}`);
      } catch {
        return null;
      }
    },
    setView(pathname: string, viewId: string) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(`${SAVED_VIEW_PREFIX}${pathname}`, viewId);
      } catch {
        /* ignore */
      }
    },
  };
}
