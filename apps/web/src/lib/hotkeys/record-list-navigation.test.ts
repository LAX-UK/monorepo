import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLayerOpen,
  moveRecordFocus,
  recordRowTargets,
  toggleRecordSelection,
} from "./record-list-navigation";

function list(rows: { title: string; link?: boolean; checkbox?: boolean; hidden?: boolean }[]) {
  document.body.innerHTML = `<main id="main-content"><ul>${rows
    .map(
      (row) =>
        `<li data-record-row ${row.hidden ? "hidden" : ""}>${
          row.checkbox ? `<input type="checkbox" aria-label="Select ${row.title}" />` : ""
        }${row.link === false ? row.title : `<a href="/r/${row.title}" data-record-link>${row.title}</a>`}</li>`,
    )
    .join("")}</ul></main>`;
  return document.getElementById("main-content") as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("record list keys", () => {
  it("moves to the first row, then down and up, stopping at the ends", () => {
    const root = list([{ title: "a" }, { title: "b" }, { title: "c" }]);
    const [a, b, c] = recordRowTargets(root);
    expect(moveRecordFocus(root, 1, document.body)).toBe(a);
    expect(document.activeElement).toBe(a);
    moveRecordFocus(root, 1, document.activeElement);
    expect(document.activeElement).toBe(b);
    moveRecordFocus(root, 1, document.activeElement);
    moveRecordFocus(root, 1, document.activeElement);
    expect(document.activeElement).toBe(c);
    moveRecordFocus(root, -1, document.activeElement);
    moveRecordFocus(root, -1, document.activeElement);
    moveRecordFocus(root, -1, document.activeElement);
    expect(document.activeElement).toBe(a);
  });

  it("moves on from a control inside a row, and skips rows that open nothing or are hidden", () => {
    const root = list([
      { title: "a", checkbox: true },
      { title: "b", link: false },
      { title: "c", hidden: true },
      { title: "d" },
    ]);
    const checkbox = root.querySelector("input") as HTMLElement;
    checkbox.focus();
    expect(moveRecordFocus(root, 1, checkbox)?.textContent).toBe("d");
  });

  it("does nothing on a page without a list", () => {
    document.body.innerHTML = "<main id='main-content'><p>Nothing</p></main>";
    expect(moveRecordFocus(document, 1, null)).toBeNull();
  });

  it("ticks the focused row's checkbox, and reports a row without one", () => {
    const root = list([{ title: "a", checkbox: true }, { title: "b" }]);
    const [a, b] = recordRowTargets(root);
    const box = root.querySelector("input") as HTMLInputElement;
    const onClick = vi.fn();
    box.addEventListener("click", onClick);
    expect(toggleRecordSelection(a ?? null)).toBe(true);
    expect(box.checked).toBe(true);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(toggleRecordSelection(b ?? null)).toBe(false);
  });

  it("knows when a dialog or menu is open", () => {
    document.body.innerHTML = '<div role="dialog" data-state="closed"></div>';
    expect(isLayerOpen()).toBe(false);
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    expect(isLayerOpen()).toBe(true);
  });
});
