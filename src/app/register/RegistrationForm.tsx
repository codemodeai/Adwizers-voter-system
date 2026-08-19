"use client";

import Image from "next/image";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import {
  Field,
  FieldError,
  Label,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/ui/Field";
import { LogoField } from "@/components/ui/LogoField";
import { Stepper } from "@/components/ui/Stepper";
import type { Category } from "@/lib/types";
import {
  ACCEPTED_LOGO_TYPES,
  MAX_LOGO_BYTES,
  OTHER_CATEGORY_SLUG,
} from "@/lib/validation/applicant";
import { submitApplication } from "./actions";
import { EMPTY_REGISTER_STATE } from "./state";

type Errors = Record<string, string>;

const STEPS = [
  {
    title: "About You",
    description: "How we reach you about your nomination.",
    image: "/steps/step-1.jpg",
    caption: "Every entry starts with a name.",
    fields: ["fullName", "whatsappNumber", "email", "areaLocation"],
  },
  {
    title: "Your Business",
    description: "This decides which award category you compete in.",
    image: "/steps/step-2.jpg",
    caption: "The thing you built, in your own words.",
    fields: ["businessName", "profession", "categoryId", "categoryOther", "yearsInBusiness"],
  },
  {
    title: "Your Story",
    description: "This is what the judges and voters read. Take your time here.",
    image: "/steps/step-3.jpg",
    caption: "Where it began, and how far it has come.",
    fields: ["businessJourney", "proudestAchievement"],
  },
  {
    title: "Links & Photo",
    description: "Shown on your nominee card if you are selected.",
    image: "/steps/step-4.jpg",
    caption: "How the world will find you.",
    fields: ["socialInstagram", "socialFacebook", "socialWebsite", "socialWhatsapp", "logo"],
  },
  {
    title: "Confirm & Submit",
    description: "The last few details, then you are done.",
    image: "/steps/step-5.jpg",
    caption: "One last look, then it is with us.",
    fields: [
      "interestedInNomination",
      "wantsWhatsappUpdates",
      "nominationDeclaration",
      "termsAccepted",
      "communicationConsent",
    ],
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
function validateStep(index: number, fd: FormData, isOther: boolean): Errors {
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

    const email = value("email");
    if (!email) errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = "Enter a valid email address";
  }

  if (index === 1) {
    require("businessName", "Business / brand name is required");
    require("profession", "Business / profession is required");
    require("categoryId", "Please choose a business category");
    if (isOther && !value("categoryOther")) {
      errors.categoryOther = "Please tell us which category you belong to";
    }
  }

  if (index === 3) {
    const file = fd.get("logo");
    if (file instanceof File && file.size > 0) {
      if (!ACCEPTED_LOGO_TYPES.includes(file.type as (typeof ACCEPTED_LOGO_TYPES)[number]))
        errors.logo = "Upload a JPG, PNG, or WebP image";
      else if (file.size > MAX_LOGO_BYTES) errors.logo = "Image must be 5 MB or smaller";
    }
  }

  if (index === 4) {
    require("interestedInNomination", "Please tell us if you are interested in nomination");
    if (fd.get("nominationDeclaration") !== "on")
      errors.nominationDeclaration = "Please accept the nomination declaration";
    if (fd.get("termsAccepted") !== "on")
      errors.termsAccepted = "Please accept the terms & conditions";
  }

  return errors;
}

/**
 * Left rail. All five images are stacked and cross-faded rather than swapped,
 * so moving between steps reads as one continuous scene instead of a reload.
 */
function ImagePanel({ step }: { step: number }) {
  return (
    // On phones this becomes a short banner above the fields rather than
    // disappearing -- every step keeps its artwork, but it costs ~160px of
    // vertical space instead of half the screen.
    <div className="noise noise-strong relative isolate h-40 overflow-hidden bg-purple-royal sm:h-52 md:h-auto">
      {STEPS.map((s, i) => (
        <Image
          key={s.image}
          src={s.image}
          alt=""
          aria-hidden="true"
          fill
          priority={i === 0}
          sizes="(min-width: 768px) 42vw, 100vw"
          className={
            // The art is 2:3, so a wide banner crop is anchored high to keep
            // faces in frame; the tall desktop panel can sit centred.
            "object-cover object-[center_28%] transition-all duration-[900ms] ease-out md:object-center " +
            (i === step ? "scale-100 opacity-100" : "scale-105 opacity-0")
          }
        />
      ))}

      {/* Keeps the caption legible whatever the artwork underneath is doing. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#0f0016] via-[#0f0016]/25 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-purple-royal/45 via-transparent to-magenta-royal/25"
      />

      {/* Overlay copy is desktop-only: on the short mobile banner it covers the
        * artwork and just repeats the "Step 1 of 5 / About You" heading that
        * sits directly beneath it. */}
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

function CheckboxRow({
  name,
  title,
  defaultChecked,
  required,
  error,
  children,
}: {
  name: string;
  /** Heading shown above the consent text, e.g. "Nomination Declaration". */
  title?: string;
  defaultChecked?: boolean;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className={
          "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm leading-relaxed " +
          "transition-colors has-checked:border-accent/50 has-checked:bg-accent-soft " +
          (error ? "border-accent/60 bg-accent-soft" : "border-line bg-raised")
        }
      >
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="mt-0.5 size-4.5 shrink-0 accent-accent"
        />
        <span className="text-ink">
          {title && (
            <span className="mb-0.5 block font-semibold text-heading">
              {title}
              {required && (
                <span className="ml-0.5 text-accent" aria-hidden="true">
                  *
                </span>
              )}
            </span>
          )}
          <span className={title ? "block text-ink-muted" : undefined}>
            {children}
            {required && !title && (
              <span className="ml-0.5 text-accent" aria-hidden="true">
                *
              </span>
            )}
          </span>
        </span>
      </label>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function Arrow({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4">
      <path
        d={back ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto sm:min-w-44 sm:py-2.5">
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
          Submitting…
        </>
      ) : (
        <>
          Submit Application
          <Arrow />
        </>
      )}
    </Button>
  );
}

export function RegistrationForm({ categories }: { categories: Category[] }) {
  const [state, formAction] = useActionState(submitApplication, EMPTY_REGISTER_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [clientErrors, setClientErrors] = useState<Errors>({});

  const v = state.values ?? {};
  const [categoryId, setCategoryId] = useState(v.categoryId ?? "");
  const [whatsapp, setWhatsapp] = useState(v.whatsappNumber ?? "");

  const isOther = categories.find((c) => String(c.id) === categoryId)?.slug === OTHER_CATEGORY_SLUG;
  const errors: Errors = { ...(state.fieldErrors ?? {}), ...clientErrors };
  const isLast = step === STEPS.length - 1;

  // A rejected submit should land on the step that actually has the problem.
  // Adjusting during render (rather than in an effect) keeps it to a single
  // pass -- the user never sees the wrong step flash first.
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
    const found = validateStep(step, new FormData(formRef.current), isOther);
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
          // Enter should advance the wizard, not fire a half-filled submit.
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
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  className={inputClass}
                  placeholder="e.g. +91 98765 43210"
                />
              </Field>

              <Field
                label="Email Address"
                htmlFor="email"
                required
                error={errors.email}
                hint="Your nomination result is sent here."
              >
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={v.email}
                  autoComplete="email"
                  className={inputClass}
                  placeholder="e.g. you@example.com"
                />
              </Field>

              <Field
                label="Area / Location"
                htmlFor="areaLocation"
                required
                error={errors.areaLocation}
              >
                <input
                  id="areaLocation"
                  name="areaLocation"
                  defaultValue={v.areaLocation}
                  autoComplete="address-level2"
                  className={inputClass}
                  placeholder="e.g. Coimbatore"
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
                  autoComplete="organization"
                  className={inputClass}
                  placeholder="e.g. Priya's Handmade Jewellery"
                />
              </Field>

              <Field
                label="Business / Profession"
                htmlFor="profession"
                required
                error={errors.profession}
              >
                <input
                  id="profession"
                  name="profession"
                  defaultValue={v.profession}
                  autoComplete="organization-title"
                  className={inputClass}
                  placeholder="e.g. Handmade jewellery maker"
                />
              </Field>

              <Field
                label="Business Category"
                htmlFor="categoryId"
                required
                error={errors.categoryId}
                hint="You will be judged in this category."
              >
                <select
                  id="categoryId"
                  name="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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

              {isOther && (
                <Field
                  label="Please specify your category"
                  htmlFor="categoryOther"
                  required
                  error={errors.categoryOther}
                  className="sm:col-span-2"
                >
                  <input
                    id="categoryOther"
                    name="categoryOther"
                    defaultValue={v.categoryOther}
                    className={inputClass}
                    placeholder="Tell us what you do"
                  />
                </Field>
              )}
            </div>

            <div className={step === 2 ? `space-y-4 sm:space-y-5 ${panel}` : "hidden"}>
              <Field
                label="Your Business Journey"
                htmlFor="businessJourney"
                hint="A short version of how you started and where you are now."
              >
                <textarea
                  id="businessJourney"
                  name="businessJourney"
                  defaultValue={v.businessJourney}
                  className={textareaClass}
                  placeholder="How it began…"
                />
              </Field>

              <Field label="Your Proudest Achievement" htmlFor="proudestAchievement">
                <textarea
                  id="proudestAchievement"
                  name="proudestAchievement"
                  defaultValue={v.proudestAchievement}
                  className={textareaClass}
                  placeholder="The moment you are most proud of…"
                />
              </Field>
            </div>

            <div className={step === 3 ? `grid gap-4 sm:gap-5 sm:grid-cols-2 ${panel}` : "hidden"}>
              <Field label="Instagram" htmlFor="socialInstagram">
                <input
                  id="socialInstagram"
                  name="socialInstagram"
                  defaultValue={v.socialInstagram}
                  autoComplete="url"
                  className={inputClass}
                  placeholder="instagram.com/yourbrand"
                />
              </Field>

              <Field label="Facebook" htmlFor="socialFacebook">
                <input
                  id="socialFacebook"
                  name="socialFacebook"
                  defaultValue={v.socialFacebook}
                  autoComplete="url"
                  className={inputClass}
                  placeholder="facebook.com/yourbrand"
                />
              </Field>

              <Field label="Website" htmlFor="socialWebsite">
                <input
                  id="socialWebsite"
                  name="socialWebsite"
                  defaultValue={v.socialWebsite}
                  autoComplete="url"
                  className={inputClass}
                  placeholder="yourbrand.com"
                />
              </Field>

              <WhatsAppLinkField defaultValue={v.socialWhatsapp} whatsapp={whatsapp} />

              <Field
                label="Logo / Product Photo"
                htmlFor="logo"
                error={errors.logo}
                hint="JPG, PNG, or WebP. Large photos are resized automatically, so upload straight from your phone."
                className="sm:col-span-2"
              >
                <LogoField />
              </Field>
            </div>

            <div className={step === 4 ? `space-y-5 sm:space-y-6 ${panel}` : "hidden"}>
              <fieldset className="space-y-2">
                <Label required>Are you interested in being nominated?</Label>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                  {[
                    { value: "yes", label: "Yes" },
                    { value: "maybe", label: "Maybe" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center justify-center gap-2.5 rounded-lg
                                 border border-line bg-raised px-5 py-3 text-sm font-medium
                                 text-ink transition-colors hover:border-accent/40
                                 has-checked:border-accent has-checked:bg-accent-soft
                                 sm:justify-start sm:px-6 sm:py-2.5"
                    >
                      <input
                        type="radio"
                        name="interestedInNomination"
                        value={option.value}
                        defaultChecked={v.interestedInNomination === option.value}
                        className="size-4 accent-accent"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <FieldError>{errors.interestedInNomination}</FieldError>
              </fieldset>

              {/* Form 1 Q13 -- a preference, not a declaration, so it stays
                * outside the declarations block below. */}
              <CheckboxRow
                name="wantsWhatsappUpdates"
                defaultChecked={v.wantsWhatsappUpdates === "on"}
              >
                Send me updates about the awards on WhatsApp.
              </CheckboxRow>

              <div className="space-y-3 border-t border-line pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                  Declarations
                </p>

                <CheckboxRow
                  name="nominationDeclaration"
                  title="Nomination Declaration"
                  required
                  error={errors.nominationDeclaration}
                  defaultChecked={v.nominationDeclaration === "on"}
                >
                  I confirm that the information provided is accurate and authorize Adwizers Awards
                  to use the submitted nominee information, photograph/logo, achievements and social
                  media links for nomination review, public voting and official promotional
                  purposes.
                </CheckboxRow>

                <CheckboxRow
                  name="termsAccepted"
                  title="Terms & Conditions"
                  required
                  error={errors.termsAccepted}
                  defaultChecked={v.termsAccepted === "on"}
                >
                  I agree to the Adwizers Awards nomination, eligibility and voting terms &amp;
                  conditions.
                </CheckboxRow>

                <CheckboxRow
                  name="communicationConsent"
                  title="Communication Consent"
                  defaultChecked={v.communicationConsent === "on"}
                >
                  I agree to receive updates regarding my nomination, public voting and Adwizers
                  Awards event.
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
 * Most people's WhatsApp link is just their number, so offer to fill it rather
 * than making them construct a wa.me URL by hand.
 */
function WhatsAppLinkField({
  defaultValue,
  whatsapp,
}: {
  defaultValue?: string;
  whatsapp: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const digits = whatsapp.replace(/\D/g, "");
  const suggestion = digits.length >= 10 ? `wa.me/${digits}` : null;

  return (
    <Field
      label="WhatsApp Link"
      htmlFor="socialWhatsapp"
      hint={
        suggestion && value !== suggestion ? (
          <button
            type="button"
            onClick={() => setValue(suggestion)}
            className="font-medium text-accent underline underline-offset-2"
          >
            Use my WhatsApp number ({suggestion})
          </button>
        ) : undefined
      }
    >
      <input
        id="socialWhatsapp"
        name="socialWhatsapp"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="url"
        className={inputClass}
        placeholder="wa.me/919876543210"
      />
    </Field>
  );
}
