"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createCategory } from "@/app/admin/(dashboard)/categories/actions";
import {
  EMPTY_CATEGORY_FORM_STATE,
  slugify,
} from "@/app/admin/(dashboard)/categories/state";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="px-5 py-2.5">
      {pending ? "Adding…" : "Add category"}
    </Button>
  );
}

/**
 * Adds a category (Final Plan section 5).
 *
 * Collapsed behind a button because the plan locks the fourteen categories for
 * this cycle (section 15) -- adding one is a deliberate departure, not
 * something to invite from an open form at the top of the screen.
 */
export function NewCategoryForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, action] = useActionState(createCategory, EMPTY_CATEGORY_FORM_STATE);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold text-magenta-royal hover:underline"
      >
        + Add a category
      </button>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[14rem] flex-1 space-y-1.5">
          <span className="block text-sm font-medium text-heading">Category name</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Photography"
            className={inputClass}
          />
          <span className="block text-[13px] text-ink-muted">
            Link will be /vote/
            <span className="font-medium text-charcoal">{slugify(name) || "…"}</span>
          </span>
        </label>

        <div className="flex items-center gap-2 pb-6">
          <Submit />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-muted hover:bg-canvas"
          >
            Cancel
          </button>
        </div>
      </div>

      {state.status !== "idle" && (
        <p
          role="status"
          className={`mt-1 text-[13px] font-medium ${
            state.status === "saved" ? "text-gold-champagne" : "text-magenta-dark"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
