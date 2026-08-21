/**
 * Adwizers Business Carnival 2026 -- the stall booking offer.
 *
 * Same job as `@/lib/fee` does for the awards: one place for the price, what it
 * buys, and the fixed lists the form asks about, so the booking form, the fee
 * step and the admin screens cannot describe the event differently.
 *
 * Source: the Business Carnival 2026 booking poster.
 */
export const STALL_FEE_INR = 4999;

/** Written out rather than computed, so the rupee sign and the grouping never
 *  depend on the visitor's locale. */
export const STALL_FEE_DISPLAY = "₹4,999";

/** The three facts a stall holder needs before deciding: when, where, and how
 *  few spaces are left to decide about. */
export const CARNIVAL_EVENT = {
  date: "Sunday, 20 September 2026",
  venue: "Nila Mahal AC, Kumbakonam",
  spaces: "Only 20 business spaces",
} as const;

/** How many stalls the venue holds. Drives the "spaces left" tile in admin. */
export const STALL_SPACES_TOTAL = 20;

export type StallInclusion = { title: string; detail: string };

/** Food leads: it is the newest addition to the offer and the one that most
 *  changes what the fee feels like. The rest follow the poster's order. */
export const STALL_INCLUDES: StallInclusion[] = [
  {
    title: "Delicious Food Included",
    detail: "Tasty lunch or dinner and snacks for all participants.",
  },
  {
    title: "Dedicated Business Space",
    detail: "Your own space to display and sell your products or services.",
  },
  {
    title: "Table & Seating Arrangement",
    detail: "We provide the table and seating for your convenience.",
  },
  {
    title: "Event Entry Passes",
    detail: "Entry passes for you and your team.",
  },
  {
    title: "Business Promotion on Social Media",
    detail: "Your business promoted across our social media platforms.",
  },
  {
    title: "Business / Brand Spotlight",
    detail: "A special spotlight post highlighting your business.",
  },
  {
    title: "Business Networking Opportunity",
    detail: "Connect with women entrepreneurs and potential customers.",
  },
  {
    title: "Direct Customer Interaction",
    detail: "Meet customers face to face and widen your reach.",
  },
  {
    title: "Event Photography",
    detail: "Professional photographs of your stall and your business.",
  },
  {
    title: "Event Reel / Video Coverage",
    detail: "Your business featured in the event reels and videos.",
  },
  {
    title: "Business Growth & Government Opportunities",
    detail: "Learn about schemes, grants and opportunities for your business.",
  },
  {
    title: "Business Networking Community Access",
    detail: "Join the AWE Business Community for better connections.",
  },
  {
    title: "Business Stall / Participant ID",
    detail: "Official ID for easy access and recognition.",
  },
  {
    title: "Participant Goodie",
    detail: "A special gift as a token of appreciation.",
  },
  {
    title: "Refreshments & Snacks",
    detail: "Refreshments and snacks through the event.",
  },
];

/** The reasons to take a stall, as the poster puts them. */
export const STALL_EXTRA_VALUE: StallInclusion[] = [
  {
    title: "One Category — One Business",
    detail: "Your category carries only one business. Less competition, more visibility.",
  },
  {
    title: "High Public Footfall",
    detail: "Reach hundreds of potential customers in one place.",
  },
  {
    title: "Business Connections",
    detail: "Meet entrepreneurs, creators and customers, and build real relationships.",
  },
];

export type Choice = { value: string; label: string };

/**
 * Q6. Deliberately not the award category list -- a carnival stall is sorted by
 * what sits on the table, which is a different question from what an award is
 * given for. Stored on the applicant by slug.
 */
export const STALL_CATEGORIES: Choice[] = [
  { value: "food-baking", label: "Food / Baking" },
  { value: "beauty-makeup", label: "Beauty / Makeup" },
  { value: "hair-mehndi", label: "Hair / Mehndi" },
  { value: "aari-handmade", label: "Aari / Handmade" },
  { value: "resin-crafts-gifts", label: "Resin / Crafts / Gifts" },
  { value: "jewellery", label: "Jewellery" },
  { value: "boutique-clothing", label: "Boutique / Clothing" },
  { value: "skincare-soap", label: "Skincare / Soap" },
  { value: "home-based-business", label: "Home-Based Business" },
  { value: "digital-creative-services", label: "Digital / Creative Services" },
  { value: "other", label: "Other" },
];

/** Q12, multiple choice. */
export const STALL_GOALS: Choice[] = [
  { value: "brand-awareness", label: "Brand Awareness" },
  { value: "customer-reach", label: "Customer Reach" },
  { value: "product-sales", label: "Product Sales" },
  { value: "networking", label: "Networking" },
  { value: "business-promotion", label: "Business Promotion" },
  { value: "other", label: "Other" },
];

const labelOf = (choices: Choice[], value: string) =>
  choices.find((c) => c.value === value)?.label ?? value;

export const stallCategoryLabel = (slug: string | null) =>
  slug ? labelOf(STALL_CATEGORIES, slug) : null;

export const stallGoalLabels = (slugs: string[] | null) =>
  (slugs ?? []).map((slug) => labelOf(STALL_GOALS, slug));
