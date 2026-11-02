import { describe, expect, it } from "vitest";
import { splitStateText } from "./split-state-text";

describe("splitStateText", () => {
  it.each([
    [
      "You've been outbid. The next bid is £7,250",
      { title: "You've been outbid", detail: "The next bid is £7,250" },
    ],
    [
      "You're the highest bidder. Your maximum is £9,000.50",
      { title: "You're the highest bidder", detail: "Your maximum is £9,000.50" },
    ],
    ["You're the highest bidder", { title: "You're the highest bidder", detail: null }],
    [
      "You won this lot. Pay by Tue 10 Nov",
      { title: "You won this lot", detail: "Pay by Tue 10 Nov" },
    ],
  ])("%s", (text, parts) => {
    expect(splitStateText(text)).toEqual(parts);
  });

  it("keeps a pence amount in the title whole", () => {
    expect(splitStateText("Your bid of £1,000.50 stands").detail).toBeNull();
  });
});
