"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { compressImage, formatBytes } from "@/lib/compressImage";
import { ACCEPTED_LOGO_TYPES, MAX_LOGO_SOURCE_BYTES } from "@/lib/validation/applicant";

type Picked = {
  url: string;
  originalBytes: number;
  finalBytes: number;
};

/**
 * File picker that shrinks the chosen image before it ever reaches the form,
 * then shows the applicant what will actually be uploaded.
 *
 * The real <input type="file"> is kept in the DOM (hidden) and its FileList is
 * swapped for the compressed file, so the surrounding form still submits
 * normally -- including without JavaScript, where the browser just posts the
 * original and the server-side limits apply.
 */
export function LogoField({
  name = "logo",
  id = "logo",
  onErrorChange,
}: {
  name?: string;
  id?: string;
  onErrorChange?: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Object URLs are only freed explicitly.
    return () => {
      if (picked) URL.revokeObjectURL(picked.url);
    };
  }, [picked]);

  function fail(message: string) {
    setError(message);
    onErrorChange?.(message);
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
  }

  async function handleChange() {
    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!input || !file) return;

    setError(null);
    onErrorChange?.(null);

    if (!ACCEPTED_LOGO_TYPES.includes(file.type as (typeof ACCEPTED_LOGO_TYPES)[number])) {
      fail("Upload a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > MAX_LOGO_SOURCE_BYTES) {
      fail(`That image is ${formatBytes(file.size)}. Please choose one under 25 MB.`);
      return;
    }

    setBusy(true);
    try {
      const compressed = await compressImage(file);

      // Hand the form the smaller file in place of the original.
      const transfer = new DataTransfer();
      transfer.items.add(compressed);
      input.files = transfer.files;

      setPicked((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          url: URL.createObjectURL(compressed),
          originalBytes: file.size,
          finalBytes: compressed.size,
        };
      });
    } catch {
      fail("We could not read that image. Please try another one.");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPicked((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setError(null);
    onErrorChange?.(null);
  }

  const shrunk = picked && picked.finalBytes < picked.originalBytes;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="sr-only"
      />

      {picked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-raised p-3 sm:flex-nowrap sm:gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-canvas">
            <Image src={picked.url} alt="Selected photo preview" fill unoptimized className="object-cover" />
          </div>
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-sm font-medium text-ink">Photo ready to upload</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {shrunk ? (
                <>
                  {formatBytes(picked.originalBytes)} → {formatBytes(picked.finalBytes)}{" "}
                  <span className="text-gold">optimised</span>
                </>
              ) : (
                formatBytes(picked.finalBytes)
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 max-sm:w-full max-sm:justify-end">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-line px-2.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-accent/40"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-accent"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-dashed
                     border-line bg-raised px-4 py-5 text-sm font-medium text-ink-muted
                     transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Preparing image…
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4">
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Choose an image
            </>
          )}
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
