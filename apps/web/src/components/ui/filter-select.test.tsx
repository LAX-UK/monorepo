import { FilterSelect } from "@/components/ui/filter-select";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/lots",
  useSearchParams: () => new URLSearchParams(),
}));

function manyOptions(count: number) {
  return [
    { value: "", label: "All artists" },
    ...Array.from({ length: count }, (_, i) => ({
      value: `artist-${i}`,
      label: `Artist ${i}`,
    })),
  ];
}

describe("FilterSelect", () => {
  beforeEach(() => {
    push.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows All label in combobox mode when param is absent", () => {
    render(<FilterSelect param="artistId" comboboxThreshold={2} options={manyOptions(3)} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("All artists");
  });

  it("maps __all__ selection to URL param removal", () => {
    render(<FilterSelect param="artistId" comboboxThreshold={2} options={manyOptions(3)} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /all artists/i }));

    expect(push).toHaveBeenCalledWith("/admin/lots", { scroll: false });
  });

  it("uses defaultValue when param is absent", () => {
    render(
      <FilterSelect
        param="sort"
        defaultValue="name_asc"
        options={[
          { value: "name_asc", label: "Name A–Z" },
          { value: "name_desc", label: "Name Z–A" },
        ]}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Name A–Z");
  });
});
