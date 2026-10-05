export function getProductSelectionParts(selectionKey: string) {
  const [productId, ...variantParts] = selectionKey.split(":");
  return {
    productId: productId ?? selectionKey,
    variantId: variantParts.length > 0 ? variantParts.join(":") : "base",
  };
}

export function areEquivalentProductSelectionKeys(a: string, b: string) {
  const left = getProductSelectionParts(a);
  const right = getProductSelectionParts(b);

  if (left.productId !== right.productId) return false;
  if (left.variantId === "base" || right.variantId === "base") return true;
  return left.variantId === right.variantId;
}

export function removeSelectionFromQueue(queue: string[], currentSelectionKey: string) {
  return queue.filter((selectionKey) => !areEquivalentProductSelectionKeys(selectionKey, currentSelectionKey));
}
