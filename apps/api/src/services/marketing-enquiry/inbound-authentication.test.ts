import { describe, expect, it } from "vitest";
import {
  dkimResultOf,
  domainOfAddress,
  domainsAlign,
  inboundAuthentication,
  spfResultOf,
} from "./inbound-authentication.js";

const SERVER = "mx.receiver.example.test";
const h = (Name: string, Value: string) => ({ Name, Value });

describe("spfResultOf", () => {
  const FROM = "Sam <sam@example.test>";
  const RECEIVER = "receiver=4f1a+replies@inbound.postmarkapp.com";
  const spf = (result: string, envelopeFrom = "sam@example.test", receiver = RECEIVER) =>
    `${result} identity=mailfrom; client-ip=192.0.2.10; helo=mail.example.test; envelope-from=${envelopeFrom}; ${receiver}`;

  it("reads the result word of the topmost Received-SPF header Postmark wrote", () => {
    expect(spfResultOf([h("Received-SPF", spf("Pass (sender SPF authorized)"))], FROM)).toBe(
      "pass",
    );
    expect(spfResultOf([h("received-spf", spf("softfail (transitioning)"))], FROM)).toBe(
      "softfail",
    );
    expect(spfResultOf([h("Received-SPF", spf("TempError"))], FROM)).toBe("temperror");
  });

  it("believes only the topmost header: a sender's own header further down is ignored", () => {
    expect(
      spfResultOf(
        [h("Received-SPF", spf("Fail (not permitted)")), h("Received-SPF", spf("Pass (forged)"))],
        FROM,
      ),
    ).toBe("fail");
  });

  it("is none when the topmost header was not written by the trusted receiver", () => {
    // A header a sender wrote themselves becomes the topmost one if the receiver adds none.
    expect(
      spfResultOf([h("Received-SPF", spf("Pass", undefined, "receiver=mx.evil.test"))], FROM),
    ).toBe("none");
    expect(spfResultOf([h("Received-SPF", "Pass (sender SPF authorized)")], FROM)).toBe("none");
    expect(
      spfResultOf(
        [h("Received-SPF", spf("Pass", undefined, "receiver=a@postmarkapp.com.evil.test"))],
        FROM,
      ),
    ).toBe("none");
  });

  it("trusts a configured receiver instead of Postmark's", () => {
    const header = h("Received-SPF", spf("Pass", undefined, "receiver=mx.receiver.example.test"));
    expect(spfResultOf([header], FROM)).toBe("none");
    expect(spfResultOf([header], FROM, { trustedSpfReceiver: "receiver.example.test" })).toBe(
      "pass",
    );
  });

  it("counts a pass only when the checked domain aligns with the From domain", () => {
    expect(spfResultOf([h("Received-SPF", spf("Pass", "bounces@mail.example.test"))], FROM)).toBe(
      "pass",
    );
    expect(spfResultOf([h("Received-SPF", spf("Pass", "<bounce@bulk.test>"))], FROM)).toBe(
      "pass_unaligned",
    );
    // No envelope sender: the HELO name is what SPF checked.
    expect(
      spfResultOf(
        [h("Received-SPF", `Pass identity=helo; helo=mail.other.test; ${RECEIVER}`)],
        FROM,
      ),
    ).toBe("pass_unaligned");
    // A failing result is kept as it is, aligned or not.
    expect(spfResultOf([h("Received-SPF", spf("Fail", "x@bulk.test"))], FROM)).toBe("fail");
  });

  it("is none when there is no header or the word is unknown", () => {
    expect(spfResultOf([], FROM)).toBe("none");
    expect(spfResultOf([h("Received-SPF", spf("maybe"))], FROM)).toBe("none");
  });
});

describe("domainsAlign", () => {
  it("aligns the same domain and parent or child domains", () => {
    expect(domainsAlign("example.test", "example.test")).toBe(true);
    expect(domainsAlign("example.test", "mail.example.test")).toBe(true);
    expect(domainsAlign("mail.example.test", "example.test")).toBe(true);
  });

  it("never aligns a different domain or a single label", () => {
    expect(domainsAlign("attacker.test", "example.test")).toBe(false);
    expect(domainsAlign("test", "example.test")).toBe(false);
    expect(domainsAlign("notexample.test", "example.test")).toBe(false);
  });
});

describe("dkimResultOf", () => {
  const from = "Sam <sam@example.test>";

  it("is pass for a passing signature aligned with the From domain from the trusted server", () => {
    const headers = [
      h(
        "Authentication-Results",
        `${SERVER}; spf=pass smtp.mailfrom=example.test; dkim=pass header.d=example.test header.s=s1`,
      ),
    ];
    expect(dkimResultOf(headers, from, { trustedAuthservId: SERVER })).toBe("pass");
  });

  it("is pass_unaligned for a passing signature from another domain", () => {
    const headers = [h("Authentication-Results", `${SERVER}; dkim=pass header.d=bulk-sender.test`)];
    expect(dkimResultOf(headers, from, { trustedAuthservId: SERVER })).toBe("pass_unaligned");
  });

  it("is fail when the only signature failed", () => {
    const headers = [h("Authentication-Results", `${SERVER}; dkim=fail header.d=example.test`)];
    expect(dkimResultOf(headers, from, { trustedAuthservId: SERVER })).toBe("fail");
  });

  it("ignores a header from any other server, and every header without a trusted server", () => {
    const forged = [h("Authentication-Results", "attacker.test; dkim=pass header.d=example.test")];
    expect(dkimResultOf(forged, from, { trustedAuthservId: SERVER })).toBe("none");
    const real = [h("Authentication-Results", `${SERVER}; dkim=pass header.d=example.test`)];
    expect(dkimResultOf(real, from, {})).toBe("none");
  });

  it("believes only the topmost header", () => {
    const headers = [
      h("Authentication-Results", `${SERVER}; dkim=none`),
      h("Authentication-Results", `${SERVER}; dkim=pass header.d=example.test`),
    ];
    expect(dkimResultOf(headers, from, { trustedAuthservId: SERVER })).toBe("none");
  });
});

describe("inboundAuthentication", () => {
  it("combines the SPF and DKIM results", () => {
    expect(
      inboundAuthentication(
        [
          h(
            "Received-SPF",
            "pass identity=mailfrom; envelope-from=sam@example.test; receiver=x@inbound.postmarkapp.com",
          ),
        ],
        "sam@example.test",
        { trustedAuthservId: SERVER },
      ),
    ).toEqual({ spf: "pass", dkim: "none" });
  });

  it("reads the domain of an address", () => {
    expect(domainOfAddress("Sam <sam@Mail.Example.test>")).toBe("mail.example.test");
    expect(domainOfAddress("no-at-sign")).toBe("");
  });
});
