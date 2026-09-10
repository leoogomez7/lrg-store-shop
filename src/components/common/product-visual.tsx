import { cn } from "@/lib/utils";
import { cropImageDataUrl } from "@/lib/image-processing";
import { useEffect, useState } from "react";

const patterns = ["grid", "rings", "waves"] as const;
const croppedImageCache = new Map<string, string | null>();

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total + value.charCodeAt(index) * (index + 7)) % 997;
  }
  return total;
}

export function CroppedProductImage({
  image,
  label,
  className,
}: {
  image: string;
  label: string;
  className?: string;
}) {
  const [processedImage, setProcessedImage] = useState<string | null>(() =>
    croppedImageCache.has(image) ? (croppedImageCache.get(image) ?? image) : null,
  );
  const [isProcessing, setIsProcessing] = useState(() => !croppedImageCache.has(image));

  useEffect(() => {
    if (croppedImageCache.has(image)) {
      setProcessedImage(croppedImageCache.get(image) ?? image);
      setIsProcessing(false);
      return;
    }

    let cancelled = false;
    cropImageDataUrl(image).then((result) => {
      const croppedResult = result === image ? null : result;
      croppedImageCache.set(image, croppedResult);
      if (!cancelled) {
        setProcessedImage(result);
        setIsProcessing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  return isProcessing ? (
    <div
      className={cn("size-full animate-pulse bg-surface-2", className)}
      aria-label={`Cargando imagen de ${label}`}
    />
  ) : (
    <img
      src={processedImage ?? image}
      alt={label}
      className={cn("size-full object-contain", className)}
    />
  );
}

/**
 * Visual de producto generado a partir del identificador.
 * Un único componente para todas las marcas: cambia con los tokens del tema.
 */
export function ProductVisual({
  seed,
  label,
  image,
  className,
}: {
  seed: string;
  label: string;
  image?: string;
  className?: string;
}) {
  const value = hash(seed);
  const pattern = patterns[value % patterns.length];
  const angle = 90 + (value % 180);
  return (
    <div
      className={cn("relative overflow-hidden rounded-[inherit] bg-surface-2", className)}
      aria-hidden="true"
    >
      {image ? (
        <CroppedProductImage image={image} label={label} />
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-90"
            style={{
              backgroundImage: `linear-gradient(${angle}deg, var(--brand) 0%, var(--brand-2) 100%)`,
            }}
          />
          <div className="absolute inset-0 mix-blend-soft-light opacity-70">
            {pattern === "grid" && (
              <div
                className="size-full"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.28) 1px, transparent 1px)",
                  backgroundSize: "26px 26px",
                }}
              />
            )}
            {pattern === "rings" && (
              <div
                className="size-full"
                style={{
                  backgroundImage:
                    "repeating-radial-gradient(circle at 30% 110%, rgba(255,255,255,.32) 0 2px, transparent 2px 22px)",
                }}
              />
            )}
            {pattern === "waves" && (
              <div
                className="size-full"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(115deg, rgba(255,255,255,.26) 0 2px, transparent 2px 18px)",
                }}
              />
            )}
          </div>
          <div className="absolute inset-0 bg-linear-to-t from-background/80 via-background/10 to-transparent" />
        </>
      )}
    </div>
  );
}
