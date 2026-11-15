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
  it("reads the result word of the topmost Received-SPF header", () => {
    expect(spfResultOf([h("Received-SPF", "Pass (sender SPF authorized) identity=mailfrom")])).toBe(
      "pass",
    );
    expect(spfResultOf([h("received-spf", "softfail (transitioning)")])).toBe("softfail");
    expect(spfResultOf([h("Received-SPF", "TempError; reason")])).toBe("temperror");
  });

  it("believes only the topmost header: a sender's own header further down is ignored", () => {
    expect(
      spfResultOf([h("Received-SPF", "Fail (not permitted)"), h("Received-SPF", "Pass (forged)")]),
    ).toBe("fail");
  });

  it("is none when there is no header or the word is unknown", () => {
    expect(spfResultOf([])).toBe("none");
    expect(spfResultOf([h("Received-SPF", "maybe")])).toBe("none");
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
      inboundAuthentication([h("Received-SPF", "pass")], "sam@example.test", {
        trustedAuthservId: SERVER,
      }),
    ).toEqual({ spf: "pass", dkim: "none" });
  });

  it("reads the domain of an address", () => {
    expect(domainOfAddress("Sam <sam@Mail.Example.test>")).toBe("mail.example.test");
    expect(domainOfAddress("no-at-sign")).toBe("");
  });
});
