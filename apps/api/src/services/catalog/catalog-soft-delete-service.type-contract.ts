import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { ILotSoftDeleteService } from "../interfaces/lot-soft-delete.js";
import type { ISaleSoftDeleteService } from "../interfaces/sale-soft-delete.js";
import type { LotSoftDeleteService } from "../lot-soft-delete.service.js";
import type { SaleSoftDeleteService } from "../sale-soft-delete.service.js";

type AssertAssignable<T extends U, U> = T;

declare const lotFacade: LotSoftDeleteService;
declare const saleFacade: SaleSoftDeleteService;

type _LotSoftDelete = AssertAssignable<typeof lotFacade, ILotSoftDeleteService>;
type _SaleSoftDelete = AssertAssignable<typeof saleFacade, ISaleSoftDeleteService>;

type _FacadeContract = [_LotSoftDelete, _SaleSoftDelete];

defineCompileTimeContract<_FacadeContract>();
