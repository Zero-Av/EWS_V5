/**
 * lib/api.ts — backward-compatibility shim
 *
 * All symbols originally exported from this file are now organised into
 * feature-specific modules under lib/api/*.  This shim re-exports everything
 * so that existing imports such as:
 *
 *   import { login, getTeams } from "@/lib/api"
 *
 * continue to work without any changes to pages or components.
 *
 * New code should import directly from the feature module instead:
 *   import { login }    from "@/lib/api/auth"
 *   import { getTeams } from "@/lib/api/analytics"
 */
export * from "./api/index"
