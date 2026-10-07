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
  const lightCorners = corners.filter((offset) => {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return red !== undefined && green !== undefined && blue !== undefined
      ? red >= 220 && green >= 220 && blue >= 220
      : false;
  }).length;
  const darkCorners = corners.filter((offset) => {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return red !== undefined && green !== undefined && blue !== undefined
      ? red <= 40 && green <= 40 && blue <= 40
      : false;
  }).length;

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
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const alpha = pixels[offset + 3];
      if (
        alpha === undefined ||
        red === undefined ||
        green === undefined ||
        blue === undefined ||
        alpha < 16 ||
        isBackgroundPixel(red, green, blue, mode)
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
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const alpha = pixels[offset + 3];
      if (
        alpha === undefined ||
        red === undefined ||
        green === undefined ||
        blue === undefined ||
        alpha < 16 ||
        isBackgroundPixel(red, green, blue, mode)
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

export function cropImageDataUrl(image: string) {
  return new Promise<string>((resolve, reject) => {
    if (!image || typeof image !== "string") {
      reject(new Error("La imagen está vacía o no es válida."));
      return;
    }

    const source = new Image();
    source.crossOrigin = "anonymous";
    source.onload = () => {
      const cropped = cropUniformBorders(source);
      resolve(cropped ?? image);
    };
    source.onerror = () =>
      reject(
        new Error(
          "El navegador no puede abrir este formato. Convertí la imagen a JPG, PNG o WebP e intentá de nuevo.",
        ),
      );
    source.src = image;
  });
}

export function optimizeImageDataUrl(image: string, maxDimension = 1400) {
  return new Promise<string>((resolve, reject) => {
    if (!image.startsWith("data:image/")) {
      resolve(image);
      return;
    }

    const source = new Image();
    source.onload = () => {
      if (!source.naturalWidth || !source.naturalHeight) {
        reject(new Error("La imagen no tiene dimensiones válidas."));
        return;
      }

      if (
        image.startsWith("data:image/webp") &&
        image.length <= 500_000 &&
        Math.max(source.naturalWidth, source.naturalHeight) <= maxDimension
      ) {
        resolve(image);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("El navegador no pudo preparar la imagen."));
        return;
      }

      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      try {
        const optimized = canvas.toDataURL("image/webp", 0.78);
        resolve(
          optimized.startsWith("data:image/webp") ? optimized : canvas.toDataURL("image/png"),
        );
      } catch {
        reject(new Error("El formato de imagen no se pudo convertir en el navegador."));
      }
    };
    source.onerror = () =>
      reject(
        new Error(
          "Este formato no es compatible con el navegador. Convertí la imagen a JPG, PNG o WebP e intentá de nuevo.",
        ),
      );
    source.src = image;
  });
}

export function createImageThumbnailDataUrl(image: string, maxDimension = 360) {
  return new Promise<string | null>((resolve) => {
    if (!image.startsWith("data:image/")) {
      resolve(null);
      return;
    }

    const source = new Image();
    source.onload = () => {
      if (!source.naturalWidth || !source.naturalHeight) {
        resolve(null);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      try {
        const thumbnail = canvas.toDataURL("image/webp", 0.58);
        resolve(thumbnail.startsWith("data:image/webp") ? thumbnail : null);
      } catch {
        resolve(null);
      }
    };
    source.onerror = () => resolve(null);
    source.src = image;
  });
}

export async function composeHeaderAboveImageDataUrl(headerImage: string, productImage: string) {
  const loadImage = (sourceUrl: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      if (!sourceUrl.startsWith("data:")) image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo abrir una de las imágenes para componer."));
      image.src = sourceUrl;
    });

  const [header, product] = await Promise.all([loadImage(headerImage), loadImage(productImage)]);
  if (!header.naturalWidth || !header.naturalHeight || !product.naturalWidth || !product.naturalHeight) {
    throw new Error("Una imagen no tiene dimensiones válidas para componer.");
  }

  const width = Math.min(product.naturalWidth, 1400);
  const productScale = width / product.naturalWidth;
  const headerScale = width / header.naturalWidth;
  const headerHeight = Math.max(1, Math.round(header.naturalHeight * headerScale));
  const productHeight = Math.max(1, Math.round(product.naturalHeight * productScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = headerHeight + productHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no pudo preparar el lienzo de composición.");
  context.drawImage(header, 0, 0, width, headerHeight);
  context.drawImage(product, 0, headerHeight, width, productHeight);

  let composite: string;
  try {
    composite = canvas.toDataURL("image/webp", 0.84);
  } catch {
    throw new Error(
      "El servidor de la imagen del producto no permite componerla con la cabecera. Probá con una imagen local.",
    );
  }
  return optimizeImageDataUrl(composite, 1800);
}
