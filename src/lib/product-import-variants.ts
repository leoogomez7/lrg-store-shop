import type { Product, ProductVariant } from "@/data/products";

export type ImportedVariantChoice = {
  targetProductId: string;
  variantName: string;
};

export function buildImportedProductsWithVariants(
  existingProducts: Product[],
  importedProducts: Product[],
  choices: Record<string, ImportedVariantChoice>,
) {
  const parents = new Map<string, Product>();
  const productsToInsert: Product[] = [];

  for (const imported of importedProducts) {
    const choice = choices[imported.id];
    if (!choice) {
      productsToInsert.push(imported);
      continue;
    }

    const parent =
      parents.get(choice.targetProductId) ??
      existingProducts.find((product) => product.id === choice.targetProductId);
    if (!parent) throw new Error(`No se encontró el producto base «${choice.targetProductId}».`);

    const variantName = choice.variantName.trim();
    if (!variantName) throw new Error(`Ingresá el nombre de la variante de «${imported.name}».`);

    const updatedParent = parents.get(parent.id) ?? { ...parent, variants: [...(parent.variants ?? [])] };
    const normalizedVariantName = variantName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    if (
      updatedParent.variants?.some(
        (variant) =>
          variant.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase() ===
          normalizedVariantName,
      )
    ) {
      throw new Error(`El producto «${parent.name}» ya tiene una variante llamada «${variantName}».`);
    }

    const variant: ProductVariant = {
      id: `variant-import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: variantName,
      price: imported.price,
      priceCurrency: imported.priceCurrency ?? "ARS",
      comision: imported.comision,
      comisionCurrency: imported.comisionCurrency,
      cardCommission: imported.cardCommission,
      gastos: imported.gastos,
      gastosCurrency: imported.gastosCurrency,
      description: imported.description,
      stock: imported.stock,
      stockUnlimited: imported.stockUnlimited,
      features: imported.features,
      includes: imported.includes,
      deliveryUnit: imported.deliveryUnit,
      deliveryAmount: imported.deliveryAmount,
      discount: imported.discount,
      supplier: imported.supplier,
    };

    updatedParent.variants = [...(updatedParent.variants ?? []), variant];
    parents.set(parent.id, updatedParent);
  }

  return [...productsToInsert, ...parents.values()];
}
