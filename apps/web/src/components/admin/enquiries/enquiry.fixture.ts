import type {
  EnquiryAssignee,
  EnquiryListItem,
  EnquiryView,
} from "@/lib/data/http/admin-enquiries.schema";

export const ASSIGNEES: EnquiryAssignee[] = [
  { id: "u-sofia", name: "Sofia Okafor" },
  { id: "u-tom", name: "Tom Reid" },
];

/** A new private sale enquiry from a guest, with the work and its files. */
export const sellEnquiry: EnquiryView = {
  id: "00000000-0000-4000-8000-000000001042",
  reference: "E-1042",
  intent: "private_sale_sell",
  topic: "selling",
  topicLabel: "Sell privately",
  name: "Daniel Price",
  email: "daniel.price@example.com",
  phone: "07700 900123",
  message: "Inherited from my mother, bought from the artist's dealer in 1998.",
  sourcePage: "/sell/private-sales",
  status: "new",
  closeReason: null,
  departmentSlug: "paintings",
  assignedToUserId: "u-sofia",
  userId: null,
  legalEntityId: null,
  marketingOptIn: false,
  version: 3,
  receivedAt: "2026-11-02T09:14:00.000Z",
  handledAt: null,
  replyDueAt: "2026-11-04T09:14:00.000Z",
  nextStatuses: ["in_progress", "waiting_on_client", "closed"],
  privateSale: {
    artist: "Iris Calder",
    title: "Low tide at Maldon",
    medium: "Oil on board",
    size: "61 × 76 cm",
    locationTown: "London",
    locationCountry: "UK",
    priceInMindMinor: 4500000,
    lookingFor: null,
    budgetBand: null,
    timing: null,
    contactPreference: "email",
  },
  attachments: [
    { id: "a1", uploadObjectId: "o1", kind: "image", position: 0 },
    { id: "a2", uploadObjectId: "o2", kind: "document", position: 1 },
  ],
  notes: [
    {
      id: "n1",
      authorUserId: "u-sofia",
      body: "Strong period for Calder.",
      createdAt: "2026-11-02T10:02:00.000Z",
    },
  ],
};

export const buyEnquiry: EnquiryView = {
  ...sellEnquiry,
  id: "00000000-0000-4000-8000-000000001041",
  reference: "E-1041",
  intent: "private_sale_buy",
  topicLabel: "Buy privately",
  name: "Marlow Collection Ltd",
  departmentSlug: null,
  userId: "client-9",
  status: "in_progress",
  nextStatuses: ["waiting_on_client", "closed", "converted"],
  privateSale: {
    artist: null,
    title: null,
    medium: null,
    size: null,
    locationTown: null,
    locationCountry: null,
    priceInMindMinor: null,
    lookingFor: "A Modern British landscape for a hallway.",
    budgetBand: "10000_to_50000",
    timing: "within_3_months",
    contactPreference: "either",
  },
  attachments: [],
  notes: [],
};

export const closedEnquiry: EnquiryView = {
  ...sellEnquiry,
  reference: "E-1020",
  status: "closed",
  closeReason: "not_a_fit",
  handledAt: "2026-11-02T12:00:00.000Z",
  nextStatuses: ["in_progress"],
};

export const convertedEnquiry: EnquiryView = {
  ...sellEnquiry,
  reference: "E-1015",
  status: "converted",
  handledAt: "2026-11-02T12:00:00.000Z",
  nextStatuses: [],
};

export const listItem = (patch: Partial<EnquiryListItem> = {}): EnquiryListItem => ({
  id: "id-1042",
  reference: "E-1042",
  intent: "private_sale_sell",
  topicLabel: "Sell privately",
  name: "Daniel Price",
  maskedEmail: "d•••@example.com",
  hasAccount: false,
  departmentSlug: "paintings",
  assignedToUserId: "u-sofia",
  status: "new",
  receivedAt: "2026-11-02T09:14:00.000Z",
  replyDueAt: "2026-11-04T09:14:00.000Z",
  version: 3,
  ...patch,
});
