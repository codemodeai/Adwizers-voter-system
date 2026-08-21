export type SettingsFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

export const EMPTY_SETTINGS_FORM_STATE: SettingsFormState = { status: "idle" };
