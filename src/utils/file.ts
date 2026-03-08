/**
 * Tether MCP — File Utilities
 *
 * Handles reading/writing the config file, architecture docs,
 * and decision ledger. All paths are resolved relative to
 * the project root (cwd).
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { TetherConfigSchema, type TetherConfig } from "../types/config.js";

const CONFIG_FILENAME = "tether.config.json";

/**
 * Resolves a path relative to the project root.
 * Uses the TETHER_PROJECT_ROOT env var if set, otherwise cwd.
 */
export function resolveProjectPath(relativePath: string): string {
    const root = process.env.TETHER_PROJECT_ROOT || process.cwd();
    return resolve(root, relativePath);
}

/**
 * Checks if a file exists at the given absolute path.
 */
export async function fileExists(absolutePath: string): Promise<boolean> {
    try {
        await access(absolutePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads and validates tether.config.json from the project root.
 * Returns the parsed config or throws a descriptive error.
 */
export async function loadConfig(): Promise<TetherConfig> {
    const configPath = resolveProjectPath(CONFIG_FILENAME);

    if (!(await fileExists(configPath))) {
        throw new Error(
            `Tether config not found at ${configPath}. ` +
            `Create a tether.config.json in your project root.`
        );
    }

    const raw = await readFile(configPath, "utf-8");

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(
            `Invalid JSON in ${configPath}. Please check the file syntax.`
        );
    }

    const result = TetherConfigSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");
        throw new Error(`Invalid tether.config.json:\n${issues}`);
    }

    return result.data;
}

/**
 * Reads a markdown file relative to the project root.
 * Returns the content string or null if the file doesn't exist.
 */
export async function readMarkdownFile(
    relativePath: string
): Promise<string | null> {
    const fullPath = resolveProjectPath(relativePath);
    if (!(await fileExists(fullPath))) {
        return null;
    }
    return readFile(fullPath, "utf-8");
}

/**
 * Appends content to a file, creating it if it doesn't exist.
 */
export async function appendToFile(
    relativePath: string,
    content: string
): Promise<string> {
    const fullPath = resolveProjectPath(relativePath);

    let existing = "";
    if (await fileExists(fullPath)) {
        existing = await readFile(fullPath, "utf-8");
    }

    await writeFile(fullPath, existing + content, "utf-8");
    return fullPath;
}

/**
 * Reads and parses the project's package.json.
 * Returns the parsed object or null if not found.
 */
export async function readPackageJson(): Promise<Record<
    string,
    unknown
> | null> {
    const pkgPath = resolveProjectPath("package.json");
    if (!(await fileExists(pkgPath))) {
        return null;
    }

    const raw = await readFile(pkgPath, "utf-8");
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return null;
    }
}
