export type CarnivalState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so a rejected submission does not wipe what was typed. */
  values?: Record<string, string>;
  /** Multi-answer questions need their own echo. */
  goals?: string[];
};

export const EMPTY_CARNIVAL_STATE: CarnivalState = { status: "idle" };
