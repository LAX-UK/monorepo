import { describe, expect, it } from "vitest";
import {
  SELL_DEPARTMENT_GROUPS,
  type SellDepartment,
  departmentIntakeHref,
} from "./sell-departments";

function departmentById(id: string): SellDepartment {
  const department = SELL_DEPARTMENT_GROUPS.flatMap((g) => g.departments).find((d) => d.id === id);
  if (!department) throw new Error(`missing department: ${id}`);
  return department;
}

describe("departmentIntakeHref", () => {
  it("routes wizard departments through sellIntakeHref with categorySlug", () => {
    const watches = departmentById("watches-clocks");
    expect(departmentIntakeHref(watches)).toBe(
      "/login?next=%2Fdashboard%2Fsubmissions%2Fnew%3FcategorySlug%3Dwatches-clocks&intent=sell",
    );
  });

  it("routes landing departments to tailored pages", () => {
    const estate = departmentById("estate");
    expect(departmentIntakeHref(estate)).toBe("/sell/estate");
  });

  it("routes contact departments to specialist enquiry", () => {
    const jewellery = departmentById("jewellery");
    expect(departmentIntakeHref(jewellery)).toBe("/contact?intent=selling&type=jewellery");
  });
});
