import { describe, expect, it } from "vitest";
import {
  SELL_DEPARTMENT_GROUPS,
  type SellDepartment,
  departmentIntakeHref,
  visibleSellDepartmentGroups,
} from "./sell-departments";

function departmentById(id: string): SellDepartment {
  const department = SELL_DEPARTMENT_GROUPS.flatMap((g) => g.departments).find((d) => d.id === id);
  if (!department) throw new Error(`missing department: ${id}`);
  return department;
}

describe("departmentIntakeHref", () => {
  it("routes wizard departments to the submission wizard with categorySlug", () => {
    const watches = departmentById("watches-clocks");
    expect(departmentIntakeHref(watches)).toBe(
      "/dashboard/submissions/new?categorySlug=watches-clocks",
    );
  });

  it("routes estate collections to the submission wizard", () => {
    const estate = departmentById("estate");
    expect(departmentIntakeHref(estate)).toBe("/dashboard/submissions/new");
  });

  it("routes prints through the wizard with category preselect", () => {
    const prints = departmentById("fine-prints");
    expect(departmentIntakeHref(prints)).toBe(
      "/dashboard/submissions/new?categorySlug=fine-prints",
    );
  });
});

describe("visibleSellDepartmentGroups", () => {
  it("excludes hidden jewellery and handbags departments", () => {
    const visibleIds = visibleSellDepartmentGroups().flatMap((g) => g.departments.map((d) => d.id));
    expect(visibleIds).not.toContain("jewellery");
    expect(visibleIds).not.toContain("handbags-accessories");
    expect(visibleIds).toContain("watches-clocks");
  });
});
