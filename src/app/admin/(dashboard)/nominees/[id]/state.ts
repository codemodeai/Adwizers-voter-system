export type NomineeEditState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const EMPTY_NOMINEE_EDIT_STATE: NomineeEditState = { status: "idle" };

export type NomineePhotoState = { status: "idle" | "saved" | "error"; message?: string };

export const EMPTY_NOMINEE_PHOTO_STATE: NomineePhotoState = { status: "idle" };
