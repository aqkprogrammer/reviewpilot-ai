export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO
  readingMinutes: number;
  author: { name: string; role: string };
  body: Array<{ type: "p" | "h2" | "ul" | "quote"; text?: string; items?: string[] }>;
}

export const POSTS: BlogPost[] = [
  {
    slug: "review-gating-and-why-we-never-do-it",
    title: "Review gating: what it is, and why ReviewPilot will never do it",
    excerpt:
      "Sending happy customers to Google and unhappy ones to a private form feels clever. It breaks Google's policies, and it quietly erodes trust in your business.",
    category: "Compliance",
    date: "2026-10-14",
    readingMinutes: 6,
    author: { name: "ReviewPilot Team", role: "Product" },
    body: [
      { type: "p", text: "Review gating is the practice of asking customers how they feel first, then only inviting the satisfied ones to leave a public review. Dissatisfied customers are routed to a private feedback form instead. It is one of the most common tactics in reputation software, and Google's policies prohibit it." },
      { type: "h2", text: "Why it is tempting" },
      { type: "p", text: "Ratings drive discovery on Google Maps. A handful of one-star reviews can push a clinic or restaurant below competitors in local results, so it is natural to want to filter them out before they appear." },
      { type: "h2", text: "Why it backfires" },
      { type: "ul", items: [
        "Google may remove reviews or take action on profiles that solicit reviews selectively.",
        "A suspiciously perfect rating makes new customers trust you less, not more.",
        "You lose the most useful signal you have: what is actually going wrong.",
      ] },
      { type: "h2", text: "How ReviewPilot handles it" },
      { type: "p", text: "Every customer who opens a ReviewPilot feedback page sees the same, neutral option to leave an honest Google review, regardless of the rating or comments they shared privately. Private feedback still reaches you instantly so you can fix problems, but it is never a gate." },
      { type: "quote", text: "Honest reviews, answered well, are more persuasive than a perfect score." },
      { type: "p", text: "The way to a better rating is to ask more customers, more consistently, and to respond with care. That is what the product is built to make easy." },
    ],
  },
  {
    slug: "whatsapp-review-requests-playbook",
    title: "A practical playbook for WhatsApp review requests in India",
    excerpt:
      "Timing, consent, template approval and tone: how local businesses can ask for reviews on WhatsApp without becoming spam.",
    category: "Playbooks",
    date: "2026-09-22",
    readingMinutes: 8,
    author: { name: "ReviewPilot Team", role: "Customer Success" },
    body: [
      { type: "p", text: "Most of your customers already talk to you on WhatsApp. Asking for feedback there is natural — when it's done with consent and good timing." },
      { type: "h2", text: "1. Start with consent" },
      { type: "p", text: "Only message customers who have agreed to hear from you on WhatsApp. Record when and how consent was given, and honour opt-outs immediately. ReviewPilot stores consent per customer and per channel and stops sending the moment someone replies STOP." },
      { type: "h2", text: "2. Get your template approved" },
      { type: "p", text: "Business-initiated messages on the WhatsApp Cloud API must use a template approved by Meta. Keep it short, personal and clearly from your business. Avoid promotional language in a feedback request; it slows approval and reads as spam." },
      { type: "h2", text: "3. Time it to the experience" },
      { type: "ul", items: [
        "Restaurants: 30–60 minutes after the meal or delivery.",
        "Clinics: the same evening, after the visit is complete.",
        "Salons: a few hours later, once the client has lived with their new look.",
        "Hotels: on the day of checkout.",
      ] },
      { type: "h2", text: "4. Never offer incentives" },
      { type: "p", text: "Discounts or freebies in exchange for reviews violate Google's policies. Ask for honest feedback and make it easy to give." },
      { type: "h2", text: "5. Close the loop" },
      { type: "p", text: "Reply to every review — positive and negative — within a day or two. AI drafts make that fast, and a human approval step keeps it genuine." },
    ],
  },
  {
    slug: "replying-to-negative-reviews",
    title: "How to reply to a negative review without making it worse",
    excerpt:
      "A calm, specific and private-first reply can turn a one-star review into proof that you care. Here's a structure that works in English, Hindi and Hinglish.",
    category: "AI replies",
    date: "2026-08-30",
    readingMinutes: 5,
    author: { name: "ReviewPilot Team", role: "AI" },
    body: [
      { type: "p", text: "A negative review is public, but your reply is read by every future customer who sees it. That reply is your real audience." },
      { type: "h2", text: "A four-part structure" },
      { type: "ul", items: [
        "Thank them for taking the time to share.",
        "Acknowledge the specific issue without excuses.",
        "Share what you are doing about it, if you can.",
        "Offer a private channel to continue the conversation.",
      ] },
      { type: "h2", text: "What to avoid" },
      { type: "p", text: "Don't argue, don't blame staff by name, and never confirm private details such as a patient's treatment or a guest's booking. ReviewPilot's empathetic and apologetic tones are designed around these rules, and every AI draft waits for a human to approve it." },
    ],
  },
];

export function getPost(slug: string) {
  return POSTS.find((p) => p.slug === slug);
}
