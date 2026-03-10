/**
 * Tether MCP — Config Watcher
 *
 * Watches tether.config.json for changes and invalidates the cached config.
 * Uses Node.js fs.watch for efficient file system monitoring.
 */

import { watch, type FSWatcher } from "node:fs";
import { resolveProjectPath, fileExists, loadConfig } from "./file.js";
import type { TetherConfig } from "../types/config.js";

const CONFIG_FILENAME = "tether.config.json";

let cachedConfig: TetherConfig | null = null;
let watcher: FSWatcher | null = null;
let isWatching = false;

/**
 * Loads the config, caching it for subsequent calls.
 * When watch mode is enabled, the cache auto-invalidates on file changes.
 */
export async function loadCachedConfig(): Promise<TetherConfig> {
    if (cachedConfig) {
        return cachedConfig;
    }

    cachedConfig = await loadConfig();
    return cachedConfig;
}

/**
 * Invalidates the cached config, forcing a reload on next access.
 */
export function invalidateConfigCache(): void {
    cachedConfig = null;
}

/**
 * Starts watching tether.config.json for changes.
 * When the file changes, the cached config is invalidated.
 */
export async function startConfigWatch(): Promise<void> {
    if (isWatching) return;

    const configPath = resolveProjectPath(CONFIG_FILENAME);

    if (!(await fileExists(configPath))) {
        return;
    }

    try {
        watcher = watch(configPath, (eventType) => {
            if (eventType === "change") {
                invalidateConfigCache();
            }
        });

        watcher.on("error", () => {
            // Silently handle watch errors — config will just reload on next access
            stopConfigWatch();
        });

        isWatching = true;
    } catch {
        // fs.watch not supported on this platform — fall back to no caching
        isWatching = false;
    }
}

/**
 * Stops watching tether.config.json.
 */
export function stopConfigWatch(): void {
    if (watcher) {
        watcher.close();
        watcher = null;
    }
    isWatching = false;
    cachedConfig = null;
}
