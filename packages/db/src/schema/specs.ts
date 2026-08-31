import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { merchants, products } from "./business";

/** A PCIe power connector the card needs, or the supply provides. */
export interface PciePowerConnector {
  count: number;
  pins: number;
}

/**
 * Resolved, queryable specifications — the compatibility engine's only input.
 *
 * `products.attributes` is a display blob: whatever reads well on a product
 * page. It is useless for validation, because deciding whether an ATX board
 * fits an ITX case cannot depend on the model interpreting free-form JSON. So
 * the fields §4 validates against get real columns, typed and indexable, and
 * the engine reads a fixed set of them.
 *
 * **Every column is nullable on purpose.** A missing spec is the
 * `insufficient_data` signal §4 demands, and it must stay distinguishable from
 * a zero: a PSU with `psu_wattage = null` is unknown, a GPU with
 * `tdp_watts = 0` claims to draw nothing. A rule whose inputs are null returns
 * `insufficient_data`, never `compatible`.
 *
 * One wide nullable table rather than a table per category: the joins stay
 * simple and the engine reads a fixed column set. Worth revisiting only if the
 * categories diverge much harder than PC components do.
 */
export const productSpecs = pgTable(
  "product_specs",
  {
    /** Which slot the socket belongs to — CPU, motherboard and cooler share it. */
    categorySlug: text("category_slug").notNull(),
    chipset: text("chipset"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /** Genuinely category-specific leftovers the engine does not read. */
    extra: jsonb("extra").$type<Record<string, unknown>>(),
    /** Motherboard (ATX/mATX/ITX), case, and PSU (ATX/SFX) form factor. */
    formFactor: text("form_factor"),
    heightMm: integer("height_mm"),
    id: uuid("id").defaultRandom().primaryKey(),
    lengthMm: integer("length_mm"),
    m2Slots: integer("m2_slots"),
    /** Case clearance for a cooler tower. */
    maxCoolerHeightMm: integer("max_cooler_height_mm"),
    /** Case clearance for a graphics card. */
    maxGpuLengthMm: integer("max_gpu_length_mm"),
    /** Per stick for a kit; total supported for a board. */
    memoryCapacityGb: integer("memory_capacity_gb"),
    memorySlots: integer("memory_slots"),
    memorySpeedMhz: integer("memory_speed_mhz"),
    /** "DDR4" | "DDR5" — the generation, not the speed. */
    memoryType: text("memory_type"),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /**
     * On a GPU, the connectors it requires; on a PSU, the connectors it
     * provides. Same shape, read in opposite directions by
     * `psu_gpu_connectors`.
     */
    pciePowerConnectors: jsonb("pcie_power_connectors").$type<
      PciePowerConnector[]
    >(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    psuWattage: integer("psu_wattage"),
    /** The vendor's own recommendation for a system built around this part. */
    recommendedPsuWatts: integer("recommended_psu_watts"),
    sataPorts: integer("sata_ports"),
    /** CPU, motherboard and cooler socket, e.g. "AM5" | "LGA1700". */
    socket: text("socket"),
    /** "M.2 NVMe" | "SATA". */
    storageInterface: text("storage_interface"),
    /** Sustained power draw under load, in watts. */
    tdpWatts: integer("tdp_watts"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    widthMm: integer("width_mm"),
  },
  (table) => [
    uniqueIndex("product_specs_productId_uidx").on(table.productId),
    index("product_specs_merchantId_idx").on(table.merchantId),
    index("product_specs_categorySlug_idx").on(table.categorySlug),
    index("product_specs_socket_idx").on(table.socket),
  ]
);
