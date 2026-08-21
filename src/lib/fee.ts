/**
 * The registration fee, and everything it buys -- kept in one place because
 * the same numbers appear on the entry form today and will appear on the
 * nominee side and in admin later. Changing the price here changes it
 * everywhere it is shown; `REGISTRATION_FEE_INR` is also what gets recorded
 * against each applicant, so old rows keep the price they actually agreed to.
 *
 * Source: the AWE Awards 2026 registration poster.
 */
export const REGISTRATION_FEE_INR = 1499;

/** Formatted for display. Written out rather than computed so the rupee sign
 *  and the grouping never depend on the visitor's locale. */
export const REGISTRATION_FEE_DISPLAY = "₹1,499";

export type FeeInclusion = { title: string; detail: string };

export const FEE_INCLUDES: FeeInclusion[] = [
  {
    title: "Award Nomination",
    detail: "Get officially nominated in your chosen category.",
  },
  {
    title: "Event Entry Pass",
    detail: "Access the grand award function with your entry pass.",
  },
  {
    title: "Digital Nominee Profile",
    detail: "Your business or talent featured in our official digital nominee profile.",
  },
  {
    title: "Nominee Spotlight",
    detail: "A special spotlight post on our Instagram.",
  },
  {
    title: "Online Voting Opportunity",
    detail: "Share your voting link and collect votes from your supporters.",
  },
  {
    title: "Professional Event Photos",
    detail: "High quality professional photographs from the event.",
  },
  {
    title: "Government Schemes & Opportunities",
    detail: "Awareness of useful schemes, grants and opportunities for women entrepreneurs.",
  },
  {
    title: "Networking & AWE Community",
    detail: "Connect with women entrepreneurs and become part of the AWE community.",
  },
  {
    title: "Participant Gift",
    detail: "A small token of appreciation for taking part.",
  },
  {
    title: "Digital Nominee Badge",
    detail: "Use your nominee badge on your own social profiles.",
  },
  {
    title: "Nominee ID",
    detail: "Official nominee ID badge for the event.",
  },
  {
    title: "Refreshments & Snacks",
    detail: "Refreshments and snacks served through the event.",
  },
  {
    title: "Nominee Promotion",
    detail: "We promote every nominee across our social platforms.",
  },
];

export type WinnerTier = { place: string; award: string };

export const WINNER_TIERS: WinnerTier[] = [
  { place: "1st Winner", award: "Award + Certificate" },
  { place: "2nd to 5th Winners", award: "Nomination Shield + Certificate" },
];
