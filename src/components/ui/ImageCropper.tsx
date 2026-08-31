"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { cropImageFile } from "@/lib/cropImage";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type Size = { w: number; h: number };

/**
 * Drag-and-zoom crop dialog.
 *
 * The frame *is* the viewport: the image always covers it, so whatever is on
 * screen is exactly what gets saved -- there is no "outside the box" state to
 * reason about. Everything is done on a canvas in the browser, so no crop data
 * is stored and the server keeps taking a plain image file.
 */
export function ImageCropper({
  file,
  aspect = 1,
  title = "Crop photo",
  hint,
  confirmLabel = "Use this crop",
  onCancel,
  onCropped,
}: {
  file: File;
  /** Width ÷ height of the crop frame. 1 is the square the cards render. */
  aspect?: number;
  title?: string;
  hint?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onCropped: (file: File) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const [natural, setNatural] = useState<Size | null>(null);
  const [box, setBox] = useState<Size>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The object URL is handed straight to the <img> rather than kept in state:
  // it is a browser resource with a lifetime, and creating it here means the
  // revoke on cleanup can never race a render that still points at it.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const image = imageRef.current;
    if (image) image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Escape closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // React attaches wheel listeners passively, so zoom needs its own.
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((z) => clamp(z * (1 - event.deltaY / 500), MIN_ZOOM, MAX_ZOOM));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const ready = natural !== null && box.w > 0 && box.h > 0;

  // Cover scale: the smallest scale at which the image fills the frame.
  const base = ready ? Math.max(box.w / natural.w, box.h / natural.h) : 0;
  const scale = base * zoom;
  const limit = {
    x: ready ? Math.max(0, (natural.w * scale - box.w) / 2) : 0,
    y: ready ? Math.max(0, (natural.h * scale - box.h) / 2) : 0,
  };

  function clampOffset(next: { x: number; y: number }) {
    return { x: clamp(next.x, -limit.x, limit.x), y: clamp(next.y, -limit.y, limit.y) };
  }

  // Zooming out shrinks how far the image may travel, so the stored offset is
  // clamped on the way out rather than corrected after the fact -- that keeps
  // a gap from ever appearing at the edge of the frame.
  const position = clampOffset(offset);

  function pointerDistance(): number {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) pinch.current = { distance: pointerDistance(), zoom };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const ratio = pointerDistance() / pinch.current.distance;
      setZoom(clamp(pinch.current.zoom * ratio, MIN_ZOOM, MAX_ZOOM));
      return;
    }

    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    setOffset(clampOffset({ x: position.x + dx, y: position.y + dy }));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function reset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  async function apply() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Which part of the source image the frame is currently showing.
      const rect = {
        x: (natural.w * scale) / 2 - position.x - box.w / 2,
        y: (natural.h * scale) / 2 - position.y - box.h / 2,
        width: box.w,
        height: box.h,
      };
      onCropped(
        await cropImageFile(file, {
          x: rect.x / scale,
          y: rect.y / scale,
          width: rect.width / scale,
          height: rect.height / scale,
        }),
      );
    } catch {
      setError("We could not crop that image. Please try another one.");
      setBusy(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto
                 bg-purple-royal/50 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-line bg-surface shadow-2xl
                   sm:rounded-2xl"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-heading">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {hint ?? "Drag to move, pinch or use the slider to zoom. What you see is what gets saved."}
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div
            ref={boxRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ aspectRatio: String(aspect) }}
            className="relative w-full touch-none select-none overflow-hidden rounded-lg
                       border border-line bg-charcoal"
          >
            {/* A blob URL being panned for a canvas crop -- next/image has
              * nothing to add here and would fight the transform. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              alt=""
              draggable={false}
              onLoad={(event) =>
                setNatural({
                  w: event.currentTarget.naturalWidth,
                  h: event.currentTarget.naturalHeight,
                })
              }
              style={
                ready
                  ? {
                      width: natural.w * scale,
                      height: natural.h * scale,
                      transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                    }
                  : { opacity: 0 }
              }
              className="absolute left-1/2 top-1/2 max-w-none cursor-grab active:cursor-grabbing"
            />

            {ready ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3
                           ring-1 ring-inset ring-white/25"
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border border-white/12" />
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[13px] text-white/70">
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-[13px] font-semibold text-ink-muted">
              −
            </span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!ready}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label="Zoom"
              className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full
                         bg-line accent-magenta-royal disabled:opacity-50"
            />
            <span aria-hidden="true" className="text-[15px] font-semibold text-ink-muted">
              +
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={!ready}
              className="shrink-0 text-[13px] font-medium text-ink-muted transition-colors
                         hover:text-accent disabled:opacity-50"
            >
              Reset
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          )}

          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={busy}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="button" onClick={apply} disabled={!ready || busy} className="flex-1">
              {busy ? "Cropping…" : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
