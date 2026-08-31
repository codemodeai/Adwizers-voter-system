"use client";

import Image from "next/image";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import { ImageCropper } from "@/components/ui/ImageCropper";
import { compressImage, formatBytes } from "@/lib/compressImage";
import { fetchImageAsFile } from "@/lib/cropImage";
import { ACCEPTED_LOGO_TYPES, MAX_LOGO_SOURCE_BYTES } from "@/lib/validation/applicant";

type Picked = {
  url: string;
  originalBytes: number;
  finalBytes: number;
  cropped: boolean;
};

/** Lets a parent hand an already-uploaded photo back to this field to re-crop. */
export type LogoFieldHandle = {
  cropFromUrl: (url: string) => Promise<void>;
};

/**
 * File picker that shrinks the chosen image before it ever reaches the form,
 * then shows the applicant what will actually be uploaded.
 *
 * The real <input type="file"> is kept in the DOM (hidden) and its FileList is
 * swapped for the compressed file, so the surrounding form still submits
 * normally -- including without JavaScript, where the browser just posts the
 * original and the server-side limits apply.
 *
 * Pass `aspect` to put a crop step in front of that swap: the picked image goes
 * to the cropper first, and only the cropped result reaches the input.
 */
export function LogoField({
  name = "logo",
  id = "logo",
  aspect,
  onErrorChange,
  ref,
}: {
  name?: string;
  id?: string;
  /** Crop frame ratio. Omit to keep the plain picker with no crop step. */
  aspect?: number;
  onErrorChange?: (message: string | null) => void;
  ref?: Ref<LogoFieldHandle>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The untouched original is kept so "Crop" can be reopened without stacking
  // one lossy re-encode on top of another.
  const [source, setSource] = useState<File | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);

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

  /** Compresses `file` and makes it the one the surrounding form will post. */
  async function accept(file: File, originalBytes: number, cropped: boolean) {
    const input = inputRef.current;
    if (!input) return;

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
          originalBytes,
          finalBytes: compressed.size,
          cropped,
        };
      });
    } catch {
      fail("We could not read that image. Please try another one.");
    } finally {
      setBusy(false);
    }
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

    setSource(file);

    // With cropping on, nothing reaches the input until the crop is confirmed,
    // so a cancelled dialog cannot leave the uncropped original staged.
    if (aspect) {
      setCropping(file);
      return;
    }

    await accept(file, file.size, false);
  }

  function cancelCrop() {
    setCropping(null);
    // Nothing accepted yet: drop the staged file, and reset the input so
    // picking the very same file again still fires a change event.
    if (!picked && inputRef.current) inputRef.current.value = "";
  }

  useImperativeHandle(ref, () => ({
    async cropFromUrl(url: string) {
      setError(null);
      onErrorChange?.(null);
      setBusy(true);
      try {
        const file = await fetchImageAsFile(url);
        setSource(file);
        setCropping(file);
      } catch {
        fail("We could not open that photo for cropping.");
      } finally {
        setBusy(false);
      }
    },
  }));

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPicked((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setSource(null);
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
        <div className="rounded-lg border border-line bg-raised p-3">
          <div className="flex items-center gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-canvas">
              <Image src={picked.url} alt="Selected photo preview" fill unoptimized className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {picked.cropped ? "Cropped photo ready to upload" : "Photo ready to upload"}
              </p>
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
          </div>

          {/* Their own row: this field sits in a 20rem admin column as well as
            * a full-width form, and three buttons beside the thumbnail crush
            * the label in the narrow one. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {aspect && source && (
              <button
                type="button"
                onClick={() => setCropping(source)}
                className="rounded-md border border-line px-2.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-accent/40"
              >
                Crop
              </button>
            )}
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

      {cropping && aspect && (
        <ImageCropper
          file={cropping}
          aspect={aspect}
          onCancel={cancelCrop}
          onCropped={(file) => {
            setCropping(null);
            void accept(file, source?.size ?? file.size, true);
          }}
        />
      )}
    </div>
  );
}
