"use client";

import Image from "next/image";
import { useActionState, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  updateApplicant,
  updateLogo,
} from "@/app/admin/(dashboard)/applicants/[id]/actions";
import {
  EMPTY_EDIT_STATE,
  EMPTY_LOGO_STATE,
} from "@/app/admin/(dashboard)/applicants/[id]/state";
import { FeeBadge, formatFee } from "@/components/admin/FeeBadge";
import { Button } from "@/components/ui/Button";
import { Field, Label, inputClass, selectClass, textareaClass } from "@/components/ui/Field";
import { STALL_CATEGORIES, STALL_GOALS } from "@/lib/carnival";
import { LogoField, type LogoFieldHandle } from "@/components/ui/LogoField";
import {
  APPLICANT_STATUSES,
  STATUS_LABEL,
  type ApplicantWithCategory,
  type Category,
} from "@/lib/types";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:px-8">
      {pending ? "Saving…" : "Save changes"}
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

/** Consent checkboxes are a legal record of what the applicant agreed to at
 *  submission time, so they are shown read-only rather than made editable. */
function ConsentRow({ label, at }: { label: string; at: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-charcoal">{label}</span>
      {at ? (
        <span className="shrink-0 text-right text-[12px] font-medium text-gold-champagne">
          Accepted
          <span className="block font-normal text-ink-muted">
            {new Date(at).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
      ) : (
        <span className="shrink-0 text-[12px] font-medium text-ink-muted">Not given</span>
      )}
    </div>
  );
}

export function ApplicantEditor({
  applicant: a,
  categories,
  logoUrl,
  originalUrl,
}: {
  applicant: ApplicantWithCategory;
  categories: Category[];
  logoUrl: string | null;
  /** The uncropped file a crop was made from, when one is still on file. */
  originalUrl: string | null;
}) {
  const [state, formAction] = useActionState(updateApplicant, EMPTY_EDIT_STATE);
  const [logoState, logoAction] = useActionState(updateLogo, EMPTY_LOGO_STATE);
  // Cropping the photo already on file goes through the same field the picker
  // feeds, so either route ends at the one "Replace photo" submit.
  const logoField = useRef<LogoFieldHandle>(null);
  const err = state.fieldErrors ?? {};

  // A stall booking answers a different set of questions, so the panels below
  // swap rather than showing an award form full of blanks.
  const isStall = a.form_type === "stall";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="id" value={a.id} />

        {state.status === "saved" && <Notice tone="ok">{state.message}</Notice>}
        {state.status === "error" && <Notice tone="error">{state.message}</Notice>}

        <Panel title="Contact">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full Name" htmlFor="full_name" required error={err.full_name}>
              <input
                id="full_name"
                name="full_name"
                defaultValue={a.full_name}
                className={inputClass}
              />
            </Field>
            <Field
              label="WhatsApp Number"
              htmlFor="whatsapp_number"
              required
              error={err.whatsapp_number}
            >
              <input
                id="whatsapp_number"
                name="whatsapp_number"
                defaultValue={a.whatsapp_number}
                className={inputClass}
              />
            </Field>
            {!isStall && (
              <Field
                label="Email"
                htmlFor="email"
                required
                error={err.email}
                hint="Nominee notification is sent here."
              >
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={a.email ?? ""}
                  className={inputClass}
                />
              </Field>
            )}
            <Field
              label="Area / Location"
              htmlFor="area_location"
              required
              error={err.area_location}
            >
              <input
                id="area_location"
                name="area_location"
                defaultValue={a.area_location}
                className={inputClass}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Business">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Business / Brand Name"
              htmlFor="business_name"
              required
              error={err.business_name}
            >
              <input
                id="business_name"
                name="business_name"
                defaultValue={a.business_name}
                className={inputClass}
              />
            </Field>
            {isStall ? (
              <Field
                label="Stall Category"
                htmlFor="stall_category"
                required
                error={err.stall_category}
                hint="Each category carries one stall."
              >
                <select
                  id="stall_category"
                  name="stall_category"
                  defaultValue={a.stall_category ?? ""}
                  className={selectClass}
                >
                  {STALL_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Profession" htmlFor="profession" required error={err.profession}>
                  <input
                    id="profession"
                    name="profession"
                    defaultValue={a.profession}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Award Category"
                  htmlFor="category_id"
                  required
                  error={err.category_id}
                >
                  <select
                    id="category_id"
                    name="category_id"
                    defaultValue={a.category_id === null ? "" : String(a.category_id)}
                    className={selectClass}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.is_active ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label='If "Other" — specify'
                  htmlFor="category_other"
                  hint="Only used when the category is Other."
                >
                  <input
                    id="category_other"
                    name="category_other"
                    defaultValue={a.category_other ?? ""}
                    className={inputClass}
                  />
                </Field>
              </>
            )}
            <Field label="Years in Business" htmlFor="years_in_business">
              <input
                id="years_in_business"
                name="years_in_business"
                defaultValue={a.years_in_business ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
        </Panel>

        {isStall ? (
          <Panel title="Stall">
            <div className="space-y-5">
              <Field label="About the Business" htmlFor="business_about">
                <textarea
                  id="business_about"
                  name="business_about"
                  defaultValue={a.business_about ?? ""}
                  className={textareaClass}
                />
              </Field>
              <Field
                label="Products / Services at the Stall"
                htmlFor="stall_products"
                hint="What she will display or sell on the day."
              >
                <textarea
                  id="stall_products"
                  name="stall_products"
                  defaultValue={a.stall_products ?? ""}
                  className={textareaClass}
                />
              </Field>
              <Field
                label="Special Requirements"
                htmlFor="stall_requirements"
                hint="Power, extra space, refrigeration -- whatever the stall needs."
              >
                <textarea
                  id="stall_requirements"
                  name="stall_requirements"
                  defaultValue={a.stall_requirements ?? ""}
                  className={textareaClass}
                />
              </Field>
              <fieldset className="space-y-2">
                <Label>What she wants from the carnival</Label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {STALL_GOALS.map((goal) => (
                    <label
                      key={goal.value}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border
                                 border-line bg-canvas px-3.5 py-2 text-[13px] text-charcoal
                                 transition-colors has-checked:border-magenta-royal/50
                                 has-checked:bg-magenta-soft"
                    >
                      <input
                        type="checkbox"
                        name="stall_goals"
                        value={goal.value}
                        defaultChecked={(a.stall_goals ?? []).includes(goal.value)}
                        className="size-4 shrink-0 accent-magenta-royal"
                      />
                      {goal.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </Panel>
        ) : (
          <Panel title="Story">
            <div className="space-y-5">
              <Field label="Business Journey" htmlFor="business_journey">
                <textarea
                  id="business_journey"
                  name="business_journey"
                  defaultValue={a.business_journey ?? ""}
                  className={textareaClass}
                />
              </Field>
              <Field label="Proudest Achievement" htmlFor="proudest_achievement">
                <textarea
                  id="proudest_achievement"
                  name="proudest_achievement"
                  defaultValue={a.proudest_achievement ?? ""}
                  className={textareaClass}
                />
              </Field>
            </div>
          </Panel>
        )}

        <Panel title="Links">
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["social_instagram", "Instagram", a.social_instagram],
                ["social_facebook", "Facebook", a.social_facebook],
                ["social_website", "Website", a.social_website],
                ["social_whatsapp", "WhatsApp Link", a.social_whatsapp],
              ] as const
            ).map(([name, label, value]) => (
              <Field
                key={name}
                label={label}
                htmlFor={name}
                hint={
                  value ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-magenta-royal underline underline-offset-2"
                    >
                      Open link
                    </a>
                  ) : undefined
                }
              >
                <input id={name} name={name} defaultValue={value ?? ""} className={inputClass} />
              </Field>
            ))}
          </div>
        </Panel>

        <Panel title="Workflow">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Status"
                htmlFor="status"
                hint="Payment is collected offline; mark it here once received."
              >
                <select
                  id="status"
                  name="status"
                  defaultValue={a.status}
                  className={selectClass}
                >
                  {APPLICANT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>

              {!isStall && (
              <Field label="Interested in Nomination" htmlFor="interested_in_nomination">
                <select
                  id="interested_in_nomination"
                  name="interested_in_nomination"
                  defaultValue={a.interested_in_nomination ?? ""}
                  className={selectClass}
                >
                  <option value="yes">Yes</option>
                  <option value="maybe">Maybe</option>
                </select>
              </Field>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm text-charcoal">
              <input
                type="checkbox"
                name="wants_whatsapp_updates"
                defaultChecked={a.wants_whatsapp_updates}
                className="size-4.5 accent-magenta-royal"
              />
              Wants WhatsApp updates
            </label>

            <Field
              label="Internal Notes"
              htmlFor="admin_notes"
              hint="Admin-only. Never shown publicly."
            >
              <textarea
                id="admin_notes"
                name="admin_notes"
                defaultValue={a.admin_notes ?? ""}
                className={textareaClass}
                placeholder="Payment reference, follow-ups, anything the team should know…"
              />
            </Field>
          </div>
        </Panel>

        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] text-ink-muted">
            Last updated{" "}
            {new Date(a.updated_at).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <SaveBar />
        </div>
      </form>

      <aside className="space-y-5 lg:sticky lg:top-6">
        <Panel title="Photo">
          <div className="space-y-4">
            {logoUrl ? (
              <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-canvas">
                <Image
                  src={logoUrl}
                  alt={`${a.business_name} logo or product photo`}
                  fill
                  sizes="20rem"
                  unoptimized
                  className="object-cover"
                />
                {/* Cards, lists and the winners page all show this square, so a
                  * tall phone portrait loses its top and bottom unless someone
                  * chooses what stays. */}
                <button
                  type="button"
                  onClick={() => logoField.current?.cropFromUrl(logoUrl)}
                  className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5
                             rounded-lg border border-line bg-surface/90 px-3 py-1.5 text-[13px]
                             font-semibold text-heading shadow-sm backdrop-blur-sm
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
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-line bg-canvas text-center text-[13px] text-ink-muted">
                No photo submitted
              </div>
            )}

            {logoState.status === "saved" && <Notice tone="ok">{logoState.message}</Notice>}
            {logoState.status === "error" && <Notice tone="error">{logoState.message}</Notice>}

            <form action={logoAction} className="space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="intent" value="replace" />
              {/* Same browser-side downscale as the public form, so an admin
                * re-uploading a phone photo does not trip the body limit. */}
              <LogoField id={`logo-${a.id}`} aspect={1} ref={logoField} />
              <Button type="submit" variant="secondary" className="w-full">
                {logoUrl ? "Replace photo" : "Upload photo"}
              </Button>
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Cards show this photo as a square. Crop it here to choose what stays inside
                that square, then save with the button above.
              </p>
            </form>

            {originalUrl && (
              <div className="space-y-1.5">
                <form action={logoAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="intent" value="restore" />
                  <Button type="submit" variant="secondary" className="w-full">
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

            {logoUrl && (
              <form action={logoAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="intent" value="remove" />
                <Button type="submit" variant="danger" className="w-full">
                  Remove photo
                </Button>
              </form>
            )}
          </div>
        </Panel>

        <Panel title="Fee Agreement">
          {a.fee_agreed_at ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-bold text-purple-royal">
                  {formatFee(a.fee_amount_inr)}
                </span>
                <FeeBadge agreedAt={a.fee_agreed_at} amount={a.fee_amount_inr} />
              </div>
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Agreed to pay on{" "}
                {new Date(a.fee_agreed_at).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                , at the price shown on the form that day.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <FeeBadge agreedAt={null} />
              <p className="text-[12px] leading-relaxed text-ink-muted">
                No fee agreement on record. This entry was submitted before the fee step was
                added to the form, so this applicant was never asked to agree to it -- worth
                confirming with them before treating the fee as owed.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Consent Record">
          <div className="divide-y divide-line">
            {!isStall && (
              <ConsentRow label="Nomination declaration" at={a.nomination_declaration_at} />
            )}
            <ConsentRow label="Terms &amp; conditions" at={a.terms_accepted_at} />
            <ConsentRow label="Communication consent" at={a.communication_consent_at} />
            <ConsentRow label="Payment received" at={a.payment_received_at} />
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
            Consent timestamps are the record of what was agreed at submission, so they are not
            editable.
          </p>
        </Panel>
      </aside>
    </div>
  );
}
