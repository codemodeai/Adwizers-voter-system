"use client";

import { useState } from "react";

import { Field, inputClass } from "@/components/ui/Field";

/**
 * The link fields on the social step are the ones people get wrong -- they type a
 * handle, a phone number, or the name of their shop. Each kind carries the
 * shape we expect so the field can say so up front, and again the moment what
 * they typed stops matching.
 */
export const LINK_KINDS = {
  instagram: {
    wrongHost: "That is not an Instagram link.",
    hosts: ["instagram.com"],
    example: "instagram.com/yourbrand",
  },
  facebook: {
    wrongHost: "That is not a Facebook link.",
    hosts: ["facebook.com", "fb.com", "fb.me"],
    example: "facebook.com/yourbrand",
  },
  whatsapp: {
    wrongHost: "That is not a WhatsApp link.",
    hosts: ["wa.me", "whatsapp.com"],
    example: "wa.me/919876543210",
  },
  website: { wrongHost: "", hosts: null, example: "yourbrand.com" },
} as const;

export type LinkKind = keyof typeof LINK_KINDS;

/** Every host we know belongs in one of the *other* link fields. */
const SOCIAL_HOSTS = ["instagram.com", "facebook.com", "fb.com", "fb.me", "wa.me", "whatsapp.com"];

const hostMatches = (host: string, allowed: readonly string[]) =>
  allowed.some((a) => host === a || host.endsWith(`.${a}`));

type LinkCheck = { state: "empty" | "ok" | "error"; message?: string; normalized?: string };

/**
 * One rule set shared by the live hint under the input and the step's own
 * validation, so the field can never say "looks good" and then block Next.
 */
export function checkLink(raw: string, kind: LinkKind): LinkCheck {
  const value = raw.trim();
  const { wrongHost, hosts, example } = LINK_KINDS[kind];
  const wanted = `Use a link like ${example}`;

  if (!value) return { state: "empty" };

  // A bare phone number is the single most common thing typed into the
  // WhatsApp field, and it is one we can just turn into the right link.
  if (kind === "whatsapp" && /^\+?[\d\s()-]+$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    // wa.me only works with the country code in front, which is exactly the
    // part people leave off when they type their own number from memory.
    if (digits.length >= 11 && digits.length <= 15) {
      return { state: "ok", normalized: `https://wa.me/${digits}` };
    }
    return {
      state: "error",
      message: `That number needs its country code as well. ${wanted}`,
    };
  }

  if (value.startsWith("@")) {
    return { state: "error", message: `That is a username, not a link. ${wanted}` };
  }
  if (/\s/.test(value)) {
    return { state: "error", message: `A link has no spaces in it. ${wanted}` };
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { state: "error", message: `That is not a link yet. ${wanted}` };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host)) {
    return { state: "error", message: `That is not a web address. ${wanted}` };
  }

  if (hosts && !hostMatches(host, hosts)) {
    return { state: "error", message: `${wrongHost} ${wanted}` };
  }
  if (!hosts && hostMatches(host, SOCIAL_HOSTS)) {
    return {
      state: "error",
      message: "That is a social link -- it belongs in one of the fields above.",
    };
  }
  if (kind === "whatsapp" && host === "wa.me" && url.pathname.replace(/\D/g, "").length < 11) {
    return {
      state: "error",
      message: `That link needs your number with its country code. ${wanted}`,
    };
  }

  return { state: "ok", normalized: url.toString().replace(/\/$/, "") };
}

/**
 * A link field that says what a good answer looks like before anything is
 * typed, and swaps that line for the specific problem -- or for the exact URL
 * we will store -- as soon as there is something to judge. Mistakes are only
 * called out once the field has been left, so nobody is scolded mid-word.
 */
export function LinkField({
  kind,
  name,
  label,
  defaultValue,
  serverError,
}: {
  kind: LinkKind;
  name: string;
  label: string;
  defaultValue?: string;
  serverError?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [touched, setTouched] = useState(false);

  const { example } = LINK_KINDS[kind];
  const check = checkLink(value, kind);
  const showError = check.state === "error" && touched;

  return (
    <Field
      label={label}
      htmlFor={name}
      error={showError ? check.message : serverError}
      hint={
        showError ? undefined : check.state === "ok" ? (
          <span className="break-all">
            <span className="text-gold" aria-hidden="true">
              &#10003;
            </span>{" "}
            Saved as {check.normalized}
          </span>
        ) : (
          <>
            Links only &mdash; paste the full address, like{" "}
            <span className="text-ink">{example}</span>
          </>
        )
      }
    >
      <input
        id={name}
        name={name}
        inputMode="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setTouched(true);
          // A number typed into the WhatsApp field is stored as the wa.me link
          // it means, so what is submitted matches what the hint promised.
          if (check.state === "ok" && kind === "whatsapp") setValue(check.normalized ?? value);
        }}
        aria-invalid={showError || undefined}
        autoComplete="url"
        className={inputClass}
        placeholder={example}
      />
    </Field>
  );
}
