import type { CatalogLotVM, Lot } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";

/** Map a server lot row to a catalogue VM with normalized timing (call once per boundary). */
export function toCatalogLotVM(lot: Lot): CatalogLotVM {
  const { startTime: _start, endTime: _end, ...rest } = lot;
  return { ...rest, ...toLotCardTimingVM(lot) };
}

export function toCatalogLotVMs(lots: Lot[]): CatalogLotVM[] {
  return lots.map(toCatalogLotVM);
}
