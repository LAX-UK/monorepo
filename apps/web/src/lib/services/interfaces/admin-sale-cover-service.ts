import type { SaleCoverSlotName } from "@auction/types";
import type {
  ReplaceHomePinsBody,
  SetSaleCoverSlotBody,
  UpdateSaleHomeBody,
} from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

/** Staff changes to a sale's home cover: named slots, home fields and the home pins. */
export interface IAdminSaleCoverService {
  setSlot(
    saleId: string,
    slot: SaleCoverSlotName,
    body: SetSaleCoverSlotBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  clearSlot(saleId: string, slot: SaleCoverSlotName): Promise<ServiceResult<void>>;
  updateHome(
    saleId: string,
    body: UpdateSaleHomeBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  replacePins(body: ReplaceHomePinsBody): Promise<ServiceResult<Record<string, unknown>>>;
}
