import { describe, expect, it } from "vitest";
import { UserRepositoryAssigneeDirectory } from "./enquiry-assignee-directory.js";

const people = {
  a: { id: "a", name: "Tom Reid", role: "staff" },
  b: { id: "b", name: "Sofia Okafor", role: "staff" },
  c: { id: "c", name: "A Client", role: "client" },
} as const;

const directory = new UserRepositoryAssigneeDirectory({
  findById: async (id) => (people[id as keyof typeof people] ?? null) as never,
  listIdsByRole: async () => ["a", "b", "c", "gone"],
});

describe("UserRepositoryAssigneeDirectory", () => {
  it("lists staff by name and leaves out anyone who is not staff or no longer exists", async () => {
    expect(await directory.list()).toEqual([
      { id: "b", name: "Sofia Okafor" },
      { id: "a", name: "Tom Reid" },
    ]);
  });

  it("knows who is staff", async () => {
    expect(await directory.isStaff("a")).toBe(true);
    expect(await directory.isStaff("c")).toBe(false);
    expect(await directory.isStaff("gone")).toBe(false);
  });
});
