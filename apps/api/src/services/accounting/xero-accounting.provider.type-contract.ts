import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { IInvoiceAccountingProvider } from "../interfaces/invoice-accounting.js";
import type { XeroAccountingProvider } from "./xero-accounting.provider.js";
import type { XeroInvoiceWriter } from "./xero-invoice-writer.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: XeroAccountingProvider;
declare const writer: XeroInvoiceWriter;

type _Facade = AssertAssignable<typeof facade, IInvoiceAccountingProvider>;
type _WriterInvoiceMethods = AssertAssignable<
  typeof writer,
  Pick<
    IInvoiceAccountingProvider,
    "ensureInvoiceForPayment" | "syncPaymentFromProvider" | "syncInvoiceFromProvider"
  >
>;

type _XeroAccountingContract = [_Facade, _WriterInvoiceMethods];

defineCompileTimeContract<_XeroAccountingContract>();
