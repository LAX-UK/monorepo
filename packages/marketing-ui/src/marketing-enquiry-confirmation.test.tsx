import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingEnquiryConfirmation } from "./marketing-enquiry-confirmation.js";

describe("MarketingEnquiryConfirmation", () => {
  it("announces the confirmation and lists what happens next in order", () => {
    const { container } = render(
      <MarketingEnquiryConfirmation
        title="Enquiry sent"
        lead="The gallery team will reply within one working day."
        steps={[
          { title: "We read your enquiry", body: "A member of the team picks it up." },
          { title: "We reply", body: "By email, or by phone if you prefer." },
        ]}
        details={[{ kind: "phone", text: "+44 20 0000 0000", href: "tel:+442000000000" }]}
        actions={<a href="/account/enquiries">Track this in Enquiries</a>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Enquiry sent");
    const steps = within(container.querySelector("ol") as HTMLElement);
    expect(steps.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "1We read your enquiryA member of the team picks it up.",
      "2We replyBy email, or by phone if you prefer.",
    ]);
    expect(screen.getByRole("heading", { name: "Prefer to talk?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+44 20 0000 0000" })).toHaveAttribute(
      "href",
      "tel:+442000000000",
    );
    expect(screen.getByRole("link", { name: "Track this in Enquiries" })).toBeInTheDocument();
  });

  it("leaves out the contact block without details", () => {
    render(<MarketingEnquiryConfirmation title="Sent" lead="Thanks." steps={[]} />);
    expect(screen.queryByRole("heading", { name: "Prefer to talk?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "What happens next" })).not.toBeInTheDocument();
  });
});
