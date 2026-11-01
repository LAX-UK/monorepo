import type { ActiveStaffMember } from "@auction/persistence/interfaces";
import { vi } from "vitest";
import { ConsignmentAssignmentService } from "../services/consignment-messages/consignment-assignment.service.js";
import { ConsignmentInboxQueryService } from "../services/consignment-messages/consignment-inbox-query.service.js";
import { ConsignmentMessageComposer } from "../services/consignment-messages/consignment-message-composer.js";
import { ConsignmentMessagePresenter } from "../services/consignment-messages/consignment-message-presenter.js";
import type { IConsignmentReplyDelivery } from "../services/consignment-messages/consignment-message.ports.js";
import { ConsignmentMessageService } from "../services/consignment-messages/consignment-message.service.js";
import { ConsignmentSavedReplyService } from "../services/consignment-messages/consignment-saved-reply.service.js";
import { ConsignmentThreadAudit } from "../services/consignment-messages/consignment-thread-audit.js";
import { ConsignmentThreadCommandService } from "../services/consignment-messages/consignment-thread-command.service.js";
import { ConsignmentThreadSweepService } from "../services/consignment-messages/consignment-thread-sweep.service.js";
import { InMemoryConsignmentInbox } from "./in-memory-consignment-inbox.js";
import { InMemoryConsignmentMessages } from "./in-memory-consignment-messages.js";
import { InMemoryConsignmentSavedReplies } from "./in-memory-consignment-saved-replies.js";
import { InMemoryReplyDelivery } from "./in-memory-reply-delivery.js";

export const ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";
export const OTHER_SUBMISSION_ID = "33333333-3333-4333-8333-444444444444";
export const THREAD_NOW = new Date("2026-10-29T10:00:00Z");

/** Everything a consignment thread test needs, wired the way the container wires it. */
export function consignmentThreadFixture(
  options: {
    now?: () => Date;
    delivery?: IConsignmentReplyDelivery;
    staff?: ActiveStaffMember[];
  } = {},
) {
  const now = options.now ?? (() => THREAD_NOW);
  const messages = new InMemoryConsignmentMessages();
  messages.seedSubject({
    submissionId: SUBMISSION_ID,
    title: "Thames at low tide",
    referenceNumber: 2041,
    submittedByUserId: "lena",
    account: {
      id: ACCOUNT_ID,
      name: "Northbank Gallery",
      kind: "organisation",
      status: "approved",
    },
    specialist: { userId: "clara", name: "Clara Mendes" },
    saleId: null,
  });
  for (const [id, name] of [
    ["clara", "Clara Mendes"],
    ["lena", "Lena Fischer"],
    ["owner", "Olivia Owner"],
    ["omar", "Omar Reyes"],
  ] as const) {
    messages.names.set(id, name);
  }
  messages.staffRoles.set("clara", ["specialist"]);
  messages.memberRoles.set("lena", "consignor");

  const notifier = {
    specialistWrote: vi.fn().mockResolvedValue(undefined),
    clientWrote: vi.fn().mockResolvedValue(undefined),
  };
  const links = { linksFor: vi.fn(async (keys: readonly string[]) => keys.map((k) => `/f/${k}`)) };
  const events = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };
  const delivery = new InMemoryReplyDelivery();
  const staff: ActiveStaffMember[] = options.staff ?? [
    { userId: "clara", name: "Clara Mendes", roles: ["specialist"] },
    { userId: "omar", name: "Omar Reyes", roles: ["client_services"] },
    { userId: "finn", name: "Finn Ledger", roles: ["finance"] },
  ];
  const staffDirectory = {
    listActiveStaff: vi.fn(async () => staff),
    findActiveStaff: vi.fn(
      async (userId: string) => staff.find((s) => s.userId === userId) ?? null,
    ),
  };
  const inbox = new InMemoryConsignmentInbox(messages);
  const presenter = new ConsignmentMessagePresenter(links);
  const composer = new ConsignmentMessageComposer(messages);
  const audit = new ConsignmentThreadAudit(events);
  const savedReplies = new InMemoryConsignmentSavedReplies();

  const client = new ConsignmentMessageService({
    messages,
    composer,
    presenter,
    notifier,
    audit,
    now,
  });
  const assignment = new ConsignmentAssignmentService({ messages, audit, now });
  const commands = new ConsignmentThreadCommandService({
    messages,
    inbox,
    staff: staffDirectory,
    composer,
    presenter,
    notifier,
    delivery: options.delivery ?? delivery,
    audit,
    assignment,
    now,
  });
  const sweep = new ConsignmentThreadSweepService({
    messages,
    deliver: (messageId) => commands.deliver(messageId),
    assignment,
    now,
  });
  const facts = {
    readFacts: vi.fn(async () => ({
      submission: { image: null, status: "approved", medium: "Oil on canvas", yearOfWork: "1998" },
      sale: null,
      lot: null,
      agreement: null,
      sender: { name: "Lena Fischer", memberRole: "consignor" },
      alsoNotified: ["Olivia Owner"],
      accountConsignmentCount: 14,
    })),
  };
  const queries = new ConsignmentInboxQueryService({
    inbox,
    messages,
    facts,
    staff: staffDirectory,
    presenter,
    images: { resolveAll: async (values) => values.map((v) => `/img/${v}`) },
    now,
  });
  const savedReplyService = new ConsignmentSavedReplyService({
    replies: savedReplies,
    audit,
    now,
  });

  return {
    messages,
    inbox,
    notifier,
    links,
    events,
    delivery,
    staffDirectory,
    facts,
    client,
    commands,
    assignment,
    sweep,
    queries,
    savedReplyService,
    savedReplies,
  };
}

export type ConsignmentThreadFixture = ReturnType<typeof consignmentThreadFixture>;
