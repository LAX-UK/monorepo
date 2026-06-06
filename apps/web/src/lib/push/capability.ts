export type NotificationPermissionState = "default" | "granted" | "denied";

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ may report as Mac; touch points distinguish it from desktop Safari.
  return navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1;
}

/** iOS web push requires the PWA to be opened from the home screen (standalone). */
export function isIosStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function needsIosInstallForPush(): boolean {
  return isIosDevice() && !isIosStandalonePwa();
}

export function isDisplayModeBrowser(): boolean {
  if (typeof window === "undefined") return true;
  return !window.matchMedia("(display-mode: standalone)").matches;
}
