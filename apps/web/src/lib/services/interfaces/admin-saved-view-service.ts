import type { AdminSavedViewDto, AdminSavedViewListKey } from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

/** The signed-in staff member's own saved table views, stored by the Bid API. */
export interface IAdminSavedViewService {
  list(listKey: AdminSavedViewListKey): Promise<ServiceResult<AdminSavedViewDto[]>>;
  create(input: {
    listKey: AdminSavedViewListKey;
    label: string;
    query: string;
  }): Promise<ServiceResult<AdminSavedViewDto>>;
  rename(id: string, label: string): Promise<ServiceResult<AdminSavedViewDto>>;
  reorder(
    listKey: AdminSavedViewListKey,
    ids: readonly string[],
  ): Promise<ServiceResult<AdminSavedViewDto[]>>;
  remove(id: string): Promise<ServiceResult<void>>;
}
