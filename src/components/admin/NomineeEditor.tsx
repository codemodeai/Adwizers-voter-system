"use client";

import Image from "next/image";
import { useActionState, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  updateNominee,
  updateNomineePhoto,
} from "@/app/admin/(dashboard)/nominees/[id]/actions";
import {
  EMPTY_NOMINEE_EDIT_STATE,
  EMPTY_NOMINEE_PHOTO_STATE,
} from "@/app/admin/(dashboard)/nominees/[id]/state";
import { Button } from "@/components/ui/Button";
import { Field, Label, inputClass, selectClass, textareaClass } from "@/components/ui/Field";
import { LogoField, type LogoFieldHandle } from "@/components/ui/LogoField";
import type { Category, NomineeWithCategory } from "@/lib/types";

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      {hint && <p className="mt-1 text-[13px] text-ink-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:px-8">
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}

function Notice({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  const style =
    tone === "ok"
      ? "border-gold-champagne/30 bg-gold-soft text-gold-champagne"
      : "border-magenta-royal/25 bg-magenta-soft text-magenta-dark";
  return (
    <div role="status" className={`rounded-lg border px-3.5 py-2.5 text-sm font-medium ${style}`}>
      {children}
    </div>
  );
}

/**
 * The nominee's own edit screen (Final Plan section 4) -- "separate from the
 * original Applicant submission ... without touching the original form data".
 *
 * Everything on this form writes to the nominees table only. The original entry
 * is one click away in the header for reference, and is never modified from
 * here; that separation is the reason the two tables exist.
 */
export function NomineeEditor({
  nominee,
  categories,
  photoUrl,
  originalUrl,
}: {
  nominee: NomineeWithCategory;
  categories: Category[];
  photoUrl: string | null;
  /** The uncropped file a crop made here was taken from, when one is on file. */
  originalUrl: string | null;
}) {
  const [state, action] = useActionState(updateNominee, EMPTY_NOMINEE_EDIT_STATE);
  const [photoState, photoAction] = useActionState(
    updateNomineePhoto,
    EMPTY_NOMINEE_PHOTO_STATE,
  );
  // The card is a square, so the crop that decides what voters see belongs on
  // this screen too -- not only on the original entry.
  const photoField = useRef<LogoFieldHandle>(null);

  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <Panel
        title="Card photo"
        hint="Shown on the category voting page. Replacing it here leaves her original upload on the entry untouched."
      >
        <div className="flex flex-wrap items-start gap-5">
          <div className="shrink-0 space-y-2">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt=""
                aria-hidden="true"
                width={128}
                height={128}
                unoptimized
                className="rounded-xl object-cover ring-1 ring-line"
                style={{ width: 128, height: 128 }}
              />
            ) : (
              <span
                style={{ width: 128, height: 128 }}
                className="flex items-center justify-center rounded-xl bg-purple-soft
                           px-3 text-center text-[12px] font-medium text-purple-royal
                           ring-1 ring-purple-royal/10"
              >
                No photo
              </span>
            )}

            {photoUrl && (
              <button
                type="button"
                onClick={() => photoField.current?.cropFromUrl(photoUrl)}
                style={{ width: 128 }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border
                           border-line px-2 py-1.5 text-[13px] font-medium text-ink
                           transition-colors hover:border-accent/40 hover:text-accent"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-3.5">
                  <path
                    d="M5.5 1.5v13h13M1.5 5.5h13v13"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Crop
              </button>
            )}
          </div>

          <div className="flex min-w-[15rem] flex-1 flex-col gap-3">
            <form action={photoAction} className="space-y-3">
              <input type="hidden" name="id" value={nominee.id} />
              <input type="hidden" name="intent" value="replace" />
              {/* Same field as the public form and the entry screen: downscales
                * in the browser, and crops to the square the card renders. */}
              <LogoField name="photo" id={`photo-${nominee.id}`} aspect={1} ref={photoField} />
              <Button type="submit" variant="secondary" className="w-full sm:w-auto sm:px-6">
                {photoUrl ? "Replace photo" : "Upload photo"}
              </Button>
            </form>

            {originalUrl && (
              <div className="space-y-1.5">
                <form action={photoAction}>
                  <input type="hidden" name="id" value={nominee.id} />
                  <input type="hidden" name="intent" value="restore" />
                  <Button type="submit" variant="secondary" className="w-full sm:w-auto sm:px-6">
                    Restore original photo
                  </Button>
                </form>
                <p className="text-[12px] leading-relaxed text-ink-muted">
                  Puts back the full, uncropped photo this crop was made from.{" "}
                  <a
                    href={originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-magenta-royal underline underline-offset-2"
                  >
                    View it first
                  </a>
                  .
                </p>
              </div>
            )}

            {nominee.photo_path && (
              <form action={photoAction}>
                <input type="hidden" name="id" value={nominee.id} />
                <input type="hidden" name="intent" value="remove" />
                <button
                  type="submit"
                  className="text-[13px] font-medium text-magenta-royal underline underline-offset-2"
                >
                  Remove photo
                </button>
              </form>
            )}

            {photoState.status !== "idle" && (
              <Notice tone={photoState.status === "saved" ? "ok" : "error"}>
                {photoState.message}
              </Notice>
            )}
          </div>
        </div>
      </Panel>

      <form action={action} className="space-y-5">
        <input type="hidden" name="id" value={nominee.id} />

        <Panel title="Public profile" hint="This is exactly what voters read on her card.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name on the card" htmlFor="display_name" required error={errors.display_name}>
              <input
                id="display_name"
                name="display_name"
                defaultValue={nominee.display_name}
                className={inputClass}
              />
            </Field>

            <Field
              label="Business / brand"
              htmlFor="business_name"
              required
              error={errors.business_name}
            >
              <input
                id="business_name"
                name="business_name"
                defaultValue={nominee.business_name}
                className={inputClass}
              />
            </Field>

            <Field label="Category" htmlFor="category_id" required error={errors.category_id}>
              <select
                id="category_id"
                name="category_id"
                defaultValue={String(nominee.category_id)}
                className={selectClass}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.is_active ? "" : " (hidden)"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Area / location" htmlFor="area_location">
              <input
                id="area_location"
                name="area_location"
                defaultValue={nominee.area_location ?? ""}
                className={inputClass}
              />
            </Field>

            <Field
              label="Short bio"
              htmlFor="bio"
              className="sm:col-span-2"
              hint="Seeded from her business journey answer. Two or three sentences reads best on a card."
            >
              <textarea
                id="bio"
                name="bio"
                defaultValue={nominee.bio ?? ""}
                className={textareaClass}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Links">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram" htmlFor="social_instagram">
              <input
                id="social_instagram"
                name="social_instagram"
                defaultValue={nominee.social_instagram ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="Facebook" htmlFor="social_facebook">
              <input
                id="social_facebook"
                name="social_facebook"
                defaultValue={nominee.social_facebook ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="Website" htmlFor="social_website">
              <input
                id="social_website"
                name="social_website"
                defaultValue={nominee.social_website ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="WhatsApp" htmlFor="social_whatsapp">
              <input
                id="social_whatsapp"
                name="social_whatsapp"
                defaultValue={nominee.social_whatsapp ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Visibility">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={nominee.is_published}
              className="mt-0.5 size-4 rounded border-line text-magenta-royal
                         focus:ring-magenta-royal/30"
            />
            <span>
              <Label>Show this nominee on her category&rsquo;s voting page</Label>
              <span className="mt-0.5 block text-[13px] text-ink-muted">
                Unticking hides the card without deleting anything — her profile, her original
                entry, and any votes stay exactly as they are.
              </span>
            </span>
          </label>
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <SaveBar />
          {state.status !== "idle" && (
            <Notice tone={state.status === "saved" ? "ok" : "error"}>{state.message}</Notice>
          )}
        </div>
      </form>
    </div>
  );
}
