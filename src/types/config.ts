/**
 * Tether MCP — Configuration Types
 *
 * Defines the schema for tether.config.json using Zod,
 * providing runtime validation and TypeScript inference.
 */

import { z } from "zod";

// ── Zod Schemas ───────────────────────────────────────────────

export const DependencyRulesSchema = z.object({
    /** Packages explicitly allowed without review */
    allowed: z.array(z.string()).default([]),
    /** Packages that must never be added */
    blocked: z
        .array(
            z.object({
                name: z.string(),
                reason: z.string(),
                alternatives: z.array(z.string()).default([]),
                /** Severity: "block" hard-stops, "warn" allows with a warning. Defaults to "block". */
                severity: z.enum(["block", "warn"]).optional(),
            })
        )
        .default([]),
    /** Packages that require explicit justification */
    reviewRequired: z.array(z.string()).default([]),
});

export const FileStructureRuleSchema = z.object({
    /** Glob-like pattern for the rule (e.g. "components", "api/routes") */
    pattern: z.string(),
    /** Required base directory for files matching this pattern */
    allowedPaths: z.array(z.string()),
    /** Human-readable explanation of why this rule exists */
    reason: z.string().optional(),
});

export const CodePatternSchema = z.object({
    /** Name of the pattern rule */
    name: z.string(),
    /** What to enforce (e.g., "Use useReducer for complex state") */
    rule: z.string(),
    /** Where this pattern applies (e.g., "frontend/state", "api/*") */
    scope: z.string().optional(),
});

export const TetherConfigSchema = z.object({
    /** Display name for the project */
    projectName: z.string(),

    /** Enforced technology stack — categories are user-defined */
    techStack: z.record(z.string(), z.array(z.string())).default({}),

    /** Immutable architectural rules the LLM must respect */
    invariants: z.array(z.string()).default([]),

    /** Dependency governance rules */
    dependencies: DependencyRulesSchema.default({}),

    /** File structure conventions — where certain types of files should live */
    fileStructure: z.array(FileStructureRuleSchema).default([]),

    /** Code pattern enforcement rules */
    codePatterns: z.array(CodePatternSchema).default([]),

    /** Path to a Markdown file with extended architecture docs */
    architectureFile: z.string().default("ARCHITECTURE.md"),

    /** Path to the decision ledger */
    decisionsFile: z.string().default("DECISIONS.md"),
});

// ── Inferred Types ────────────────────────────────────────────

export type TetherConfig = z.infer<typeof TetherConfigSchema>;
export type DependencyRules = z.infer<typeof DependencyRulesSchema>;

// ── Decision Ledger Types ─────────────────────────────────────

export interface ArchitecturalDecision {
    /** Short descriptive title */
    title: string;
    /** What was decided and why */
    summary: string;
    /** Which component or area this affects */
    scope: string;
    /** ISO timestamp */
    timestamp: string;
}
