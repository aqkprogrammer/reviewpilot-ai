import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that govern use of ReviewPilot AI, including acceptable use, review-platform policies, subscriptions and liability.",
  alternates: { canonical: "/terms" },
};

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: [
      "These Terms of Service (\"Terms\") form a binding agreement between ReviewPilot AI (\"ReviewPilot\") and the business or individual (\"Customer\", \"you\") that creates an account or uses the service. If you accept on behalf of an organisation, you confirm you have authority to bind it.",
    ],
  },
  {
    id: "service",
    title: "The service",
    body: [
      "ReviewPilot provides tools to request customer feedback, manage reviews from authorised integrations, draft replies with AI, and analyse feedback. Features vary by plan.",
      "Some features depend on third-party platforms (such as Google Business Profile, WhatsApp Cloud API, payment providers and AI providers). Their availability, approval processes and policies are outside our control, and we do not guarantee access to any third-party API.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts and security",
    body: [
      "You must provide accurate information, keep credentials confidential and promptly notify us of unauthorised access. You are responsible for activity under your account and for the actions of team members you invite.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use and review policies",
    body: [
      "You agree to comply with all applicable laws and with the policies of review platforms and messaging channels you use through ReviewPilot. In particular, you will not:",
      [
        "Selectively solicit reviews only from customers likely to leave positive reviews (review gating), or discourage negative reviews.",
        "Offer incentives, discounts or rewards in exchange for reviews.",
        "Post, purchase or generate fake reviews, or write reviews about your own business or competitors.",
        "Send messages to people who have not consented to receive them, or continue messaging people who have opted out.",
        "Upload unlawful content, malware, or personal data you have no right to process.",
        "Attempt to access other customers' data, probe or disrupt the service, or reverse engineer it except as permitted by law.",
      ],
      "We may suspend accounts that breach these rules, including to protect message-channel quality ratings and platform relationships.",
    ],
  },
  {
    id: "customer-data",
    title: "Customer data and privacy",
    body: [
      "You retain ownership of data you submit. You grant ReviewPilot a limited licence to process it to provide the service. You are responsible for having a lawful basis and any required consents for the personal data of your customers. Our Privacy Policy and Data Processing Addendum describe how we process personal data.",
    ],
  },
  {
    id: "ai",
    title: "AI features",
    body: [
      "AI outputs are suggestions that may be inaccurate or inappropriate for your context. You are responsible for reviewing outputs before publishing. Replies are not published automatically unless an owner explicitly enables that setting.",
    ],
  },
  {
    id: "billing",
    title: "Subscriptions, trials and payment",
    body: [
      "Paid plans are billed in advance on a monthly or annual basis through our payment providers. Prices exclude applicable taxes such as GST. Free trials convert to paid plans only when you choose a plan and complete payment.",
      "If a payment fails, we may provide a grace period, after which features may be limited until payment succeeds. Upgrades take effect immediately; downgrades take effect at the next renewal. Except where required by law, fees are non-refundable.",
      "We may change pricing with at least 30 days' notice before your next renewal.",
    ],
  },
  {
    id: "termination",
    title: "Cancellation and termination",
    body: [
      "You may cancel at any time from your subscription settings; access continues until the end of the paid period. We may suspend or terminate for material breach. After termination you may export your data for 30 days, after which we delete it in line with our retention policy.",
    ],
  },
  {
    id: "warranties",
    title: "Disclaimers",
    body: [
      "The service is provided \"as is\" and \"as available\". We do not guarantee any particular number of reviews, rating improvement or business outcome.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: [
      "To the extent permitted by law, neither party is liable for indirect, incidental or consequential damages, and ReviewPilot's aggregate liability is limited to the fees you paid in the twelve months before the claim.",
    ],
  },
  {
    id: "law",
    title: "Governing law",
    body: [
      "These Terms are governed by the laws of India, and the courts of Bengaluru, Karnataka have exclusive jurisdiction, unless mandatory law in your country provides otherwise.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: ["Questions about these Terms can be sent to legal@reviewpilot.ai. We will notify you of material changes before they take effect."],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="1 November 2026"
      intro="Please read these terms carefully. They explain your rights and responsibilities when using ReviewPilot AI, including the review and messaging policies every customer must follow."
      sections={sections}
    />
  );
}
