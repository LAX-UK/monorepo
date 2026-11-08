import type { FramingOption, FramingOptionList } from "@auction/shop-contracts";
import type {
  FramingFrame,
  FramingGlazing,
  FramingHanging,
  FramingMount,
  FramingPrices,
  FramingStatus,
} from "@auction/shop-domain";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";

/** An option as the store holds it, with what a save decides from. */
export type StoredFramingOption = {
  id: string;
  code: string;
  name: string;
  frame: FramingFrame;
  mount: FramingMount;
  glazing: FramingGlazing;
  hanging: FramingHanging;
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
  pricesPence: FramingPrices;
  status: FramingStatus;
  pricesPlaceholder: boolean;
  updatedAt: Date;
};

/** What a save writes. The store sets the timestamps, the sort order and, for a new option, the id. */
export type FramingOptionFields = Omit<StoredFramingOption, "id" | "code" | "updatedAt">;

/** The catalogue as staff see it, each option with the number of editions offering it. */
export interface FramingListReader {
  list(): Promise<FramingOptionList>;
}

/** What a save looks up and writes, inside its transaction. */
export interface FramingStore {
  /** The option, held until the transaction ends so two saves of it queue up; null if unknown. */
  lock(optionId: string): Promise<StoredFramingOption | null>;
  /** Holds the catalogue's codes until the transaction ends, so two new options cannot share one. */
  lockCodes(): Promise<void>;
  /** Whether any option already uses the code. */
  codeTaken(code: string): Promise<boolean>;
  /** Adds an option at the end of the list. */
  insert(code: string, fields: FramingOptionFields): Promise<{ id: string }>;
  update(optionId: string, fields: FramingOptionFields): Promise<void>;
  /** One option as the list shows it. */
  get(optionId: string): Promise<FramingOption>;
}

export type FramingTx = {
  framing: FramingStore;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface FramingUnitOfWork {
  run<T>(fn: (tx: FramingTx) => Promise<T>): Promise<T>;
}
