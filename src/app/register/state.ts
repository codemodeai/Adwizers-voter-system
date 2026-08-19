export type RegisterState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so a rejected submission does not wipe what was typed. */
  values?: Record<string, string>;
};

export const EMPTY_REGISTER_STATE: RegisterState = { status: "idle" };
