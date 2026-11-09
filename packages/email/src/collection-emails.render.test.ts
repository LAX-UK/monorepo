import { describe, expect, it } from "vitest";
import { emailAttachments } from "./attachments.js";
import { renderEmail } from "./render.js";
import { OPTIONAL_EMAIL_TEMPLATES } from "./suppression-policy.js";

const visit = {
  userName: "Maya",
  reference: "COL-4821",
  whenLabel: "Thu 12 Nov, 14:00–14:30 GMT",
  placeName: "London Art Exchange",
  address: "156 New Cavendish Street, London W1W 6YW",
  lots: ["Lot 12 · Lowland Storm", "Lot 14 · Coastal Notation"],
  collectorName: "Maya Okafor",
  collectorIsOther: false,
  bookingUrl: "https://lax.bid/purchases/collections/COL-4821",
};

const PRICE = /£|\bGBP\b|premium|hammer|invoice|total/i;

describe("collection booked email", () => {
  it("names the time in the subject and gives the place, the lots and the ID rule", async () => {
    const rendered = await renderEmail("collection-booked", {
      ...visit,
      changeUntilLabel: "Wed 11 Nov, 16:00 GMT",
      collectByLabel: "Tue 8 Dec",
    });
    expect(rendered.subject).toBe("Collection booked: Thu 12 Nov, 14:00–14:30 GMT");
    expect(rendered.html).toContain("Your collection is booked");
    expect(rendered.text).toContain("Hi Maya,");
    expect(rendered.text).toContain("156 New Cavendish Street");
    expect(rendered.text).toContain("Lowland Storm");
    expect(rendered.text).toContain("Bring photo ID in the name of whoever is collecting");
    expect(rendered.text).toContain("Change or cancel online until Wed 11 Nov, 16:00 GMT.");
    expect(rendered.text).toContain("Please collect by Tue 8 Dec.");
    expect(rendered.html).toContain("https://lax.bid/purchases/collections/COL-4821");
  });

  it("says who else is collecting, and that they have been emailed", async () => {
    const rendered = await renderEmail("collection-booked", {
      ...visit,
      collectorName: "Sam Okoro",
      collectorIsOther: true,
    });
    expect(rendered.text).toContain("Sam Okoro will collect, and we've emailed them the details.");
  });

  it("never carries a price", async () => {
    const rendered = await renderEmail("collection-booked", visit);
    expect(`${rendered.subject} ${rendered.text}`).not.toMatch(PRICE);
  });
});

describe("collection handed over email", () => {
  const base = {
    userName: "Maya",
    reference: "COL-4821",
    dayLabel: "Thu 12 Nov",
    collectorName: "Charlotte Hayes",
    collectedLots: ["Lowland Storm", "Coastal Notation"],
    leftLots: [],
    bookUrl: "https://lax.bid/purchases",
  };

  it("thanks them, names the lots in the subject and who took them", async () => {
    const rendered = await renderEmail("collection-collected", base);
    expect(rendered.subject).toBe("Collected: Lowland Storm and Coastal Notation");
    expect(rendered.html).toContain("Thank you for collecting");
    expect(rendered.text).toContain(
      "Charlotte Hayes collected Lowland Storm and Coastal Notation on Thu 12 Nov.",
    );
    expect(rendered.text).not.toContain("Book a collection time");
    expect(`${rendered.subject} ${rendered.text}`).not.toMatch(PRICE);
  });

  it("says what stayed with us, and offers a new time, when some works were left", async () => {
    const rendered = await renderEmail("collection-collected", {
      ...base,
      collectedLots: ["Lowland Storm"],
      leftLots: ["Coastal Notation"],
    });
    expect(rendered.text).toContain(
      "Coastal Notation stayed with us, paid and safe, until you book another time.",
    );
    expect(rendered.html).toContain("Book a collection time");
  });
});

describe("collection missed email", () => {
  it("says we missed them, keeps the lots safe and links to book another time", async () => {
    const rendered = await renderEmail("collection-missed", {
      userName: "Maya",
      reference: "COL-4821",
      whenLabel: "Thu 12 Nov, 14:00–14:30 GMT",
      placeName: "London Art Exchange",
      lots: ["Lowland Storm"],
      bookUrl: "https://lax.bid/purchases",
    });
    expect(rendered.subject).toBe("We missed you today");
    expect(rendered.html).toContain("Book another time to collect");
    expect(rendered.text).toContain("Your lots stay with us, paid and safe");
    expect(rendered.html).toContain("https://lax.bid/purchases");
    expect(`${rendered.subject} ${rendered.text}`).not.toMatch(PRICE);
  });
});

describe("collect by email", () => {
  const base = {
    userName: "Maya",
    when: "lead" as const,
    collectByLabel: "Wed 9 Dec",
    placeName: "London Art Exchange",
    address: "156 New Cavendish Street, London W1W 6YW",
    lots: ["Lot 12 · Lowland Storm"],
    bookUrl: "https://lax.bid/purchases",
  };

  it("asks them to collect by the day, says charges may apply, and links to book", async () => {
    const rendered = await renderEmail("collection-collect-by", base);
    expect(rendered.subject).toBe("Please collect by Wed 9 Dec");
    expect(rendered.html).toContain("Please collect within a week");
    expect(rendered.text).toContain(
      "Please collect by Wed 9 Dec. After that, storage charges may apply",
    );
    expect(rendered.text).toContain("Lowland Storm");
    expect(rendered.html).toContain("https://lax.bid/purchases");
    expect(`${rendered.subject} ${rendered.text}`).not.toMatch(PRICE);
  });

  it("says it is today on the day itself", async () => {
    const rendered = await renderEmail("collection-collect-by", { ...base, when: "day" });
    expect(rendered.subject).toBe("Please collect today");
    expect(rendered.html).toContain("Today is the day to collect");
  });
});

describe("who the emails come from", () => {
  it("name LAX Bid's company in the footer, and the gallery only as the place of the visit", async () => {
    const rendered = await renderEmail("collection-booked", visit);
    expect(rendered.text).toContain("London Auction Xchange");
    expect(rendered.text).not.toMatch(/London Art Exchange Ltd/);
    // The visit itself is at the gallery.
    expect(rendered.text).toContain("London Art Exchange, 156 New Cavendish Street");
  });
});

describe("collection changed email", () => {
  it("says what it moved from and to", async () => {
    const rendered = await renderEmail("collection-changed", {
      ...visit,
      whenLabel: "Wed 11 Nov, 11:30–12:00 GMT",
      previousWhenLabel: "Thu 12 Nov, 14:00–14:30 GMT",
    });
    expect(rendered.subject).toBe("Collection changed: now Wed 11 Nov, 11:30–12:00 GMT");
    expect(rendered.html).toContain("Your collection has moved");
    expect(rendered.text).toContain("was Thu 12 Nov, 14:00–14:30 GMT and is now Wed 11 Nov");
  });
});

describe("collection cancelled email", () => {
  const base = {
    userName: "Maya",
    reference: "COL-4821",
    dayLabel: "Thu 12 Nov",
    lots: ["Lot 12 · Lowland Storm"],
    bookUrl: "https://lax.bid/purchases",
  };

  it("tells the buyer the time is released and the lots are safe", async () => {
    const rendered = await renderEmail("collection-cancelled", { ...base, cancelledBy: "buyer" });
    expect(rendered.subject).toBe("Collection cancelled: Thu 12 Nov");
    expect(rendered.html).toContain("Your collection on Thu 12 Nov is cancelled");
    expect(rendered.text).toContain("released for someone else");
    expect(rendered.html).toContain("Book another time");
  });

  it("gives the gallery's reason when the gallery cancelled", async () => {
    const rendered = await renderEmail("collection-cancelled", {
      ...base,
      cancelledBy: "gallery",
      reasonText: "we are closed that day",
    });
    expect(rendered.text).toContain("We are closed that day. We're sorry for the change.");
  });

  it("explains an account that has gone, without naming the person", async () => {
    const rendered = await renderEmail("collection-cancelled", { ...base, cancelledBy: "account" });
    expect(rendered.text).toContain("The person who booked it has left this account");
  });
});

describe("collection reminder email", () => {
  it("is the day-before note with the time in the subject", async () => {
    const rendered = await renderEmail("collection-reminder", {
      ...visit,
      timeLabel: "14:00 GMT",
    });
    expect(rendered.subject).toBe("Tomorrow: your collection at 14:00 GMT");
    expect(rendered.html).toContain("See you tomorrow at 14:00");
    expect(rendered.text).toContain("A reminder that your collection is tomorrow.");
  });
});

describe("collection collector email", () => {
  const notice = {
    collectorName: "Sam Okoro",
    onBehalfOf: "Maya Okafor",
    bookedBy: null,
    reference: "COL-4821",
    whenLabel: "Thu 12 Nov, 14:00–14:30 GMT",
    dayLabel: "Thu 12 Nov",
    placeName: "London Art Exchange",
    address: "156 New Cavendish Street, London W1W 6YW",
    lots: ["Lowland Storm"],
  };

  it("tells the collector when, where and what to bring, with no money and no account link", async () => {
    const rendered = await renderEmail("collection-collector-notice", notice);
    expect(rendered.subject).toBe("You're collecting for Maya Okafor");
    expect(rendered.text).toContain("Hi Sam Okoro,");
    expect(rendered.text).toContain("Bring photo ID");
    expect(`${rendered.subject} ${rendered.text}`).not.toMatch(PRICE);
    expect(rendered.html).not.toContain('href="https://lax.bid');
  });

  it("names the organisation that authorised the collector and the member who booked", async () => {
    const rendered = await renderEmail("collection-collector-notice", {
      ...notice,
      onBehalfOf: "Northbank Ltd",
      bookedBy: "Jane Hart",
    });
    expect(rendered.subject).toBe("You're collecting for Northbank Ltd");
    expect(rendered.text).toContain("Authorised by Northbank Ltd, booked by Jane Hart.");
    expect(rendered.text).toContain("please contact Jane Hart");
  });

  it("names just the person for a personal booking", async () => {
    const rendered = await renderEmail("collection-collector-notice", notice);
    expect(rendered.text).toContain("Authorised by Maya Okafor.");
    expect(rendered.text).not.toContain("booked by");
  });

  it("counts the lots when there are several", async () => {
    const rendered = await renderEmail("collection-collector-notice", {
      ...notice,
      lots: ["Lowland Storm", "Coastal Notation"],
    });
    expect(rendered.subject).toBe("You're collecting 2 lots on Thu 12 Nov");
  });
});

describe("the calendar file", () => {
  it("is attached with its method, and only when the email has one", () => {
    const attachments = emailAttachments("collection-booked", {
      ...visit,
      calendar: {
        filename: "collection-COL-4821.ics",
        method: "CANCEL",
        content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      },
    });
    expect(attachments).toEqual([
      {
        name: "collection-COL-4821.ics",
        contentType: "text/calendar; method=CANCEL; charset=UTF-8",
        contentBase64: Buffer.from("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n").toString("base64"),
      },
    ]);
    expect(emailAttachments("collection-booked", visit)).toEqual([]);
    expect(emailAttachments("bid-outbid", { lotTitle: "x" } as never)).toEqual([]);
  });
});

describe("collection emails are transactional", () => {
  it("are never silenced by an unsubscribe", () => {
    for (const name of [
      "collection-booked",
      "collection-changed",
      "collection-cancelled",
      "collection-reminder",
      "collection-collector-notice",
      "collection-collected",
      "collection-missed",
      "collection-collect-by",
    ]) {
      expect(OPTIONAL_EMAIL_TEMPLATES).not.toContain(name);
    }
  });
});
