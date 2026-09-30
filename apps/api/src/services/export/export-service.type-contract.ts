import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { ExportService } from "./export.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: ExportService;

type _HasCreate = AssertAssignable<(typeof facade)["createExport"], ExportService["createExport"]>;
type _HasPreview = AssertAssignable<
  (typeof facade)["previewExport"],
  ExportService["previewExport"]
>;
type _HasWorker = AssertAssignable<
  (typeof facade)["markCompleted"],
  ExportService["markCompleted"]
>;

type _FacadeContract = [_HasCreate, _HasPreview, _HasWorker];

defineCompileTimeContract<_FacadeContract>();
