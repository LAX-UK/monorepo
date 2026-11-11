import { describe, expect, it } from "vitest";
import { DEMO_PEOPLE } from "../demo/demo-topup-ids.js";
import { CHECK_PEOPLE } from "./check-accounts.js";

const check = Object.values(CHECK_PEOPLE);
const demo = Object.values(DEMO_PEOPLE);

describe("check accounts", () => {
  it("never reuse a demo person's email or id, so demo accounts stay for people", () => {
    const demoEmails = new Set(demo.map((person) => person.email));
    const demoIds = new Set(
      demo.flatMap((person) => [person.userId, person.personalEntityId ?? person.userId]),
    );
    for (const person of check) {
      expect(demoEmails.has(person.email)).toBe(false);
      expect(demoIds.has(person.userId)).toBe(false);
      expect(demoIds.has(person.personalEntityId ?? person.userId)).toBe(false);
    }
  });

  it("are distinct from each other", () => {
    expect(new Set(check.map((person) => person.email)).size).toBe(check.length);
    expect(new Set(check.map((person) => person.userId)).size).toBe(check.length);
  });

  it("give the buyers a personal account and leave staff without one", () => {
    expect(CHECK_PEOPLE.client.personalEntityId).not.toBeNull();
    expect(CHECK_PEOPLE.newPerson.personalEntityId).not.toBeNull();
    expect(CHECK_PEOPLE.administrator.personalEntityId).toBeNull();
    expect(CHECK_PEOPLE.administrator.bidStaffRole).toBe("administrator");
  });

  it("use ids that are valid UUIDs", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const person of check) {
      expect(person.userId).toMatch(uuid);
      if (person.personalEntityId) expect(person.personalEntityId).toMatch(uuid);
    }
  });
});
