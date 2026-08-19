export type EditState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const EMPTY_EDIT_STATE: EditState = { status: "idle" };

export type LogoState = { status: "idle" | "saved" | "error"; message?: string };

export const EMPTY_LOGO_STATE: LogoState = { status: "idle" };
