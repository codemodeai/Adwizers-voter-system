import type { CategoryVotingState } from "@/lib/voting";

type Copy = { icon: string; title: string; body: string };

/**
 * What a visitor is told about voting, from the switches the dashboard sets
 * (Final Plan section 10, manual variant).
 *
 * Shown on a nominee's personal page, the only place a vote is cast. Every
 * branch is careful never to imply a vote can be cast when none can.
 */
const NOMINEE: Record<CategoryVotingState, Copy> = {
  not_started: {
    icon: "\u{1F5F3}\u{FE0F}",
    title: "Voting has not opened yet.",
    body: "Save this page — when voting opens, you can vote for her right here.",
  },
  open: {
    icon: "\u{1F5F3}\u{FE0F}",
    title: "Voting is open.",
    body: "Fill in your details below and submit to vote for her. One vote per person.",
  },
  paused: {
    icon: "\u{23F8}\u{FE0F}",
    title: "Voting is paused.",
    body: "The organisers have paused voting for the moment. Please check back shortly.",
  },
  category_paused: {
    icon: "\u{23F8}\u{FE0F}",
    title: "Voting is paused for this category.",
    body: "Please check back shortly — her page stays up.",
  },
  stopped: {
    icon: "\u{1F512}",
    title: "Voting has closed.",
    body: "Thank you for your support. Winners are announced by the organisers once the results are confirmed.",
  },
  hidden: {
    icon: "\u{1F512}",
    title: "This page is closed.",
    body: "Voting is not running for this category.",
  },
};

export function VotingNotice({ state }: { state: CategoryVotingState }) {
  const { icon, title, body } = NOMINEE[state];

  return (
    <div
      className="mx-auto mt-6 flex max-w-lg items-start gap-3 rounded-xl border border-gold/30
                 bg-gold/10 px-4 py-3.5 text-left"
    >
      <span aria-hidden="true" className="mt-0.5 text-base">
        {icon}
      </span>
      <p className="text-[13px] leading-relaxed text-ink">
        <strong className="font-semibold text-heading">{title}</strong> {body}
      </p>
    </div>
  );
}
