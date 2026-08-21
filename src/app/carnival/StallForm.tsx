"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Arrow } from "@/components/ui/Arrow";
import { Button } from "@/components/ui/Button";
import { CheckboxRow } from "@/components/ui/CheckboxRow";
import {
  Field,
  Label,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/ui/Field";
import { checkLink, LinkField } from "@/components/ui/LinkField";
import { LogoField } from "@/components/ui/LogoField";
import { Stepper } from "@/components/ui/Stepper";
import {
  CARNIVAL_EVENT,
  STALL_CATEGORIES,
  STALL_EXTRA_VALUE,
  STALL_FEE_DISPLAY,
  STALL_GOALS,
  STALL_INCLUDES,
} from "@/lib/carnival";
import { ACCEPTED_LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/validation/applicant";
import { submitStallBooking } from "./actions";
import { EMPTY_CARNIVAL_STATE } from "./state";

type Errors = Record<string, string>;

const STEPS = [
  {
    title: "About You",
    description: "How we reach you about your stall.",
    image: "/steps/step-1.jpg",
    caption: "Every stall starts with a name.",
    fields: ["fullName", "whatsappNumber", "areaLocation"],
  },
  {
    title: "Your Business",
    description: "What you do, and which space you belong in.",
    image: "/steps/step-2.jpg",
    caption: "The thing you built, in your own words.",
    fields: ["businessName", "businessAbout", "stallCategory", "yearsInBusiness"],
  },
  {
    title: "Your Stall",
    description: "What you will bring on the day, and what you need from us.",
    image: "/steps/step-3.jpg",
    caption: "What the table will hold.",
    fields: ["stallProducts", "stallRequirements", "stallGoals"],
  },
  {
    title: "Links & Photo",
    description: "Shown when we promote the carnival line-up.",
    image: "/steps/step-4.jpg",
    caption: "How the crowd will find you.",
    fields: ["socialInstagram", "socialFacebook", "socialWebsite", "socialWhatsapp", "logo"],
  },
  {
    title: "Stall Fee & Agreement",
    description: `What the ${STALL_FEE_DISPLAY} business space covers.`,
    image: "/steps/success.jpg",
    caption: "What the space brings with it.",
    fields: ["feeAgreed"],
  },
  {
    title: "Confirm & Book",
    description: "The last few details, then your space is requested.",
    image: "/steps/step-5.jpg",
    caption: "One last look, then it is with us.",
    fields: ["termsAccepted", "communicationConsent"],
  },
];

/** Which step owns each field, so a server-side error can jump the user back. */
const FIELD_STEP: Record<string, number> = Object.fromEntries(
  STEPS.flatMap((step, i) => step.fields.map((f) => [f, i])),
);

/**
 * Client-side mirror of the Zod rules, run per step so nobody reaches the end
 * only to be bounced. The server still re-validates everything on submit.
 */
function validateStep(index: number, fd: FormData): Errors {
  const errors: Errors = {};
  const value = (name: string) => String(fd.get(name) ?? "").trim();

  const require = (name: string, message: string) => {
    if (!value(name)) errors[name] = message;
  };

  if (index === 0) {
    require("fullName", "Full name is required");
    require("areaLocation", "Area / location is required");

    const phone = value("whatsappNumber");
    const digits = phone.replace(/\D/g, "");
    if (!phone) errors.whatsappNumber = "WhatsApp number is required";
    else if (digits.length < 10 || digits.length > 15)
      errors.whatsappNumber = "Enter a valid WhatsApp number (10-15 digits)";
  }

  if (index === 1) {
    require("businessName", "Business / brand name is required");
    require("stallCategory", "Please choose your business category");
  }

  if (index === 3) {
    for (const [name, kind] of [
      ["socialInstagram", "instagram"],
      ["socialFacebook", "facebook"],
      ["socialWebsite", "website"],
      ["socialWhatsapp", "whatsapp"],
    ] as const) {
      const check = checkLink(value(name), kind);
      if (check.state === "error") errors[name] = check.message!;
    }

    const file = fd.get("logo");
    if (file instanceof File && file.size > 0) {
      if (!ACCEPTED_LOGO_TYPES.includes(file.type as (typeof ACCEPTED_LOGO_TYPES)[number]))
        errors.logo = "Upload a JPG, PNG, or WebP image";
      else if (file.size > MAX_LOGO_BYTES) errors.logo = "Image must be 5 MB or smaller";
    }
  }

  if (index === 4 && fd.get("feeAgreed") !== "on") {
    errors.feeAgreed = `Please confirm you agree to pay the ${STALL_FEE_DISPLAY} stall fee`;
  }

  if (index === 5) {
    if (fd.get("termsAccepted") !== "on")
      errors.termsAccepted = "Please accept the terms & conditions";
    if (fd.get("communicationConsent") !== "on")
      errors.communicationConsent = "Please accept the communication consent";
  }

  return errors;
}

/**
 * Left rail. The images are stacked and cross-faded rather than swapped, so
 * moving between steps reads as one continuous scene instead of a reload.
 */
function ImagePanel({ step }: { step: number }) {
  return (
    <div className="noise noise-strong relative isolate h-40 overflow-hidden bg-purple-royal sm:h-52 md:h-auto">
      {STEPS.map((s, i) => (
        <Image
          key={s.title}
          src={s.image}
          alt=""
          aria-hidden="true"
          fill
          priority={i === 0}
          sizes="(min-width: 768px) 42vw, 100vw"
          className={
            "object-cover object-[center_28%] transition-all duration-[900ms] ease-out md:object-center " +
            (i === step ? "scale-100 opacity-100" : "scale-105 opacity-0")
          }
        />
      ))}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#0f0016] via-[#0f0016]/25 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-purple-royal/45 via-transparent to-magenta-royal/25"
      />

      <div className="relative z-10 hidden h-full flex-col justify-end p-5 md:flex md:p-7 lg:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
          Step {step + 1} — {STEPS[step].title}
        </p>
        <p
          key={step}
          className="mt-2.5 max-w-[16rem] animate-rise text-[22px] font-semibold leading-snug text-white"
        >
          {STEPS[step].caption}
        </p>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto sm:min-w-44 sm:py-2.5">
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
          Booking…
        </>
      ) : (
        <>
          Book My Space
          <Arrow />
        </>
      )}
    </Button>
  );
}

export function StallForm() {
  const [state, formAction] = useActionState(submitStallBooking, EMPTY_CARNIVAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [clientErrors, setClientErrors] = useState<Errors>({});

  const v = state.values ?? {};
  const chosenGoals = state.goals ?? [];

  const errors: Errors = { ...(state.fieldErrors ?? {}), ...clientErrors };
  const isLast = step === STEPS.length - 1;

  // A rejected submit should land on the step that actually has the problem.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error" && state.fieldErrors) {
      const target = Math.min(
        ...Object.keys(state.fieldErrors).map((key) => FIELD_STEP[key] ?? STEPS.length),
      );
      if (target < STEPS.length) {
        setStep(target);
        setFurthest((f) => Math.max(f, target));
      }
    }
  }

  function goTo(next: number) {
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    setClientErrors({});
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNext() {
    if (!formRef.current) return;
    const found = validateStep(step, new FormData(formRef.current));
    if (Object.keys(found).length > 0) {
      setClientErrors(found);
      return;
    }
    goTo(step + 1);
  }

  const active = STEPS[step];
  const panel = "animate-step-in";

  return (
    <div ref={topRef} className="scroll-mt-8">
      <div
        className="grid overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl
                   shadow-black/40 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      >
        <ImagePanel step={step} />

        <form
          ref={formRef}
          action={formAction}
          noValidate
          onKeyDown={(e) => {
            const target = e.target as HTMLElement;
            if (e.key === "Enter" && target.tagName !== "TEXTAREA" && !isLast) {
              e.preventDefault();
              handleNext();
            }
          }}
          className="flex min-w-0 flex-col p-5 sm:p-8 lg:p-10"
        >
          <Stepper
            steps={STEPS.map((s) => s.title)}
            current={step}
            furthest={furthest}
            onJump={goTo}
          />

          <header className="mb-5 mt-6 sm:mb-6 sm:mt-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-heading sm:text-2xl">
              {active.title}
            </h2>
            <p className="mt-1.5 text-sm text-ink-muted">{active.description}</p>
          </header>

          {state.formError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3
                         text-sm font-medium text-accent"
            >
              {state.formError}
            </div>
          )}

          <div className="flex-1">
            {/* Every step stays mounted so one submit carries the whole form. */}
            <div className={step === 0 ? `grid gap-4 sm:gap-5 sm:grid-cols-2 ${panel}` : "hidden"}>
              <Field label="Full Name" htmlFor="fullName" required error={errors.fullName}>
                <input
                  id="fullName"
                  name="fullName"
                  defaultValue={v.fullName}
                  autoComplete="name"
                  className={inputClass}
                  placeholder="e.g. Priya Sharma"
                />
              </Field>

              <Field
                label="WhatsApp Number"
                htmlFor="whatsappNumber"
                required
                error={errors.whatsappNumber}
                hint="We use this as your main contact."
              >
                <input
                  id="whatsappNumber"
                  name="whatsappNumber"
                  defaultValue={v.whatsappNumber}
                  inputMode="tel"
                  autoComplete="tel"
                  className={inputClass}
                  placeholder="e.g. +91 98765 43210"
                />
              </Field>

              <Field
                label="Area / Location"
                htmlFor="areaLocation"
                required
                error={errors.areaLocation}
                className="sm:col-span-2"
              >
                <input
                  id="areaLocation"
                  name="areaLocation"
                  defaultValue={v.areaLocation}
                  className={inputClass}
                  placeholder="e.g. Kumbakonam, Thanjavur"
                />
              </Field>
            </div>

            <div className={step === 1 ? `grid gap-4 sm:gap-5 sm:grid-cols-2 ${panel}` : "hidden"}>
              <Field
                label="Business / Brand Name"
                htmlFor="businessName"
                required
                error={errors.businessName}
              >
                <input
                  id="businessName"
                  name="businessName"
                  defaultValue={v.businessName}
                  className={inputClass}
                  placeholder="e.g. Priya's Kitchen"
                />
              </Field>

              <Field label="Years in Business" htmlFor="yearsInBusiness">
                <input
                  id="yearsInBusiness"
                  name="yearsInBusiness"
                  defaultValue={v.yearsInBusiness}
                  className={inputClass}
                  placeholder="e.g. 3 years"
                />
              </Field>

              <Field
                label="Business Category"
                htmlFor="stallCategory"
                required
                error={errors.stallCategory}
                hint="Each category carries only one stall, so this decides which space you take."
                className="sm:col-span-2"
              >
                <select
                  id="stallCategory"
                  name="stallCategory"
                  defaultValue={v.stallCategory ?? ""}
                  className={selectClass}
                >
                  <option value="" disabled>
                    Choose your category
                  </option>
                  {STALL_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="About Your Business"
                htmlFor="businessAbout"
                hint="A few lines on what you make or do."
                className="sm:col-span-2"
              >
                <textarea
                  id="businessAbout"
                  name="businessAbout"
                  defaultValue={v.businessAbout}
                  className={textareaClass}
                  placeholder="What your business is about…"
                />
              </Field>
            </div>

            <div className={step === 2 ? `space-y-4 sm:space-y-5 ${panel}` : "hidden"}>
              <Field
                label="Products / Services at Your Stall"
                htmlFor="stallProducts"
                hint="What you will display or sell on the day."
              >
                <textarea
                  id="stallProducts"
                  name="stallProducts"
                  defaultValue={v.stallProducts}
                  className={textareaClass}
                  placeholder="e.g. Handmade soaps, gift hampers, custom orders…"
                />
              </Field>

              <Field
                label="Special Requirements"
                htmlFor="stallRequirements"
                hint="Anything your stall needs — a power point, extra table space, refrigeration. Leave it empty if nothing comes to mind."
              >
                <textarea
                  id="stallRequirements"
                  name="stallRequirements"
                  defaultValue={v.stallRequirements}
                  className={textareaClass}
                  placeholder="e.g. A plug point for my display lights"
                />
              </Field>

              <fieldset className="space-y-2">
                <Label>What do you want from the carnival?</Label>
                <p className="text-[13px] leading-snug text-ink-muted">
                  Pick as many as apply — it tells us how to promote your stall.
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {STALL_GOALS.map((goal) => (
                    <label
                      key={goal.value}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border
                                 border-line bg-raised px-4 py-2.5 text-sm text-ink
                                 transition-colors hover:border-accent/40
                                 has-checked:border-accent has-checked:bg-accent-soft"
                    >
                      <input
                        type="checkbox"
                        name="stallGoals"
                        value={goal.value}
                        defaultChecked={chosenGoals.includes(goal.value)}
                        className="size-4 shrink-0 accent-accent"
                      />
                      {goal.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className={step === 3 ? `grid gap-4 sm:gap-5 sm:grid-cols-2 ${panel}` : "hidden"}>
              <LinkField
                kind="instagram"
                name="socialInstagram"
                label="Instagram"
                defaultValue={v.socialInstagram}
                serverError={errors.socialInstagram}
              />

              <LinkField
                kind="facebook"
                name="socialFacebook"
                label="Facebook"
                defaultValue={v.socialFacebook}
                serverError={errors.socialFacebook}
              />

              <LinkField
                kind="website"
                name="socialWebsite"
                label="Website"
                defaultValue={v.socialWebsite}
                serverError={errors.socialWebsite}
              />

              <LinkField
                kind="whatsapp"
                name="socialWhatsapp"
                label="WhatsApp Link"
                defaultValue={v.socialWhatsapp}
                serverError={errors.socialWhatsapp}
              />

              <Field
                label="Business / Product Photo"
                htmlFor="logo"
                error={errors.logo}
                hint="JPG, PNG, or WebP. Large photos are resized automatically, so upload straight from your phone."
                className="sm:col-span-2"
              >
                <LogoField />
              </Field>
            </div>

            <div className={step === 4 ? `space-y-6 ${panel}` : "hidden"}>
              <StallFeePanel error={errors.feeAgreed} agreed={v.feeAgreed === "on"} />
            </div>

            <div className={step === 5 ? `space-y-5 sm:space-y-6 ${panel}` : "hidden"}>
              <div className="rounded-xl border border-line bg-raised px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                  Your Space
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">
                  {CARNIVAL_EVENT.date} · {CARNIVAL_EVENT.venue}
                </p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  {CARNIVAL_EVENT.spaces}, and one business to a category — we confirm your
                  space on WhatsApp.
                </p>
              </div>

              <div className="space-y-3 border-t border-line pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                  Declarations
                </p>

                <CheckboxRow
                  name="termsAccepted"
                  title="Terms &amp; Conditions"
                  required
                  error={errors.termsAccepted}
                  defaultChecked={v.termsAccepted === "on"}
                >
                  I confirm the details above are accurate, and I agree to the Adwizers Business
                  Carnival stall booking terms &amp; conditions.
                </CheckboxRow>

                <CheckboxRow
                  name="communicationConsent"
                  title="Communication Consent"
                  required
                  error={errors.communicationConsent}
                  defaultChecked={v.communicationConsent === "on"}
                >
                  I agree to receive updates about my stall booking and the Adwizers Business
                  Carnival on WhatsApp.
                </CheckboxRow>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              className={
                step === 0
                  ? "hidden sm:invisible sm:inline-flex"
                  : "w-full py-3 sm:w-auto sm:py-2.5"
              }
            >
              <Arrow back />
              Previous
            </Button>

            {isLast ? (
              <SubmitButton />
            ) : (
              <Button type="button" onClick={handleNext} className="w-full py-3 sm:w-auto sm:min-w-32 sm:py-2.5">
                Next
                <Arrow />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * The stall fee step. Everything shown comes from `@/lib/carnival`, so the
 * price and what it covers cannot drift from the rest of the carnival.
 */
function StallFeePanel({ error, agreed }: { error?: string; agreed: boolean }) {
  return (
    <>
      <div className="rounded-2xl border border-accent/35 bg-accent-soft px-5 py-6 text-center sm:py-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
          Stall Fee · Business Space
        </p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-heading sm:text-6xl">
          {STALL_FEE_DISPLAY}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          One business space at the Adwizers Business Carnival 2026.
        </p>
        <div className="mt-4 grid gap-1.5 border-t border-accent/25 pt-4 text-[13px] text-ink">
          <p>{CARNIVAL_EVENT.date}</p>
          <p>{CARNIVAL_EVENT.venue}</p>
          <p className="font-semibold text-accent">{CARNIVAL_EVENT.spaces}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
          What {STALL_FEE_DISPLAY} includes
        </h3>
        <ul className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {STALL_INCLUDES.map((item) => (
            <li key={item.title} className="flex gap-2.5">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-accent"
              >
                <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.16" />
                <path
                  d="m5.8 10.3 2.7 2.7 5.7-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                <span className="block text-sm font-medium text-heading">{item.title}</span>
                <span className="block text-[13px] leading-snug text-ink-muted">
                  {item.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
          Why take a space
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {STALL_EXTRA_VALUE.map((item) => (
            <div key={item.title} className="rounded-xl border border-line bg-raised px-4 py-3.5">
              <p className="text-sm font-semibold text-heading">{item.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-ink-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-3 border-t border-line pt-5">
        <p className="text-[13px] leading-snug text-ink-muted">
          You are not paying anything on this form. Once your space is confirmed, our team
          contacts you on WhatsApp with the payment details.
        </p>

        <CheckboxRow
          name="feeAgreed"
          title="Stall Fee Agreement"
          required
          error={error}
          defaultChecked={agreed}
        >
          I agree to pay the {STALL_FEE_DISPLAY} stall fee for my business space at the Adwizers
          Business Carnival 2026, and I understand it covers everything listed on this page.
        </CheckboxRow>
      </div>
    </>
  );
}
