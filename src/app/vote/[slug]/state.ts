/** One nominee's outcome in a submission. Section 6: a batch is not
 *  all-or-nothing -- some get recorded while others are skipped. */
export type VoteOutcome = {
  nomineeId: string;
  name: string;
  /** "recorded" carries a receipt; "already" means one of the three signals
   *  matched an existing vote for this nominee. */
  status: "recorded" | "already" | "failed";
  voteRef?: string;
};

export type VoteState =
  | { status: "idle" }
  /** The code has been emailed; the form is waiting for it. */
  | { status: "code_sent"; email: string; message?: string }
  | { status: "done"; outcomes: VoteOutcome[] }
  | { status: "error"; message: string; field?: "selection" | "details" | "code" };

export const EMPTY_VOTE_STATE: VoteState = { status: "idle" };
