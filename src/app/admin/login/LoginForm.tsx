"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { signIn } from "./actions";
import { EMPTY_LOGIN_STATE } from "./state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full py-2.5">
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(signIn, EMPTY_LOGIN_STATE);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-magenta-royal/25 bg-magenta-soft px-3.5 py-2.5
                     text-sm font-medium text-magenta-dark"
        >
          {state.error}
        </div>
      )}

      <Field label="Email" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={state.email}
          autoComplete="email"
          required
          className={inputClass}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
