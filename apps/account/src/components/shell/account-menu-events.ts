/** The phone tab bar's More tab asks the menu sheet to open with this window event. */
export const OPEN_ACCOUNT_MENU_EVENT = "lax-account:open-menu";

export function openAccountMenu(): void {
  window.dispatchEvent(new Event(OPEN_ACCOUNT_MENU_EVENT));
}
