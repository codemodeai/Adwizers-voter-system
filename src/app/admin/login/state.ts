/** `email` carries whatever was typed in the ID field, echoed back on failure. */
export type LoginState = { error?: string; email?: string };

export const EMPTY_LOGIN_STATE: LoginState = {};
