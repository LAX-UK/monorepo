import {
  type FramingOfferBody,
  type FramingOption,
  type FramingOptionBody,
  type FramingOptionList,
  type FramingOptionUpdateBody,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import {
  FRAMING_BAND_CODES,
  FRAMING_EDIT_CAPABILITY,
  type FramingOptionInput,
  type FramingPrices,
  framingCodeFromName,
  framingSaveIssues,
  nextFramingStatus,
  pricesStayPlaceholder,
} from "@auction/shop-domain";
import { FramingRejectedError } from "../../errors/framing-rejected-error.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  FramingListReader,
  FramingOptionFields,
  FramingTx,
  FramingUnitOfWork,
  StoredFramingOption,
} from "./framing.ports.js";

type Actor = { actorSubjectId: string; idempotencyKey: string };

export type CreateFramingOptionCommand = Actor & { body: FramingOptionBody };
export type UpdateFramingOptionCommand = Actor & {
  optionId: string;
  body: FramingOptionUpdateBody;
};
export type OfferFramingOptionCommand = Actor & { optionId: string; body: FramingOfferBody };

const TARGET_TYPE = "shop_framing_option";
/** How many suffixes to try before giving up on a unique code; never reached in practice. */
const CODE_ATTEMPTS = 50;

function inputOf(body: FramingOptionBody): FramingOptionInput {
  return {
    name: body.name,
    frame: body.frame,
    mount: body.mount,
    glazing: body.glazing,
    hanging: body.hanging,
    leadTimeMinDays: body.leadTimeMinDays,
    leadTimeMaxDays: body.leadTimeMaxDays,
    pricesPence: body.pricesPence,
  };
}

/** The prices as whole numbers, or null while any band is still missing. */
function completePrices(prices: FramingOptionBody["pricesPence"]): FramingPrices | null {
  const complete: Partial<FramingPrices> = {};
  for (const band of FRAMING_BAND_CODES) {
    const price = prices[band];
    if (price === null) return null;
    complete[band] = price;
  }
  return complete as FramingPrices;
}

function summaryOf(option: StoredFramingOption | FramingOptionFields) {
  return {
    name: option.name,
    frame: option.frame,
    mount: option.mount,
    glazing: option.glazing,
    hanging: option.hanging,
    leadTimeMinDays: option.leadTimeMinDays,
    leadTimeMaxDays: option.leadTimeMaxDays,
    pricesPence: option.pricesPence,
    status: option.status,
    pricesPlaceholder: option.pricesPlaceholder,
  };
}

async function lockCurrent(
  tx: FramingTx,
  optionId: string,
  expectedVersion: string,
): Promise<StoredFramingOption> {
  const current = await tx.framing.lock(optionId);
  if (!current) throw notFound("Framing option not found");
  // Versions travel as millisecond ISO strings; the column holds microseconds.
  if (current.updatedAt.getTime() !== new Date(expectedVersion).getTime()) {
    throw new StaleVersionError("This framing option", current.updatedAt.toISOString());
  }
  return current;
}

/** The first code for `name` that no option uses: "natural-oak", then "natural-oak-2", and so on. */
async function freeCode(tx: FramingTx, name: string): Promise<string> {
  const base = framingCodeFromName(name);
  for (let attempt = 1; attempt <= CODE_ATTEMPTS; attempt += 1) {
    const code = attempt === 1 ? base : `${base}-${attempt}`;
    if (!(await tx.framing.codeTaken(code))) return code;
  }
  throw new ShopApiError(
    SHOP_API_ERROR_CODES.CONFLICT,
    "Too many framing options share this name. Choose a different name.",
    409,
  );
}

/**
 * The framing catalogue: lists the options, adds one, edits one and offers or pauses one. Every
 * change is checked by the domain rules, written with the next list order, audited with the option
 * before and after, and replayed for a repeated idempotency key. Prices that were seeded as
 * placeholders cannot be offered until staff change them.
 */
export function createFramingService(deps: { uow: FramingUnitOfWork; lists: FramingListReader }) {
  return {
    list(): Promise<FramingOptionList> {
      return deps.lists.list();
    },

    create(command: CreateFramingOptionCommand): Promise<FramingOption> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "framing.create",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command.body,
          run: async () => {
            const { body } = command;
            const issues = framingSaveIssues(inputOf(body), {
              offered: body.offered,
              pricesPlaceholder: false,
            });
            const prices = completePrices(body.pricesPence);
            if (issues.length > 0 || !prices) throw new FramingRejectedError(issues);

            await tx.framing.lockCodes();
            const fields: FramingOptionFields = {
              name: body.name.trim(),
              frame: body.frame,
              mount: body.mount,
              glazing: body.glazing,
              hanging: body.hanging,
              leadTimeMinDays: body.leadTimeMinDays as number,
              leadTimeMaxDays: body.leadTimeMaxDays as number,
              pricesPence: prices,
              status: nextFramingStatus(null, body.offered),
              pricesPlaceholder: false,
            };
            const { id } = await tx.framing.insert(await freeCode(tx, fields.name), fields);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: FRAMING_EDIT_CAPABILITY,
              action: "framing.create",
              targetType: TARGET_TYPE,
              targetId: id,
              afterJson: summaryOf(fields),
            });
            return tx.framing.get(id);
          },
        }),
      );
    },

    update(command: UpdateFramingOptionCommand): Promise<FramingOption> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "framing.update",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { optionId: command.optionId, ...command.body },
          run: async () => {
            const { body } = command;
            const before = await lockCurrent(tx, command.optionId, body.expectedVersion);
            const prices = completePrices(body.pricesPence);
            // A seeded option's prices stay placeholders until one of them changes.
            const placeholder = prices
              ? pricesStayPlaceholder(
                  { pricesPence: before.pricesPence, placeholder: before.pricesPlaceholder },
                  prices,
                )
              : before.pricesPlaceholder;
            const issues = framingSaveIssues(inputOf(body), {
              offered: body.offered,
              pricesPlaceholder: placeholder,
            });
            if (issues.length > 0 || !prices) throw new FramingRejectedError(issues);

            const fields: FramingOptionFields = {
              name: body.name.trim(),
              frame: body.frame,
              mount: body.mount,
              glazing: body.glazing,
              hanging: body.hanging,
              leadTimeMinDays: body.leadTimeMinDays as number,
              leadTimeMaxDays: body.leadTimeMaxDays as number,
              pricesPence: prices,
              status: nextFramingStatus(before.status, body.offered),
              pricesPlaceholder: placeholder,
            };
            await tx.framing.update(command.optionId, fields);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: FRAMING_EDIT_CAPABILITY,
              action: "framing.update",
              targetType: TARGET_TYPE,
              targetId: command.optionId,
              beforeJson: summaryOf(before),
              afterJson: summaryOf(fields),
            });
            return tx.framing.get(command.optionId);
          },
        }),
      );
    },

    offer(command: OfferFramingOptionCommand): Promise<FramingOption> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "framing.offer",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { optionId: command.optionId, ...command.body },
          run: async () => {
            const { body } = command;
            const before = await lockCurrent(tx, command.optionId, body.expectedVersion);
            if (body.offered && before.pricesPlaceholder) {
              throw new FramingRejectedError([{ field: "offered", reason: "placeholder_prices" }]);
            }
            const fields: FramingOptionFields = {
              ...summaryOf(before),
              status: nextFramingStatus(before.status, body.offered),
            };
            await tx.framing.update(command.optionId, fields);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: FRAMING_EDIT_CAPABILITY,
              action: body.offered ? "framing.offer" : "framing.pause",
              targetType: TARGET_TYPE,
              targetId: command.optionId,
              beforeJson: { status: before.status },
              afterJson: { status: fields.status },
            });
            return tx.framing.get(command.optionId);
          },
        }),
      );
    },
  };
}

export type FramingService = ReturnType<typeof createFramingService>;
