/** Screen-reader label for the header basket control (item count = line quantities). */
export function shopBasketAccessibleLabel(itemCount: number): string {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return "Basket, empty";
  }
  if (itemCount === 1) {
    return "Basket, 1 item";
  }
  return `Basket, ${itemCount} items`;
}
