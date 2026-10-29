/**
 * How the page follows an account switch. The switch already refreshes the page it ran on, so a
 * person who is on the destination only needs the refresh. Pushing the address they are already
 * on, beside that refresh, can leave the router waiting on a navigation that never settles: the
 * page then keeps showing the old account until it is reloaded.
 */
export function followSwitch(currentPath: string, destination: string): "refresh" | "push" {
  return currentPath === destination ? "refresh" : "push";
}
