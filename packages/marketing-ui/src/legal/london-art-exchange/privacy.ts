import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Privacy Notice, as published by London Art Exchange Ltd at https://www.thelax.art/privacy-notice
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const PRIVACY_POLICY: LegalPolicyDocument<"privacy"> = {
  slug: "privacy",
  title: "Privacy Notice",
  summary:
    "What personal data we hold, why we hold it, how long we keep it and the rights you can exercise.",
  sections: [
    {
      id: "controller-and-scope",
      heading: "1. Controller and scope",
      blocks: [
        {
          type: "paragraph",
          text: "London Art Exchange Ltd is the controller for personal information described in this notice. Our company number is 12874213 and registered office is London Art Exchange, 156 New Cavendish Street, London, United Kingdom, W1W 6YW.",
        },
        {
          type: "paragraph",
          text: "This notice covers www.thelax.art, our gallery enquiries, direct sales, events, marketing and related customer administration. It does not automatically cover a separately operated auction platform or another legal entity. Follow the notice shown by that service.",
        },
        {
          type: "paragraph",
          text: "Privacy contact: info@thelax.art; telephone +44 800 208 4800; postal address: the registered office above, marked Privacy.",
        },
      ],
    },
    {
      id: "information-we-may-collect",
      heading: "2. Information we may collect",
      blocks: [
        {
          type: "paragraph",
          text: "Depending on your dealings with us, we may collect:",
        },
        {
          type: "list",
          items: [
            "identity and contact information, such as name, title, address, email and telephone number;",
            "account, preference and authentication information;",
            "order, payment-token, invoice, refund, delivery, collection and correspondence records;",
            "collecting interests, wish lists, event attendance, appointments and relationship notes;",
            "artwork ownership, provenance, condition, consignment or transaction information where relevant;",
            "KYC and AML information, including date of birth, identity document, address evidence, nationality, occupation, beneficial ownership, authority, source of funds or wealth, bank evidence, sanctions/PEP results and risk decisions;",
            "website and device information, such as IP address, browser, approximate location, log, cookie and consent records;",
            "marketing choices, campaign engagement and suppression records;",
            "call, CCTV or premises-security information where the relevant system is used and signposted; and",
            "complaint, rights-request, fraud, incident and legal-claim records.",
          ],
        },
        {
          type: "paragraph",
          text: "We do not need every category for every person. We collect what is relevant and proportionate.",
        },
      ],
    },
    {
      id: "where-information-comes-from",
      heading: "3. Where information comes from",
      blocks: [
        {
          type: "paragraph",
          text: "We obtain information:",
        },
        {
          type: "list",
          items: [
            "directly from you or your authorised representative;",
            "from our website, checkout, customer-service, events and gallery systems;",
            "from a payer, recipient, consignor, artist, adviser, company, trust or other party to a transaction;",
            "from payment, delivery, identity, fraud, sanctions, company and AML service providers;",
            "from public registers, official lists, professional advisers, public websites and lawful art-market sources; and",
            "from advertising or referral partners where they have a lawful basis to share it.",
          ],
        },
        {
          type: "paragraph",
          text: "If we obtain information indirectly, we provide the required privacy information within the legally required period unless an exception applies.",
        },
      ],
    },
    {
      id: "why-we-use-information-lawful-basis-and-retention",
      heading: "4. Why we use information, lawful basis and retention",
      blocks: [
        {
          type: "paragraph",
          text: "The table below states our current baseline purposes, lawful bases and retention periods. We shorten a period where the information is no longer needed and retain it longer only where a legal duty, active claim, fraud concern, title or provenance requirement justifies this.",
        },
        {
          type: "table",
          caption: "4. Why we use information, lawful basis and retention",
          columns: [
            "Purpose",
            "Typical information",
            "Lawful basis",
            "Baseline retention position",
          ],
          rows: [
            [
              "Answer an enquiry, arrange a viewing or provide requested information",
              "Identity, contact, interests, correspondence",
              "Steps at your request before contract; legitimate interests in responding",
              "24 months after the last meaningful contact, then delete or minimise unless a continuing relationship, request or claim requires longer.",
            ],
            [
              "Create an account and administer a direct purchase",
              "Identity, contact, account, order, payment token, delivery",
              "Contract; legal obligation; legitimate interests in secure administration",
              "Contract and core transaction records generally six years after completion, subject to tax, claim and art-record needs",
            ],
            [
              "Describe, evidence and administer artwork ownership, provenance and condition",
              "Transaction and artwork records",
              "Contract; legal obligation; legitimate interests in title, authenticity, cultural-property and claim records",
              "Core provenance, title, authenticity and condition records may be retained for the life of the artwork or longer where needed to protect ownership and market integrity. Unnecessary identity documents are removed after the applicable legal or AML period.",
            ],
            [
              "Take payment, prevent fraud and make refunds",
              "Identity, payment token, order, device and fraud indicators",
              "Contract; legal obligation; legitimate interests in fraud prevention",
              "Provider and finance schedules. LAX does not store full card numbers. Core transaction records are generally retained for six years after completion.",
            ],
            [
              "Deliver, collect, install or store a work",
              "Contact, access, delivery and order details",
              "Contract; legal obligation; legitimate interests in safe fulfilment",
              "Delivery record with transaction file; delete temporary access instructions when no longer needed",
            ],
            [
              "Meet AML, counter-terrorist financing, proliferation-financing and sanctions duties",
              "KYC, beneficial ownership, source information, checks and transaction",
              "Legal obligation; substantial public interest where applicable; legitimate interests for proportionate fraud/risk checks",
              "Normally five years from the transaction or end of relationship where AML law requires, then delete unless another lawful basis permits or requires retention",
            ],
            [
              "Customer service and complaints",
              "Contact, order, communications and outcome",
              "Contract; legal obligation; legitimate interests in resolving and defending matters",
              "Complaint and claim records generally up to six years after closure, longer only where required for a continuing claim",
            ],
            [
              "Data-protection rights and complaints",
              "Identity verification, request and response",
              "Legal obligation; legitimate interests in evidencing compliance",
              "Three years after closure, longer only where a complaint, investigation or legal claim remains active.",
            ],
            [
              "Send requested or consented marketing",
              "Contact, preferences and engagement",
              "Consent; or legitimate interests/PECR soft opt-in only where every condition is met",
              "Until opt-out, withdrawal or 24 months without meaningful engagement. A minimal suppression record is retained as needed to honour the opt-out.",
            ],
            [
              "Measure and improve the Website",
              "Device, logs and storage data",
              "Consent for non-exempt technology; limited legitimate interests or statutory exception only where all conditions are met",
              "Actual cookie duration and server-log schedule in the live inventory",
            ],
            [
              "Protect systems, premises, people and artworks",
              "Logs, account, device, access and CCTV if used",
              "Legitimate interests; legal obligation; establishment or defence of claims",
              "Routine security logs: 12 months. CCTV, where used and signposted: normally 30 days. Incident or claim extracts: up to six years where necessary.",
            ],
            [
              "Finance, tax, VAT and audit",
              "Invoice, transaction and counterparty records",
              "Legal obligation; legitimate interests",
              "At least the applicable statutory period; VAT records commonly six years, with eligible margin-scheme evidence retained as required",
            ],
            [
              "Establish, exercise or defend legal claims",
              "Relevant records",
              "Legitimate interests; legal obligation",
              "For the applicable limitation or claim period",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Where we rely on legitimate interests, we balance the purpose against your rights and expectations. You may ask for a summary of the assessment.",
        },
      ],
    },
    {
      id: "when-information-is-required",
      heading: "5. When information is required",
      blocks: [
        {
          type: "paragraph",
          text: "Some information is required to enter or perform a contract or meet AML, tax, sanctions or other legal duties. If it is not supplied, we may be unable to accept, pay, refund, deliver or complete a transaction. We explain required fields and consequences at collection. Optional marketing is not a condition of making an enquiry or purchase.",
        },
      ],
    },
    {
      id: "who-receives-information",
      heading: "6. Who receives information",
      blocks: [
        {
          type: "paragraph",
          text: "We disclose proportionate information to relevant categories of recipient, including:",
        },
        {
          type: "list",
          items: [
            "website, hosting, security, IT support and cloud providers;",
            "checkout, payment, fraud-prevention, accounting and banking providers;",
            "CRM, email, customer-support and event providers;",
            "carriers, installers, storage providers and insurers;",
            "identity, company, PEP, sanctions and AML screening providers;",
            "artists, sellers, rights holders and transaction counterparties where necessary and lawful;",
            "professional advisers, auditors and insurers;",
            "HMRC, NCA, OFSI, police, courts, regulators and other authorities where required or permitted; and",
            "a purchaser or adviser in a genuine corporate transaction, subject to safeguards.",
          ],
        },
        {
          type: "paragraph",
          text: "Material service providers used in the customer journey include Mont Digital for website development and hosting support; Zoho services for CRM, forms and SalesIQ; Google services for analytics and advertising after consent; Square for payment processing; Shopify for the linked online store; and selected carriers, installers, storage, insurance, professional, identity and sanctions-screening providers. A provider receives only the information needed for its role and must act under its own legal duties or our written instructions, as applicable.",
        },
        {
          type: "paragraph",
          text: "We do not sell personal information.",
        },
      ],
    },
    {
      id: "international-transfers",
      heading: "7. International transfers",
      blocks: [
        {
          type: "paragraph",
          text: "Some providers may process information outside the United Kingdom. Before a restricted transfer, we use an applicable UK adequacy regulation, the UK International Data Transfer Agreement, the UK Addendum to approved standard contractual clauses, or another lawful mechanism, and assess supplementary safeguards where required. Contact us for information about the relevant safeguard for a material transfer.",
        },
      ],
    },
    {
      id: "marketing",
      heading: "8. Marketing",
      blocks: [
        {
          type: "paragraph",
          text: "8.1 We send electronic marketing to an individual only with valid consent or where the PECR “soft opt-in” applies: details were obtained directly during a sale or genuine negotiation, marketing concerns our own similar products or services, and a clear opt-out was offered at collection and in every message.",
        },
        {
          type: "paragraph",
          text: "8.2 We do not use another company’s or a bought list under the soft opt-in. Email, SMS and social-message choices are separate where appropriate. Service messages are not converted into marketing consent.",
        },
        {
          type: "paragraph",
          text: "8.3 You can withdraw consent or object at any time through the message link, preference centre or privacy contact. We keep a minimal suppression record so that we do not contact you again accidentally.",
        },
      ],
    },
    {
      id: "cookies-and-similar-technologies",
      heading: "9. Cookies and similar technologies",
      blocks: [
        {
          type: "paragraph",
          text: "Our Cookie Notice explains the deployed cookies, pixels, local storage, tags and consent controls. Advertising, remarketing, ad measurement, cross-site tracking and comparable non-exempt technologies are blocked until valid consent. Continued browsing is not consent.",
        },
      ],
    },
    {
      id: "automated-decisions-and-profiling",
      heading: "10. Automated decisions and profiling",
      blocks: [
        {
          type: "paragraph",
          text: "We may use limited risk signals to help identify fraud, sanctions or AML concerns. We do not make a decision based solely on automated processing that produces a legal or similarly significant effect. If that position changes, we will update this notice before use and explain the logic, significance, consequences and applicable rights.",
        },
      ],
    },
    {
      id: "security",
      heading: "11. Security",
      blocks: [
        {
          type: "paragraph",
          text: "We use proportionate technical and organisational measures intended to protect information, including access controls, authentication, encryption where appropriate, backups, logging, patching, supplier controls and incident response. No system is completely secure. Access is limited to people with a business need and confidentiality duty.",
        },
      ],
    },
    {
      id: "your-rights",
      heading: "12. Your rights",
      blocks: [
        {
          type: "paragraph",
          text: "Subject to conditions and exceptions, you may have the right to:",
        },
        {
          type: "list",
          items: [
            "access your personal information;",
            "correct inaccurate or incomplete information;",
            "request erasure;",
            "restrict processing;",
            "object to processing based on legitimate interests and object at any time to direct marketing;",
            "receive certain information in a portable format;",
            "withdraw consent without affecting earlier lawful processing; and",
            "obtain safeguards concerning a qualifying automated decision.",
          ],
        },
        {
          type: "paragraph",
          text: "Contact info@thelax.art. We may request proportionate identity evidence. We normally respond without undue delay and within one month; a lawful extension may apply to a complex or numerous request, with notice.",
        },
      ],
    },
    {
      id: "data-protection-complaints",
      heading: "13. Data-protection complaints",
      blocks: [
        {
          type: "paragraph",
          text: "13.1 You can make a data-protection complaint by email, post, telephone or the published complaint form. We will acknowledge it within 30 days, investigate without undue delay, keep you informed where resolution is delayed and communicate the outcome.",
        },
        {
          type: "paragraph",
          text: "13.2 You may complain to the Information Commissioner’s Office. Current details are at ico.org.uk/make-a-complaint or by telephone on 0303 123 1113. You do not lose that right by contacting us first.",
        },
      ],
    },
    {
      id: "children",
      heading: "14. Children",
      blocks: [
        {
          type: "paragraph",
          text: "The Website and art-sale service are not directed at children. A person under 18 must not create a purchase contract without the involvement of a parent or guardian. Tell us if you believe a child supplied information improperly.",
        },
      ],
    },
    {
      id: "changes",
      heading: "15. Changes",
      blocks: [
        {
          type: "paragraph",
          text: "We date and archive this notice. We will give appropriate notice of a material change and seek fresh consent where a new purpose requires it. A privacy notice is transparency information, not a blanket request for agreement.",
        },
      ],
    },
  ],
} as const;
