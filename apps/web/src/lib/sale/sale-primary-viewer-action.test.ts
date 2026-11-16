import { describe, expect, it } from "vitest";
import {
  type SalePrimaryViewerActionInput,
  salePrimaryViewerAction,
} from "./sale-primary-viewer-action";

const base: SalePrimaryViewerActionInput = {
  status: "scheduled",
  deliveryMode: "online",
  registrationOffered: true,
  hasApprovedRegistration: false,
  saleHref: "/sales/spring-sale/sale-1",
  isAuthenticated: true,
  kycApproved: true,
  kycFeedback: null,
  buyerEntities: [{ memberRole: "buyer_agent" }],
  orgModuleEnabled: true,
};

describe("salePrimaryViewerAction", () => {
  it("asks a buyer agent who is not registered to register on the page", () => {
    expect(salePrimaryViewerAction(base)).toEqual({
      label: "Register to bid",
      href: "#register-to-bid",
      emphasis: "secondary",
    });
  });

  it("brings a signed-out visitor back to the sale after sign-up, never to the create-account page", () => {
    const action = salePrimaryViewerAction({ ...base, isAuthenticated: false });
    expect(action).toMatchObject({ label: "Register to bid", emphasis: "primary" });
    expect(action?.href).toBe("/api/auth/login?next=%2Fsales%2Fspring-sale%2Fsale-1&intent=signup");
  });

  it.each<[string, Partial<SalePrimaryViewerActionInput>]>([
    ["registered already", { hasApprovedRegistration: true }],
    ["a private collector", { buyerEntities: [{ memberRole: "owner" }] }],
    [
      "no buyer profiles while organisations are off",
      { buyerEntities: [], orgModuleEnabled: false },
    ],
    ["a sale that takes no web registrations", { registrationOffered: false }],
    ["an onsite sale", { deliveryMode: "onsite" }],
    ["an ended sale", { status: "ended" }],
  ])("asks nothing of %s", (_name, over) => {
    expect(salePrimaryViewerAction({ ...base, ...over })).toBeNull();
  });
});
