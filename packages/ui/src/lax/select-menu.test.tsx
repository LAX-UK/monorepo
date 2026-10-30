import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SelectMenu } from "./index.js";

function Roles() {
  const [value, setValue] = useState<"all" | "admin" | "viewer">("all");
  return (
    <>
      <SelectMenu
        label="Role"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "all", label: "All roles" },
          { value: "admin", label: "Admin" },
          { value: "viewer", label: "Viewer" },
        ]}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("SelectMenu", () => {
  it("names what is chosen and the current choice", () => {
    render(<Roles />);
    expect(screen.getByRole("button", { name: "Role: All roles" })).toHaveTextContent("All roles");
  });

  it("chooses from its radio items", () => {
    render(<Roles />);
    const trigger = screen.getByRole("button", { name: "Role: All roles" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Admin" }));
    expect(screen.getByTestId("value").textContent).toBe("admin");
    expect(screen.getByRole("button", { name: "Role: Admin" })).toBeInTheDocument();
  });
});
