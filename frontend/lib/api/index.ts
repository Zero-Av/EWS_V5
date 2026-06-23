/**
 * lib/api/index.ts
 * Single entry-point for all API feature modules.
 *
 * Import patterns:
 *   import { login }                     from "@/lib/api"           // via shim
 *   import { login }                     from "@/lib/api/auth"      // direct
 *   import { generateBulkRecommendations } from "@/lib/api/interventions"
 */

export * from "./auth"
export * from "./users"
export * from "./llm"
export * from "./surveys"
export * from "./classification"
export * from "./employees"
export * from "./interventions"
export * from "./analytics"
export * from "./training"
