export type DashboardDensity = "normal" | "compact";

export type DensityStore = {
  getDensity(): DashboardDensity;
  setDensity(density: DashboardDensity): void;
};

const STORAGE_KEY = "lax_dashboard_density";

function normalizeDensity(value: string | null): DashboardDensity {
  return value === "compact" ? "compact" : "normal";
}

export function createLocalStorageDensityStore(): DensityStore {
  return {
    getDensity() {
      if (typeof window === "undefined") return "normal";
      try {
        return normalizeDensity(window.localStorage.getItem(STORAGE_KEY));
      } catch {
        return "normal";
      }
    },
    setDensity(density) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(STORAGE_KEY, density);
      } catch {
        /* ignore quota / private mode */
      }
    },
  };
}
