import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How ReviewPilot AI collects, uses, protects and shares personal data, including rights under India's DPDP Act 2023 and the GDPR.",
  alternates: { canonical: "/privacy" },
};

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are and our role",
    body: [
      "ReviewPilot AI (\"ReviewPilot\", \"we\", \"us\") provides software that helps businesses collect customer feedback, manage online reviews and analyse sentiment.",
      "For information about our own account holders (business owners and their team members), we act as a Data Fiduciary under India's Digital Personal Data Protection Act, 2023 (\"DPDP Act\") and as a controller under the EU/UK General Data Protection Regulation (\"GDPR\").",
      "For personal data our business customers upload or collect about their own customers (for example names and phone numbers used for review requests), we act as a Data Processor on their behalf and process it only on their documented instructions.",
    ],
  },
  {
    id: "data-we-collect",
    title: "Information we collect",
    body: [
      "Account data: name, email, phone number, business name, category, country, password hash (never the password itself) and, if you use Google Sign-In, your Google account identifier and profile basics.",
      "Business data: locations, team members, review content synced from authorised integrations, reply drafts and campaign settings.",
      "End-customer data (processed for our customers): contact details, consent records, feedback submissions and message delivery events.",
      "Usage and device data: log data, IP address, browser type, pages visited and security events, used to operate and protect the service.",
      "Payment data is handled by our payment providers (Razorpay, Stripe). We receive limited details such as payment status and the last four digits of a card; we never store full card numbers.",
    ],
  },
  {
    id: "how-we-use",
    title: "How we use information",
    body: [
      [
        "To provide, maintain and secure the service, including authentication and fraud prevention.",
        "To send review requests and messages that our customers initiate, using channels and templates they configure.",
        "To generate AI suggestions (reply drafts, sentiment, themes) from review content on our customers' instructions.",
        "To process payments, issue invoices and manage subscriptions.",
        "To communicate with you about your account, security and product updates; marketing emails only with consent, and you can unsubscribe at any time.",
        "To comply with legal obligations.",
      ],
      "We do not sell personal data, and we do not use end-customer data from one business to benefit another.",
    ],
  },
  {
    id: "legal-bases",
    title: "Legal bases and consent",
    body: [
      "Under the DPDP Act we process personal data on the basis of consent or for legitimate uses permitted by law. Under the GDPR we rely on contract, legitimate interests, consent and legal obligation as applicable.",
      "Businesses using ReviewPilot are responsible for obtaining valid consent from their customers before sending WhatsApp, SMS or email review requests. ReviewPilot records consent per channel and automatically honours opt-outs.",
    ],
  },
  {
    id: "ai",
    title: "AI processing",
    body: [
      "AI features send the minimum necessary review text and business context to our AI provider (currently OpenAI) through secure server-side calls. Provider API keys are never exposed to browsers.",
      "Under our provider agreements, data submitted through the API is not used to train the provider's models. AI outputs are suggestions; our customers decide what to publish.",
    ],
  },
  {
    id: "sharing",
    title: "Sharing with service providers",
    body: [
      "We share data only with sub-processors that help us run the service, under contracts that require appropriate protection, including: cloud hosting and databases, Google (Business Profile and Sign-In), Meta (WhatsApp Cloud API), Resend (email), OpenAI (AI features), Razorpay and Stripe (payments), and S3-compatible storage.",
      "We may disclose information where required by law or to protect the rights, property or safety of ReviewPilot, our customers or others.",
    ],
  },
  {
    id: "security",
    title: "Security",
    body: [
      "We use organisation-level data isolation, role-based access control, encryption in transit (TLS) and encryption at rest for integration tokens, hashed passwords, HTTP-only session cookies with refresh-token rotation, audit logging of sensitive actions and rate limiting.",
      "No method of transmission or storage is completely secure. If we become aware of a personal data breach, we will notify affected customers and the Data Protection Board of India or relevant supervisory authorities as required by law.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    body: [
      "We keep account data for as long as your account is active and for a limited period afterwards to meet legal, tax and accounting obligations. End-customer data is retained according to our customers' settings and deleted or returned at the end of the service, subject to legal requirements.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: [
      "Depending on where you live, you may have the right to access, correct, update or erase your personal data, to withdraw consent, to nominate another person to exercise your rights (DPDP Act), to data portability and to object to or restrict certain processing (GDPR), and to lodge a complaint with a regulator.",
      "If you are a customer of a business that uses ReviewPilot, please contact that business first; we will assist them in responding to your request.",
      "You can export or delete your account data from your account settings, or email privacy@reviewpilot.ai.",
    ],
  },
  {
    id: "transfers",
    title: "International transfers",
    body: [
      "Our infrastructure and some sub-processors may be located outside India or your country. Where we transfer personal data internationally, we do so in line with the DPDP Act and, for GDPR-covered data, using appropriate safeguards such as Standard Contractual Clauses.",
    ],
  },
  {
    id: "children",
    title: "Children",
    body: ["ReviewPilot is a business service and is not directed to children. We do not knowingly collect personal data from anyone under 18 for our own purposes."],
  },
  {
    id: "contact",
    title: "Contact and grievance officer",
    body: [
      "For privacy questions or to exercise your rights, contact our Grievance Officer at privacy@reviewpilot.ai. We aim to respond within the timelines required by applicable law.",
      "We may update this policy from time to time. We will notify you of material changes by email or in the app before they take effect.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="1 November 2026"
      intro="This policy explains what personal data ReviewPilot AI collects, why we collect it, how we protect it and the choices you have. It applies to our website, web application and related services."
      sections={sections}
    />
  );
}
