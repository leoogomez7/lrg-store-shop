import { arcadeConfig } from "./arcade.config";
import { scentsConfig } from "./scents.config";
import { webDesignConfig } from "./web-design.config";
import type { BrandConfig, BrandSlug } from "./types";

/**
 * Registro de marcas del ecosistema LRG Store Shop.
 * Agregar una nueva marca = crear su archivo de configuración y sumarlo aquí.
 * Ninguna pantalla necesita modificarse.
 */
export const brands: Record<BrandSlug, BrandConfig> = {
  arcade: arcadeConfig,
  scents: scentsConfig,
  "web-design": webDesignConfig,
};

export const brandList: BrandConfig[] = Object.values(brands);

export function isBrandSlug(value: string): value is BrandSlug {
  return value in brands;
}

export function getBrand(slug: string): BrandConfig | undefined {
  return isBrandSlug(slug) ? brands[slug] : undefined;
}

export type { BrandConfig, BrandCategory, BrandSlug } from "./types";
