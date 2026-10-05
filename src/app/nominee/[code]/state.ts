/** One nominee's outcome in a submission. Section 6: a batch is not
 *  all-or-nothing -- some get recorded while others are skipped. */
export type VoteOutcome = {
  nomineeId: string;
  name: string;
  /** "recorded" carries a receipt; "already" means this mobile number or
   *  email already has a vote for this nominee. */
  status: "recorded" | "already" | "failed";
  voteRef?: string;
};

export type VoteState =
  | { status: "idle" }
  | { status: "done"; outcomes: VoteOutcome[] }
  | { status: "error"; message: string; field?: "selection" | "details" };

export const EMPTY_VOTE_STATE: VoteState = { status: "idle" };
