export const FAQS: { q: string; a: string }[] = [
  {
    q: "Is ReviewPilot compliant with Google's review policies?",
    a: "Yes. We never gate reviews. Every customer who opens your feedback page sees the same option to leave an honest public Google review, whether their private feedback is glowing or critical. We don't offer or encourage incentives for reviews, and we never post reviews on anyone's behalf.",
  },
  {
    q: "How does WhatsApp review collection work?",
    a: "You connect your own WhatsApp Business account through Meta's official Cloud API. ReviewPilot sends a pre-approved message template to customers who have consented to hear from you, with a link to your branded feedback page. Delivery, read and failure events flow back so you can see exactly what happened to every request.",
  },
  {
    q: "Do I need Google Business Profile API access to start?",
    a: "No. You can paste your Google review link and start collecting with QR codes, WhatsApp and email on day one. Connecting Google Business Profile adds review syncing and publishing replies from ReviewPilot; that connection requires Google's OAuth approval for your account.",
  },
  {
    q: "Will AI reply to my reviews automatically?",
    a: "Not unless you explicitly turn it on. By default, AI drafts a reply in your brand tone and a person on your team reviews, edits and approves it before anything is published. For negative reviews, drafts stay empathetic, never argue, and never reveal private customer details.",
  },
  {
    q: "Which languages does the AI support?",
    a: "English, Hindi and Hinglish today, for both drafting replies and analysing sentiment. Feedback pages can be shown to customers in English or Hindi.",
  },
  {
    q: "Can I track whether a customer actually left a Google review?",
    a: "We report what can be measured honestly: messages sent, delivered, link clicks and clicks through to Google. Whether a specific customer posted a review is only shown when it's available through your authorised Google integration; we never guess.",
  },
  {
    q: "How is my customers' data protected?",
    a: "Each business's data is isolated at the database level, integration tokens are encrypted at rest, and access is controlled by roles. We honour opt-outs automatically and support data export and deletion requests in line with India's DPDP Act 2023 and GDPR.",
  },
  {
    q: "Is there a free trial?",
    a: "Every plan starts with a 14-day free trial. You can change plans or cancel at any time from your subscription settings.",
  },
];
