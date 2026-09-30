import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { IConnectTransferInitiationService } from "../interfaces/stripe-connect.js";
import type { ConnectTransferInitiationService } from "./connect/connect-transfer-initiation.service.js";

/**
 * Compile-time LSP contract: initiation service must remain substitutable for its interface.
 */
type AssertAssignable<T extends U, U> = T;

declare const service: ConnectTransferInitiationService;

type _Initiation = AssertAssignable<typeof service, IConnectTransferInitiationService>;

type _InitiationContract = [_Initiation];

defineCompileTimeContract<_InitiationContract>();
