export type VotingFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

export const EMPTY_VOTING_FORM_STATE: VotingFormState = { status: "idle" };
