#!/usr/bin/env node

/**
 * Tether MCP — CLI
 *
 * Usage:
 *   npx tether-mcp init    — Scans your project & generates tether.config.json
 *   npx tether-mcp serve   — Starts the MCP server (stdio transport)
 *   npx tether-mcp         — Starts the MCP server (default)
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { detectProjectStack } from "./utils/detect-stack.js";
import { loadConfig, fileExists, resolveProjectPath } from "./utils/file.js";
import { TetherConfigSchema } from "./types/config.js";
import type { TetherConfig } from "./types/config.js";

// ── ANSI helpers ──────────────────────────────────────────────

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const CHECK = `${GREEN}✔${RESET}`;
const WARN = `${YELLOW}⚠${RESET}`;
const CROSS = `${RED}✖${RESET}`;

function banner(): void {
    console.log();
    console.log(
        `${BOLD}${CYAN}  ⚓ Tether MCP${RESET}  ${DIM}— The anti-drift engine for AI agents${RESET}`
    );
    console.log();
}

function success(msg: string): void {
    console.log(`  ${CHECK}  ${msg}`);
}

function warn(msg: string): void {
    console.log(`  ${WARN}  ${msg}`);
}

function info(msg: string): void {
    console.log(`  ${DIM}${msg}${RESET}`);
}

// ── init Command ──────────────────────────────────────────────

async function runInit(): Promise<void> {
    banner();
    console.log(`  ${BOLD}Initializing Tether for this project...${RESET}`);
    console.log();

    const cwd = process.cwd();
    const configPath = resolve(cwd, "tether.config.json");

    // Guard: already initialized
    if (await fileExists(configPath)) {
        console.log(
            `  ${CROSS}  ${RED}tether.config.json already exists.${RESET}`
        );
        console.log(
            `     ${DIM}Delete it first if you want to regenerate.${RESET}`
        );
        console.log();
        process.exit(1);
    }

    // Try to detect project stack across all ecosystems
    let config: TetherConfig;

    const stack = await detectProjectStack(cwd);

    if (stack.frameworks.length > 0) {
        success(
            `Detected stack: ${BOLD}${stack.frameworks.join(", ")}${RESET}`
        );
    } else {
        warn("No known framework detected. Using sensible defaults.");
    }

    config = {
        projectName: stack.projectName,
        techStack: stack.techStack,
        invariants: stack.suggestedInvariants.length > 0
            ? stack.suggestedInvariants
            : [
                "All new code must include appropriate error handling.",
                "Document public APIs with appropriate documentation comments.",
                "Follow the existing code style and conventions.",
            ],
        dependencies: {
            allowed: stack.suggestedAllowed,
            blocked: stack.suggestedBlocked,
            reviewRequired: stack.suggestedReviewRequired,
        },
        fileStructure: [],
        codePatterns: [],
        architectureFile: "ARCHITECTURE.md",
        decisionsFile: "DECISIONS.md",
    };

    // Write the config
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    success(`Created ${BOLD}tether.config.json${RESET}`);

    // Print summary
    console.log();
    console.log(`  ${BOLD}What's next?${RESET}`);
    console.log();
    info("  1. Review and customize tether.config.json");
    info("  2. Optionally create an ARCHITECTURE.md for richer context");
    info("  3. Connect Tether to your AI agent:\n");

    console.log(`  ${DIM}┌─ Claude Code ──────────────────────────────────────┐${RESET}`);
    console.log(`  ${DIM}│${RESET}  Add to ${BOLD}~/.claude/claude_desktop_config.json${RESET}:     ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}                                                    ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}"tether": {${RESET}                                     ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}  "command": "npx",${RESET}                              ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}  "args": ["-y", "tether-mcp"]${RESET}                   ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}}${RESET}                                                ${DIM}│${RESET}`);
    console.log(`  ${DIM}└────────────────────────────────────────────────────┘${RESET}`);
    console.log();
    console.log(`  ${DIM}┌─ Cursor ───────────────────────────────────────────┐${RESET}`);
    console.log(`  ${DIM}│${RESET}  Add to ${BOLD}.cursor/mcp.json${RESET}:                         ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}                                                    ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}"tether": {${RESET}                                     ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}  "command": "npx",${RESET}                              ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}  "args": ["-y", "tether-mcp"]${RESET}                   ${DIM}│${RESET}`);
    console.log(`  ${DIM}│${RESET}  ${CYAN}}${RESET}                                                ${DIM}│${RESET}`);
    console.log(`  ${DIM}└────────────────────────────────────────────────────┘${RESET}`);
    console.log();
    success(`${BOLD}Tether is ready. Your AI agent now has guardrails.${RESET} ⚓`);
    console.log();
}

// ── serve Command (default) ───────────────────────────────────

async function runServe(): Promise<void> {
    // Dynamic import to avoid loading server deps during init
    const { createServer } = await import("./server.js");
    const { StdioServerTransport } = await import(
        "@modelcontextprotocol/sdk/server/stdio.js"
    );

    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    process.on("SIGINT", async () => {
        await server.close();
        process.exit(0);
    });

    process.on("SIGTERM", async () => {
        await server.close();
        process.exit(0);
    });
}

// ── status Command ────────────────────────────────────────────

async function runStatus(): Promise<void> {
    banner();
    console.log(`  ${BOLD}Project Status${RESET}`);
    console.log();

    const cwd = process.cwd();
    const configPath = resolve(cwd, "tether.config.json");

    // Check config file
    if (!(await fileExists(configPath))) {
        console.log(`  ${CROSS}  ${RED}No tether.config.json found.${RESET}`);
        console.log(`     ${DIM}Run ${CYAN}npx tether-mcp init${DIM} to get started.${RESET}`);
        console.log();
        process.exit(1);
    }

    try {
        const config = await loadConfig();

        success(`Config: ${BOLD}tether.config.json${RESET} ${GREEN}(valid)${RESET}`);
        success(`Project: ${BOLD}${config.projectName}${RESET}`);

        // Tech stack
        const stackCategories = Object.keys(config.techStack);
        if (stackCategories.length > 0) {
            const totalTech = Object.values(config.techStack).flat().length;
            success(`Tech Stack: ${BOLD}${totalTech}${RESET} technologies in ${BOLD}${stackCategories.length}${RESET} categories`);
        } else {
            warn("Tech Stack: none defined");
        }

        // Invariants
        success(`Invariants: ${BOLD}${config.invariants.length}${RESET} rules defined`);

        // Dependencies
        const { blocked, allowed, reviewRequired } = config.dependencies;
        success(
            `Dependencies: ${BOLD}${blocked.length}${RESET} blocked, ` +
            `${BOLD}${allowed.length}${RESET} allowed, ` +
            `${BOLD}${reviewRequired.length}${RESET} review-required`
        );

        // File structure rules
        const fileRules = config.fileStructure || [];
        if (fileRules.length > 0) {
            success(`File Structure: ${BOLD}${fileRules.length}${RESET} rules defined`);
        }

        // Code patterns
        const patterns = config.codePatterns || [];
        if (patterns.length > 0) {
            success(`Code Patterns: ${BOLD}${patterns.length}${RESET} patterns defined`);
        }

        // Architecture file
        const archPath = resolveProjectPath(config.architectureFile);
        if (await fileExists(archPath)) {
            success(`Architecture: ${BOLD}${config.architectureFile}${RESET} ${GREEN}(found)${RESET}`);
        } else {
            warn(`Architecture: ${config.architectureFile} ${YELLOW}(not found)${RESET}`);
        }

        // Decisions file
        const decisionsPath = resolveProjectPath(config.decisionsFile);
        if (await fileExists(decisionsPath)) {
            success(`Decisions: ${BOLD}${config.decisionsFile}${RESET} ${GREEN}(found)${RESET}`);
        } else {
            info(`   Decisions: ${config.decisionsFile} (will be created on first log)`);
        }

        console.log();
        console.log(`  ${BOLD}${GREEN}⚓ Tether is properly configured.${RESET}`);
        console.log();
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.log(`  ${CROSS}  ${RED}Config error: ${message}${RESET}`);
        console.log();
        process.exit(1);
    }
}

// ── validate Command ──────────────────────────────────────────

async function runValidate(): Promise<void> {
    banner();
    console.log(`  ${BOLD}Validating tether.config.json...${RESET}`);
    console.log();

    const cwd = process.cwd();
    const configPath = resolve(cwd, "tether.config.json");

    if (!(await fileExists(configPath))) {
        console.log(`  ${CROSS}  ${RED}No tether.config.json found.${RESET}`);
        console.log(`     ${DIM}Run ${CYAN}npx tether-mcp init${DIM} to create one.${RESET}`);
        console.log();
        process.exit(1);
    }

    const raw = await readFile(configPath, "utf-8");

    // Check JSON syntax
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
        success("JSON syntax is valid");
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown parse error";
        console.log(`  ${CROSS}  ${RED}Invalid JSON syntax: ${message}${RESET}`);
        console.log();
        process.exit(1);
    }

    // Validate against schema
    const result = TetherConfigSchema.safeParse(parsed);
    if (result.success) {
        success("Schema validation passed");

        const config = result.data;
        let warnings = 0;

        // Warnings for empty/missing sections
        if (config.invariants.length === 0) {
            warn("No invariants defined — consider adding architectural rules");
            warnings++;
        }

        if (Object.keys(config.techStack).length === 0) {
            warn("No tech stack defined — framework detection won't work as well");
            warnings++;
        }

        if (config.dependencies.blocked.length === 0 && config.dependencies.allowed.length === 0) {
            warn("No dependency rules — consider blocking problematic packages");
            warnings++;
        }

        console.log();
        if (warnings > 0) {
            console.log(`  ${BOLD}${YELLOW}⚓ Config is valid with ${warnings} warning(s).${RESET}`);
        } else {
            console.log(`  ${BOLD}${GREEN}⚓ Config is fully valid. No issues found.${RESET}`);
        }
    } else {
        console.log(`  ${CROSS}  ${RED}Schema validation failed:${RESET}`);
        for (const issue of result.error.issues) {
            console.log(`     ${RED}- ${issue.path.join(".")}: ${issue.message}${RESET}`);
        }
        console.log();
        process.exit(1);
    }

    console.log();
}

// ── Main Router ───────────────────────────────────────────────

import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = _require("../package.json") as { version: string };

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case "init":
            await runInit();
            break;

        case "serve":
        case undefined:
            await runServe();
            break;

        case "status":
            await runStatus();
            break;

        case "validate":
            await runValidate();
            break;

        case "--version":
        case "-v":
            console.log(`tether-mcp v${PACKAGE_VERSION}`);
            break;

        case "--help":
        case "-h":
            banner();
            console.log(`  ${BOLD}Usage:${RESET}`);
            console.log();
            console.log(`    ${CYAN}npx tether-mcp init${RESET}       Scan project & generate tether.config.json`);
            console.log(`    ${CYAN}npx tether-mcp serve${RESET}      Start the MCP server (stdio)`);
            console.log(`    ${CYAN}npx tether-mcp status${RESET}     Show project config summary`);
            console.log(`    ${CYAN}npx tether-mcp validate${RESET}   Validate tether.config.json schema`);
            console.log(`    ${CYAN}npx tether-mcp --version${RESET}  Show version`);
            console.log(`    ${CYAN}npx tether-mcp${RESET}            Start the MCP server (default)`);
            console.log();
            break;

        default:
            console.error(`${CROSS}  Unknown command: "${command}". Run ${CYAN}npx tether-mcp --help${RESET}`);
            process.exit(1);
    }
}

main().catch((error) => {
    console.error(`${CROSS}  Fatal error:`, error);
    process.exit(1);
});
