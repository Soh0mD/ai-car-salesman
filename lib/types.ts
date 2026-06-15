import { z } from "zod";

/**
 * Core data contracts that bridge the conversational AI and the data-aggregation layer.
 * The LLM fills `SearchPlan` via tool-use (guaranteeing valid JSON); every inventory
 * source normalizes its results into `NormalizedListing`.
 */

export const yearRangeSchema = z.object({
  min: z.number().int(),
  max: z.number().int(),
});

export const suggestedModelSchema = z.object({
  make: z.string(),
  model: z.string(),
  years: yearRangeSchema,
});

export const constraintsSchema = z.object({
  budget_max: z.number().nullable().optional(),
  budget_min: z.number().nullable().optional(),
  zip_code: z.string().nullable().optional(),
  radius_miles: z.number().nullable().optional(),
  min_seating_capacity: z.number().nullable().optional(),
  fuel_efficiency_priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  intended_use: z.string().nullable().optional(),
  max_mileage: z.number().nullable().optional(),
  year_min: z.number().nullable().optional(),
  year_max: z.number().nullable().optional(),
  transmission: z.enum(["manual", "automatic"]).nullable().optional(),
  fuel_type: z.enum(["gas", "hybrid", "electric", "diesel"]).nullable().optional(),
  cylinders: z.number().nullable().optional(),
  keywords: z.string().nullable().optional(),
});

export const mechanicalFiltersSchema = z.object({
  reliability_tier: z.enum(["any", "high", "highest"]).nullable().optional(),
  preferred_drivetrains: z.array(z.string()).default([]),
  // Known failure-prone powertrains to avoid, e.g. "early Nissan CVT", "dry-clutch DCT".
  excluded_powertrains: z.array(z.string()).default([]),
});

export const automotiveTargetsSchema = z.object({
  body_styles: z.array(z.string()).default([]),
  excluded_body_styles: z.array(z.string()).default([]),
  suggested_models: z.array(suggestedModelSchema).default([]),
  // Defaulted so a slightly-incomplete tool response (Haiku is less strict than Sonnet) still
  // parses instead of throwing and killing the whole search.
  mechanical_filters: mechanicalFiltersSchema.default({
    preferred_drivetrains: [],
    excluded_powertrains: [],
  }),
});

export const searchPlanSchema = z.object({
  constraints: constraintsSchema,
  automotive_targets: automotiveTargetsSchema,
});

export type YearRange = z.infer<typeof yearRangeSchema>;
export type SuggestedModel = z.infer<typeof suggestedModelSchema>;
export type Constraints = z.infer<typeof constraintsSchema>;
export type AutomotiveTargets = z.infer<typeof automotiveTargetsSchema>;
export type SearchPlan = z.infer<typeof searchPlanSchema>;

/**
 * The fixed, structured answer set collected by the guided wizard. Always the same shape,
 * which makes results consistent and repeatable (identical profile -> identical search).
 */
export interface WizardProfile {
  budget_max: number;
  zip_code: string;
  radius_miles: number;
  seats: number; // minimum seating capacity
  year_min: number;
  year_max: number;
  max_mileage: number;
  primary_use: "commute" | "family" | "fun" | "first_car" | "work";
  fuel_priority: "low" | "medium" | "high";
  safety: number; // 1-5
  fun: number; // 1-5
  drivetrain: "any" | "awd" | "fwd" | "rwd";
  transmission: "any" | "automatic" | "manual";
  fuel: "any" | "gas" | "hybrid" | "electric" | "diesel";
  cylinders: number; // 0 = any
  keywords: string;
  body_styles: string[];
  excluded_body_styles: string[];
}

export type ListingSource = "marketcheck" | "ebay" | "autodev";

export type ReliabilitySeverity = "avoid" | "caution";

/** A deterministic, curated warning matched against a listing's make/model/year. */
export interface ReliabilityFlag {
  severity: ReliabilitySeverity;
  issue: string;
}

/** The single shape every inventory source is normalized into. */
export interface NormalizedListing {
  source: ListingSource;
  title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  vin: string | null;
  zip: string | null;
  distance_miles: number | null;
  image_url: string | null;
  images: string[]; // full photo set, for the in-site detail view
  listing_url: string;
  dealer_name: string | null;
  drivetrain: string | null;
  transmission: string | null;
  fuel_type: string | null;
  cylinders: number | null;
  body_style: string | null;
  recall_count: number | null;
  /** Live NHTSA consumer-complaint volume (total + powertrain subset), null if unavailable. */
  complaints: { total: number; powertrain: number } | null;
  /** Curated known-issue warning for this make/model/year, if any (see lib/reliability.ts). */
  reliability_flag: ReliabilityFlag | null;
  /** 0..100 composite of price-vs-budget, proximity, recalls, reliability match. */
  value_score: number;
}
