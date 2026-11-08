export type IndustrySlug = "restaurants" | "clinics" | "salons" | "hotels";

export interface IndustrySolution {
  slug: IndustrySlug;
  name: string;
  short: string;
  headline: string;
  subheadline: string;
  moments: { title: string; body: string }[];
  whatsapp: { business: string; message: string };
  review: { author: string; rating: number; text: string };
  reply: string;
  insights: { label: string; mentions: number; tone: "positive" | "negative" | "neutral" }[];
  checklist: string[];
}

export const SOLUTIONS: IndustrySolution[] = [
  {
    slug: "restaurants",
    name: "Restaurants & cafés",
    short: "Turn tonight's great dinner into tomorrow's discovery on Google Maps.",
    headline: "Every table is a review waiting to happen.",
    subheadline:
      "Table-tent QR codes, a WhatsApp nudge after delivery, and AI that tells you whether people are talking about the biryani or the wait.",
    moments: [
      { title: "At the table", body: "A branded QR on the bill folder opens a two-tap feedback page — no app, no login." },
      { title: "After delivery or takeaway", body: "A consented WhatsApp message 45 minutes after the order lands, while the meal is fresh in mind." },
      { title: "Weekly huddle", body: "AI groups mentions of taste, portion, wait time and staff so the kitchen and floor know what to fix." },
    ],
    whatsapp: {
      business: "Saffron Table",
      message: "Hi Priya, thanks for dining at Saffron Table, Indiranagar! How was everything tonight? Share your experience here — it takes under a minute.",
    },
    review: { author: "Arjun M.", rating: 4, text: "Paneer tikka was outstanding and the staff were warm. Took 25 minutes to get a table on Saturday though." },
    reply:
      "Thank you, Arjun! We're glad the paneer tikka and our team made your evening. You're right about the Saturday wait — we've added a host for weekend evenings so tables move faster. Hope to see you again soon.",
    insights: [
      { label: "Food quality", mentions: 142, tone: "positive" },
      { label: "Staff warmth", mentions: 96, tone: "positive" },
      { label: "Weekend wait time", mentions: 38, tone: "negative" },
      { label: "Pricing", mentions: 21, tone: "neutral" },
    ],
    checklist: ["Table-tent and bill-folder QR templates", "Post-order WhatsApp requests", "Menu-item mention tracking", "Multi-outlet comparison"],
  },
  {
    slug: "clinics",
    name: "Dental & healthcare clinics",
    short: "Earn patient trust with a reputation that reflects the care you actually give.",
    headline: "Patients choose clinics they trust. Show them why.",
    subheadline:
      "Gentle, consent-first review requests after appointments, privacy-safe AI replies, and insights into waiting times, staff and follow-up care.",
    moments: [
      { title: "After the appointment", body: "A courteous WhatsApp or email request once the visit is complete — never during treatment." },
      { title: "At reception", body: "A QR stand at the front desk for walk-in patients who want to share feedback." },
      { title: "Monthly review", body: "Spot recurring themes like waiting room delays or billing clarity across every branch." },
    ],
    whatsapp: {
      business: "BrightSmile Dental",
      message: "Hello Mr. Rao, thank you for visiting BrightSmile Dental today. We'd value your honest feedback on your visit — it helps us care for every patient better.",
    },
    review: { author: "Sneha K.", rating: 2, text: "Doctor was good but I waited almost an hour past my appointment time with no update." },
    reply:
      "Dear Sneha, thank you for telling us about this, and we're sorry for the long wait without an update — that isn't the experience we want for anyone. We'd like to understand what happened; please call our front desk and ask for the clinic manager.",
    insights: [
      { label: "Doctor expertise", mentions: 188, tone: "positive" },
      { label: "Hygiene & cleanliness", mentions: 121, tone: "positive" },
      { label: "Waiting time", mentions: 54, tone: "negative" },
      { label: "Billing clarity", mentions: 17, tone: "neutral" },
    ],
    checklist: ["Privacy-safe AI replies that never confirm patient details", "Appointment-based scheduling", "Branch-level access for managers", "Consent records per patient"],
  },
  {
    slug: "salons",
    name: "Salons & spas",
    short: "Make every fresh look and relaxing session count on Google.",
    headline: "Your best work deserves to be seen.",
    subheadline:
      "Ask at the moment clients love their look, reply in your own warm voice, and learn which stylists and services keep clients coming back.",
    moments: [
      { title: "At checkout", body: "A mirror-sticker QR right where clients see the final result." },
      { title: "Same evening", body: "A friendly WhatsApp thank-you with a feedback link, sent only to clients who opted in." },
      { title: "Stylist insights", body: "See which services and team members are mentioned most, and how sentiment trends." },
    ],
    whatsapp: {
      business: "Lumen Salon & Spa",
      message: "Hi Ananya! Loved having you at Lumen today. If you have a moment, tell us how your hair spa felt — we read every message.",
    },
    review: { author: "Ritika S.", rating: 5, text: "Meera did an amazing balayage, exactly what I asked for. Super relaxing head massage too!" },
    reply:
      "Ritika, this made our day! Meera will be thrilled to hear you love your balayage. Thank you for choosing Lumen — see you for your next refresh.",
    insights: [
      { label: "Stylist skill", mentions: 164, tone: "positive" },
      { label: "Ambience", mentions: 88, tone: "positive" },
      { label: "Appointment delays", mentions: 23, tone: "negative" },
      { label: "Product upselling", mentions: 12, tone: "neutral" },
    ],
    checklist: ["Mirror and counter QR designs", "Stylist mention tracking", "Friendly & appreciative reply tones", "Repeat-client history"],
  },
  {
    slug: "hotels",
    name: "Hotels & hospitality",
    short: "Turn every stay into a reason for the next guest to book.",
    headline: "Great stays should be easy to talk about.",
    subheadline:
      "Request reviews at checkout, reply to guests across languages, and catch issues like housekeeping or Wi-Fi before they show up in ratings.",
    moments: [
      { title: "At checkout", body: "An email or WhatsApp thank-you with a feedback link as the guest leaves." },
      { title: "In the room", body: "Elegant QR cards on the desk for guests who want to share feedback during their stay." },
      { title: "Ops review", body: "Sentiment by department — front desk, housekeeping, F&B — across every property." },
    ],
    whatsapp: {
      business: "The Konkan Bay Resort",
      message: "Dear Mr. Fernandes, thank you for staying with us at The Konkan Bay Resort. We hope you had a wonderful time. Would you share a few words about your stay?",
    },
    review: { author: "David F.", rating: 4, text: "Beautiful sea-facing room and lovely breakfast spread. Wi-Fi in the cottages was patchy." },
    reply:
      "Thank you for staying with us, David, and for the kind words about the room and breakfast. We've passed your Wi-Fi feedback to our engineering team, who are upgrading coverage across the cottages. We look forward to welcoming you back.",
    insights: [
      { label: "Room & view", mentions: 211, tone: "positive" },
      { label: "Breakfast", mentions: 143, tone: "positive" },
      { label: "Wi-Fi reliability", mentions: 47, tone: "negative" },
      { label: "Check-in speed", mentions: 29, tone: "neutral" },
    ],
    checklist: ["Checkout-triggered requests", "Department-level sentiment", "Multi-property dashboards", "Guest replies in English & Hindi"],
  },
];

export function getSolution(slug: string) {
  return SOLUTIONS.find((s) => s.slug === slug);
}
