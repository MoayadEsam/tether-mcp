/**
 * Tether MCP — Tool Registry
 *
 * Central barrel export for all tool registration functions.
 * Each tool lives in its own file for modularity and testability.
 */

export { registerHealthTool } from "./health.js";
export { registerGetProjectInvariants } from "./get-project-invariants.js";
export { registerVerifyDependencyAddition } from "./verify-dependency-addition.js";
export { registerLogArchitecturalDecision } from "./log-architectural-decision.js";
export { registerCheckFileStructure } from "./check-file-structure.js";
export { registerVerifyCodePattern } from "./verify-code-pattern.js";
