import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const patterns = ["grid", "rings", "waves"] as const;

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total + value.charCodeAt(index) * (index + 7)) % 997;
  }
  return total;
}

function isBackgroundPixel(red: number, green: number, blue: number, mode: "light" | "dark") {
  return mode === "light"
    ? red >= 220 && green >= 220 && blue >= 220
    : red <= 40 && green <= 40 && blue <= 40;
}

function getBackgroundMode(data: Uint8ClampedArray, width: number, height: number) {
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ];
  const lightCorners = corners.filter(
    (offset) => data[offset] >= 220 && data[offset + 1] >= 220 && data[offset + 2] >= 220,
  ).length;
  const darkCorners = corners.filter(
    (offset) => data[offset] <= 40 && data[offset + 1] <= 40 && data[offset + 2] <= 40,
  ).length;

  if (lightCorners >= 3) return "light";
  if (darkCorners >= 3) return "dark";
  return null;
}

function cropUniformBorders(source: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) return null;

  context.drawImage(source, 0, 0);
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null;
  }

  const mode = getBackgroundMode(pixels, canvas.width, canvas.height);
  if (!mode) return null;

  const isBackgroundRow = (row: number) => {
    let backgroundPixels = 0;
    for (let column = 0; column < canvas.width; column += 1) {
      const offset = (row * canvas.width + column) * 4;
      if (
        pixels[offset + 3] < 16 ||
        isBackgroundPixel(pixels[offset], pixels[offset + 1], pixels[offset + 2], mode)
      ) {
        backgroundPixels += 1;
      }
    }
    return backgroundPixels / canvas.width > 0.92;
  };
  const isBackgroundColumn = (column: number) => {
    let backgroundPixels = 0;
    for (let row = 0; row < canvas.height; row += 1) {
      const offset = (row * canvas.width + column) * 4;
      if (
        pixels[offset + 3] < 16 ||
        isBackgroundPixel(pixels[offset], pixels[offset + 1], pixels[offset + 2], mode)
      ) {
        backgroundPixels += 1;
      }
    }
    return backgroundPixels / canvas.height > 0.92;
  };

  let left = 0;
  let right = canvas.width - 1;
  let top = 0;
  let bottom = canvas.height - 1;
  while (top < bottom && isBackgroundRow(top)) top += 1;
  while (bottom > top && isBackgroundRow(bottom)) bottom -= 1;
  while (left < right && isBackgroundColumn(left)) left += 1;
  while (right > left && isBackgroundColumn(right)) right -= 1;

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  if (cropWidth === canvas.width && cropHeight === canvas.height) return null;

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  croppedCanvas
    .getContext("2d")
    ?.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return croppedCanvas.toDataURL("image/png");
}

function CroppedProductImage({ image, label }: { image: string; label: string }) {
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const source = new Image();
    source.crossOrigin = "anonymous";
    source.onload = () => {
      if (!cancelled) setCroppedImage(cropUniformBorders(source));
    };
    source.onerror = () => {
      if (!cancelled) setCroppedImage(null);
    };
    source.src = image;
    return () => {
      cancelled = true;
    };
  }, [image]);

  return <img src={croppedImage ?? image} alt={label} className="size-full object-contain" />;
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
