/**
 * Tether MCP — Multi-Ecosystem Framework Detector
 *
 * Scans package.json, pubspec.yaml, .csproj, pyproject.toml,
 * requirements.txt, go.mod, Cargo.toml, build.gradle, pom.xml,
 * and Package.swift to detect frameworks across 7+ ecosystems.
 * Returns a structured profile used to generate a smart
 * tether.config.json.
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";

// ── Types ─────────────────────────────────────────────────────

export interface DetectedStack {
    projectName: string;
    frameworks: string[];
    techStack: Record<string, string[]>;
    suggestedInvariants: string[];
    suggestedBlocked: Array<{
        name: string;
        reason: string;
        alternatives: string[];
    }>;
    suggestedAllowed: string[];
    suggestedReviewRequired: string[];
}

interface FrameworkSignature {
    /** npm package that signals this framework */
    dep: string;
    /** Human-readable name */
    label: string;
    /** Category in techStack */
    category: string;
    /** Invariants to suggest when detected */
    invariants: string[];
    /** Packages to auto-allow */
    allowed: string[];
    /** Packages to block */
    blocked: Array<{ name: string; reason: string; alternatives: string[] }>;
}

interface EcosystemSignature {
    /** Dependency key to match (package name, module path, or group:artifact) */
    key: string;
    /** Human-readable name */
    label: string;
    /** Category in techStack */
    category: string;
    /** Invariants to suggest when detected */
    invariants: string[];
    /** Packages to auto-allow */
    allowed: string[];
    /** Packages to block */
    blocked: Array<{ name: string; reason: string; alternatives: string[] }>;
}

// ── Framework Signatures ──────────────────────────────────────

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
    {
        dep: "next",
        label: "Next.js",
        category: "frontend",
        invariants: [
            "Use Next.js App Router for all new routes — do not use the Pages Router.",
            "Data fetching must use Server Components or Route Handlers — no getServerSideProps.",
            "All API routes must be in app/api/ using Route Handlers.",
        ],
        allowed: ["next-auth", "@next/font", "sharp"],
        blocked: [
            {
                name: "express",
                reason:
                    "Next.js has built-in API routes. Do not add Express alongside Next.js.",
                alternatives: ["Next.js Route Handlers"],
            },
        ],
    },
    {
        dep: "react",
        label: "React",
        category: "frontend",
        invariants: [
            "Use functional components with hooks — no class components.",
            "Component files must be co-located with their tests and styles.",
        ],
        allowed: ["clsx", "tailwind-merge", "react-hook-form"],
        blocked: [
            {
                name: "jquery",
                reason: "Incompatible with React's virtual DOM.",
                alternatives: [],
            },
        ],
    },
    {
        dep: "vue",
        label: "Vue.js",
        category: "frontend",
        invariants: [
            "Use the Composition API for all new components — no Options API.",
            "State management via Pinia — do not use Vuex.",
        ],
        allowed: ["pinia", "@vueuse/core"],
        blocked: [
            {
                name: "vuex",
                reason: "Project uses Pinia for state management.",
                alternatives: ["pinia"],
            },
        ],
    },
    {
        dep: "svelte",
        label: "Svelte",
        category: "frontend",
        invariants: [
            "Use SvelteKit for routing and SSR — do not add a separate router.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        dep: "express",
        label: "Express",
        category: "backend",
        invariants: [
            "All routes must use middleware for input validation.",
            "Error handling must go through the centralized error middleware.",
        ],
        allowed: ["helmet", "cors", "morgan", "compression"],
        blocked: [],
    },
    {
        dep: "fastify",
        label: "Fastify",
        category: "backend",
        invariants: [
            "Use Fastify's built-in schema validation — do not add Express-style middleware.",
            "Plugins must be registered via the Fastify plugin system.",
        ],
        allowed: ["@fastify/cors", "@fastify/helmet"],
        blocked: [
            {
                name: "express",
                reason: "Project uses Fastify. Do not mix Express.",
                alternatives: ["Fastify plugins"],
            },
        ],
    },
    {
        dep: "@nestjs/core",
        label: "NestJS",
        category: "backend",
        invariants: [
            "Follow NestJS module architecture — controllers, services, and modules.",
            "Use dependency injection via NestJS DI container — no manual instantiation.",
        ],
        allowed: ["class-validator", "class-transformer", "@nestjs/swagger"],
        blocked: [],
    },
    {
        dep: "hono",
        label: "Hono",
        category: "backend",
        invariants: [
            "Use Hono's middleware pattern for all cross-cutting concerns.",
        ],
        allowed: ["@hono/zod-validator"],
        blocked: [],
    },
    // ── ORMs ──
    {
        dep: "prisma",
        label: "Prisma",
        category: "orm",
        invariants: [
            "All database access must go through Prisma — no raw SQL queries.",
        ],
        allowed: [],
        blocked: [
            {
                name: "typeorm",
                reason: "Project uses Prisma. Do not add a second ORM.",
                alternatives: ["prisma"],
            },
            {
                name: "sequelize",
                reason: "Project uses Prisma. Do not add a second ORM.",
                alternatives: ["prisma"],
            },
        ],
    },
    {
        dep: "drizzle-orm",
        label: "Drizzle ORM",
        category: "orm",
        invariants: [
            "All database access must go through Drizzle ORM.",
        ],
        allowed: [],
        blocked: [
            {
                name: "prisma",
                reason: "Project uses Drizzle. Do not add a second ORM.",
                alternatives: ["drizzle-orm"],
            },
        ],
    },
    // ── Testing ──
    {
        dep: "vitest",
        label: "Vitest",
        category: "testing",
        invariants: [
            "All tests must use Vitest — do not add Jest.",
        ],
        allowed: ["@testing-library/react", "@testing-library/vue"],
        blocked: [
            {
                name: "jest",
                reason: "Project uses Vitest for testing.",
                alternatives: ["vitest"],
            },
        ],
    },
    {
        dep: "jest",
        label: "Jest",
        category: "testing",
        invariants: [],
        allowed: ["@testing-library/react", "@testing-library/jest-dom"],
        blocked: [],
    },
    // ── CSS ──
    {
        dep: "tailwindcss",
        label: "Tailwind CSS",
        category: "styling",
        invariants: [
            "Use Tailwind utility classes for styling — no inline styles or external CSS frameworks.",
        ],
        allowed: ["tailwind-merge", "clsx", "class-variance-authority"],
        blocked: [
            {
                name: "bootstrap",
                reason: "Project uses Tailwind CSS. Do not add Bootstrap.",
                alternatives: ["tailwindcss"],
            },
        ],
    },
    // ── Runtimes ──
    {
        dep: "typescript",
        label: "TypeScript",
        category: "language",
        invariants: [
            "All new code must be written in TypeScript with strict mode enabled.",
            "Do not use 'any' type — use 'unknown' with type guards instead.",
        ],
        allowed: ["zod", "ts-pattern"],
        blocked: [],
    },
    // ── Additional Frontend Frameworks ──
    {
        dep: "@angular/core",
        label: "Angular",
        category: "frontend",
        invariants: [
            "Follow Angular module architecture with lazy-loaded feature modules.",
            "Use Angular Reactive Forms for complex forms — no template-driven forms.",
            "Services must be provided in root or feature module scope — no manual instantiation.",
        ],
        allowed: ["@ngrx/store", "@angular/material", "ngx-translate"],
        blocked: [
            {
                name: "react",
                reason: "Project uses Angular. Do not mix React.",
                alternatives: ["Angular components"],
            },
            {
                name: "jquery",
                reason: "Incompatible with Angular's change detection.",
                alternatives: [],
            },
        ],
    },
    {
        dep: "nuxt",
        label: "Nuxt",
        category: "frontend",
        invariants: [
            "Use Nuxt's auto-imports and file-based routing — do not install vue-router manually.",
            "Server routes must be in server/api/ — do not add Express or Fastify.",
            "Use composables in composables/ directory for shared reactive logic.",
        ],
        allowed: ["@nuxtjs/tailwindcss", "@pinia/nuxt", "@vueuse/nuxt"],
        blocked: [
            {
                name: "express",
                reason: "Nuxt has built-in server routes (Nitro). Do not add Express.",
                alternatives: ["Nuxt server routes in server/api/"],
            },
            {
                name: "vue-router",
                reason: "Nuxt handles routing via file-based routing. Do not install vue-router separately.",
                alternatives: ["Nuxt file-based routing"],
            },
        ],
    },
    {
        dep: "@remix-run/node",
        label: "Remix",
        category: "frontend",
        invariants: [
            "Use Remix loaders and actions for data fetching — no client-side fetching in components.",
            "Route modules must export loader/action functions — do not use API routes.",
        ],
        allowed: ["@remix-run/react", "@remix-run/css-bundle"],
        blocked: [],
    },
    {
        dep: "astro",
        label: "Astro",
        category: "frontend",
        invariants: [
            "Use Astro components for static content — only use framework components (React/Vue/Svelte) when interactivity is needed.",
            "Prefer server-side rendering with Astro islands for interactive parts.",
        ],
        allowed: ["@astrojs/react", "@astrojs/vue", "@astrojs/tailwind"],
        blocked: [],
    },
    {
        dep: "solid-js",
        label: "SolidJS",
        category: "frontend",
        invariants: [
            "Use SolidJS signals for state — do not destructure props (breaks reactivity).",
            "Use createEffect for side effects — do not use React-style useEffect patterns.",
        ],
        allowed: ["@solidjs/router", "solid-styled-components"],
        blocked: [
            {
                name: "react",
                reason: "Project uses SolidJS. Do not mix React.",
                alternatives: ["SolidJS components"],
            },
        ],
    },
    // ── Additional Backend Frameworks ──
    {
        dep: "koa",
        label: "Koa",
        category: "backend",
        invariants: [
            "Use Koa middleware pattern — do not mix Express middleware.",
            "Error handling must use Koa's ctx.throw or centralized error middleware.",
        ],
        allowed: ["@koa/router", "@koa/cors", "koa-body"],
        blocked: [
            {
                name: "express",
                reason: "Project uses Koa. Do not mix with Express.",
                alternatives: ["Koa middleware"],
            },
        ],
    },
    {
        dep: "elysia",
        label: "Elysia (Bun)",
        category: "backend",
        invariants: [
            "Use Elysia's plugin and decorator patterns for modularity.",
            "Validation must use Elysia's built-in type validation — no external validators.",
        ],
        allowed: ["@elysiajs/swagger", "@elysiajs/cors"],
        blocked: [],
    },
    // ── Additional ORMs / Database ──
    {
        dep: "mongoose",
        label: "Mongoose",
        category: "database",
        invariants: [
            "All MongoDB access must go through Mongoose models — no raw MongoDB driver calls.",
            "Schemas must be defined with strict validation and required fields.",
        ],
        allowed: [],
        blocked: [
            {
                name: "prisma",
                reason: "Project uses Mongoose for MongoDB. Do not add Prisma.",
                alternatives: ["mongoose"],
            },
        ],
    },
    {
        dep: "typeorm",
        label: "TypeORM",
        category: "orm",
        invariants: [
            "All database access must go through TypeORM repositories and entities.",
        ],
        allowed: [],
        blocked: [
            {
                name: "prisma",
                reason: "Project uses TypeORM. Do not add a second ORM.",
                alternatives: ["typeorm"],
            },
            {
                name: "sequelize",
                reason: "Project uses TypeORM. Do not add a second ORM.",
                alternatives: ["typeorm"],
            },
        ],
    },
    {
        dep: "sequelize",
        label: "Sequelize",
        category: "orm",
        invariants: [
            "All database access must go through Sequelize models.",
        ],
        allowed: [],
        blocked: [
            {
                name: "prisma",
                reason: "Project uses Sequelize. Do not add a second ORM.",
                alternatives: ["sequelize"],
            },
        ],
    },
    // ── Additional Testing ──
    {
        dep: "@playwright/test",
        label: "Playwright",
        category: "testing",
        invariants: [
            "End-to-end tests must use Playwright — do not add Cypress.",
        ],
        allowed: [],
        blocked: [
            {
                name: "cypress",
                reason: "Project uses Playwright for E2E testing.",
                alternatives: ["@playwright/test"],
            },
        ],
    },
    {
        dep: "cypress",
        label: "Cypress",
        category: "testing",
        invariants: [
            "End-to-end tests must use Cypress — do not add Playwright.",
        ],
        allowed: [],
        blocked: [
            {
                name: "@playwright/test",
                reason: "Project uses Cypress for E2E testing.",
                alternatives: ["cypress"],
            },
        ],
    },
    // ── Styling ──
    {
        dep: "styled-components",
        label: "Styled Components",
        category: "styling",
        invariants: [
            "Use styled-components for all component styling — no inline styles or CSS modules.",
        ],
        allowed: [],
        blocked: [
            {
                name: "@emotion/styled",
                reason: "Project uses styled-components. Do not mix CSS-in-JS libraries.",
                alternatives: ["styled-components"],
            },
        ],
    },
    {
        dep: "@emotion/react",
        label: "Emotion",
        category: "styling",
        invariants: [
            "Use Emotion for all component styling — no inline styles.",
        ],
        allowed: ["@emotion/styled"],
        blocked: [
            {
                name: "styled-components",
                reason: "Project uses Emotion. Do not mix CSS-in-JS libraries.",
                alternatives: ["@emotion/react", "@emotion/styled"],
            },
        ],
    },
    // ── Bundlers / Build Tools ──
    {
        dep: "vite",
        label: "Vite",
        category: "build",
        invariants: [
            "Use Vite for development and building — configuration goes in vite.config.ts.",
        ],
        allowed: [],
        blocked: [
            {
                name: "webpack",
                reason: "Project uses Vite. Do not add webpack.",
                alternatives: ["vite plugins"],
            },
        ],
    },
    // ── Auth / State ──
    {
        dep: "next-auth",
        label: "NextAuth.js",
        category: "auth",
        invariants: [
            "Authentication must use NextAuth.js — do not implement custom auth flows.",
        ],
        allowed: [],
        blocked: [
            {
                name: "passport",
                reason: "Project uses NextAuth.js for authentication.",
                alternatives: ["next-auth"],
            },
        ],
    },
    {
        dep: "zustand",
        label: "Zustand",
        category: "state",
        invariants: [
            "Client state management must use Zustand — do not add Redux or MobX.",
        ],
        allowed: [],
        blocked: [
            {
                name: "redux",
                reason: "Project uses Zustand for state management.",
                alternatives: ["zustand"],
            },
            {
                name: "@reduxjs/toolkit",
                reason: "Project uses Zustand for state management.",
                alternatives: ["zustand"],
            },
        ],
    },
    {
        dep: "@reduxjs/toolkit",
        label: "Redux Toolkit",
        category: "state",
        invariants: [
            "State management must use Redux Toolkit — no legacy createStore or manual action types.",
        ],
        allowed: ["react-redux", "reselect"],
        blocked: [
            {
                name: "zustand",
                reason: "Project uses Redux Toolkit for state management.",
                alternatives: ["@reduxjs/toolkit"],
            },
            {
                name: "mobx",
                reason: "Project uses Redux Toolkit for state management.",
                alternatives: ["@reduxjs/toolkit"],
            },
        ],
    },
];



// ── Universal blocked packages ────────────────────────────────

const UNIVERSAL_BLOCKED = [
    {
        name: "moment",
        reason: "Deprecated and large bundle size.",
        alternatives: ["date-fns", "dayjs", "luxon"],
    },
];

// ── Detector ──────────────────────────────────────────────────

export function detectStack(
    packageJson: Record<string, unknown>
): DetectedStack {
    const name = (packageJson.name as string) || "my-project";
    const allDeps: Record<string, string> = {
        ...((packageJson.dependencies as Record<string, string>) || {}),
        ...((packageJson.devDependencies as Record<string, string>) || {}),
    };

    const detected: DetectedStack = {
        projectName: name,
        frameworks: [],
        techStack: {},
        suggestedInvariants: [],
        suggestedBlocked: [...UNIVERSAL_BLOCKED],
        suggestedAllowed: [],
        suggestedReviewRequired: ["sharp", "puppeteer", "canvas", "node-gyp"],
    };

    for (const sig of FRAMEWORK_SIGNATURES) {
        if (allDeps[sig.dep]) {
            detected.frameworks.push(sig.label);

            // Merge into techStack
            if (!detected.techStack[sig.category]) {
                detected.techStack[sig.category] = [];
            }
            detected.techStack[sig.category].push(sig.label);

            // Merge invariants
            detected.suggestedInvariants.push(...sig.invariants);

            // Merge allowed (dedupe)
            for (const a of sig.allowed) {
                if (!detected.suggestedAllowed.includes(a)) {
                    detected.suggestedAllowed.push(a);
                }
            }

            // Merge blocked (dedupe by name)
            for (const b of sig.blocked) {
                if (!detected.suggestedBlocked.some((x) => x.name === b.name)) {
                    detected.suggestedBlocked.push(b);
                }
            }
        }
    }

    return detected;
}

// ══════════════════════════════════════════════════════════════
// MULTI-ECOSYSTEM DETECTION ENGINE
// ══════════════════════════════════════════════════════════════

// ── Generic Ecosystem Detector ────────────────────────────────

function detectFromSignatures(
    projectName: string,
    deps: Set<string>,
    signatures: EcosystemSignature[],
    matchFn: (dep: string, key: string) => boolean
): DetectedStack {
    const detected: DetectedStack = {
        projectName,
        frameworks: [],
        techStack: {},
        suggestedInvariants: [],
        suggestedBlocked: [],
        suggestedAllowed: [],
        suggestedReviewRequired: [],
    };

    for (const sig of signatures) {
        const isMatch = Array.from(deps).some((d) => matchFn(d, sig.key));
        if (isMatch) {
            detected.frameworks.push(sig.label);

            if (!detected.techStack[sig.category]) {
                detected.techStack[sig.category] = [];
            }
            detected.techStack[sig.category].push(sig.label);

            detected.suggestedInvariants.push(...sig.invariants);

            for (const a of sig.allowed) {
                if (!detected.suggestedAllowed.includes(a)) {
                    detected.suggestedAllowed.push(a);
                }
            }

            for (const b of sig.blocked) {
                if (!detected.suggestedBlocked.some((x) => x.name === b.name)) {
                    detected.suggestedBlocked.push(b);
                }
            }
        }
    }

    return detected;
}

// ── Merge Helper ──────────────────────────────────────────────

export function mergeStacks(a: DetectedStack, b: DetectedStack): DetectedStack {
    const merged: DetectedStack = {
        projectName: a.projectName,
        frameworks: [...a.frameworks],
        techStack: { ...a.techStack },
        suggestedInvariants: [...a.suggestedInvariants],
        suggestedBlocked: [...a.suggestedBlocked],
        suggestedAllowed: [...a.suggestedAllowed],
        suggestedReviewRequired: [...a.suggestedReviewRequired],
    };

    for (const f of b.frameworks) {
        if (!merged.frameworks.includes(f)) {
            merged.frameworks.push(f);
        }
    }

    for (const [category, items] of Object.entries(b.techStack)) {
        if (!merged.techStack[category]) {
            merged.techStack[category] = [];
        }
        for (const item of items) {
            if (!merged.techStack[category].includes(item)) {
                merged.techStack[category].push(item);
            }
        }
    }

    merged.suggestedInvariants.push(...b.suggestedInvariants);

    for (const block of b.suggestedBlocked) {
        if (!merged.suggestedBlocked.some((x) => x.name === block.name)) {
            merged.suggestedBlocked.push(block);
        }
    }

    for (const item of b.suggestedAllowed) {
        if (!merged.suggestedAllowed.includes(item)) {
            merged.suggestedAllowed.push(item);
        }
    }

    for (const r of b.suggestedReviewRequired) {
        if (!merged.suggestedReviewRequired.includes(r)) {
            merged.suggestedReviewRequired.push(r);
        }
    }

    return merged;
}

// ══════════════════════════════════════════════════════════════
// PYTHON ECOSYSTEM
// ══════════════════════════════════════════════════════════════

const PYTHON_SIGNATURES: EcosystemSignature[] = [
    {
        key: "django",
        label: "Django",
        category: "backend",
        invariants: [
            "Use Django's ORM for all database access — no raw SQL queries.",
            "Follow Django's app-based architecture — each feature is a separate Django app.",
            "Use class-based views for complex views, function-based for simple endpoints.",
        ],
        allowed: ["djangorestframework", "django-cors-headers", "django-filter", "celery"],
        blocked: [
            {
                name: "flask",
                reason: "Project uses Django. Do not mix Python web frameworks.",
                alternatives: ["Django views", "Django REST Framework"],
            },
            {
                name: "fastapi",
                reason: "Project uses Django. Do not mix Python web frameworks.",
                alternatives: ["Django views", "Django REST Framework"],
            },
        ],
    },
    {
        key: "flask",
        label: "Flask",
        category: "backend",
        invariants: [
            "Use Flask Blueprints for route organization — no monolithic app.py.",
            "Request validation must use a dedicated library (Marshmallow, Pydantic, or Flask-WTF).",
        ],
        allowed: ["flask-cors", "flask-sqlalchemy", "flask-migrate", "flask-wtf"],
        blocked: [
            {
                name: "django",
                reason: "Project uses Flask. Do not add Django alongside Flask.",
                alternatives: ["Flask extensions"],
            },
        ],
    },
    {
        key: "fastapi",
        label: "FastAPI",
        category: "backend",
        invariants: [
            "Use Pydantic models for all request/response validation.",
            "All endpoints must have type annotations and return types.",
            "Use FastAPI's dependency injection system — no manual instantiation.",
        ],
        allowed: ["uvicorn", "pydantic", "python-multipart", "httpx"],
        blocked: [
            {
                name: "flask",
                reason: "Project uses FastAPI. Do not mix Python web frameworks.",
                alternatives: ["FastAPI routers"],
            },
            {
                name: "django",
                reason: "Project uses FastAPI. Do not mix Python web frameworks.",
                alternatives: ["FastAPI routers"],
            },
        ],
    },
    {
        key: "sqlalchemy",
        label: "SQLAlchemy",
        category: "orm",
        invariants: [
            "All database access must go through SQLAlchemy models and sessions.",
            "Use Alembic for all schema migrations — do not modify the database manually.",
        ],
        allowed: ["alembic"],
        blocked: [],
    },
    {
        key: "pytest",
        label: "pytest",
        category: "testing",
        invariants: [
            "All tests must use pytest — do not use unittest directly.",
        ],
        allowed: ["pytest-cov", "pytest-asyncio", "pytest-mock"],
        blocked: [],
    },
    {
        key: "pydantic",
        label: "Pydantic",
        category: "validation",
        invariants: [
            "Use Pydantic models for data validation and serialization.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "celery",
        label: "Celery",
        category: "task-queue",
        invariants: [
            "Background tasks must use Celery — no threading or subprocess for async work.",
        ],
        allowed: ["redis"],
        blocked: [],
    },
    {
        key: "numpy",
        label: "NumPy",
        category: "data-science",
        invariants: [
            "Use NumPy vectorized operations — avoid Python loops for numerical computation.",
        ],
        allowed: ["scipy"],
        blocked: [],
    },
    {
        key: "pandas",
        label: "pandas",
        category: "data-science",
        invariants: [
            "Use pandas DataFrames for tabular data — avoid manual dict/list manipulation for data processing.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "tensorflow",
        label: "TensorFlow",
        category: "ml",
        invariants: [
            "Use tf.keras API for model building — do not use standalone Keras.",
        ],
        allowed: ["tensorboard"],
        blocked: [
            {
                name: "torch",
                reason: "Project uses TensorFlow. Do not mix ML frameworks.",
                alternatives: ["tensorflow", "tf.keras"],
            },
        ],
    },
    {
        key: "torch",
        label: "PyTorch",
        category: "ml",
        invariants: [
            "Use PyTorch's nn.Module for all model definitions.",
        ],
        allowed: ["torchvision", "torchaudio"],
        blocked: [
            {
                name: "tensorflow",
                reason: "Project uses PyTorch. Do not mix ML frameworks.",
                alternatives: ["torch"],
            },
        ],
    },
    {
        key: "streamlit",
        label: "Streamlit",
        category: "frontend",
        invariants: [
            "UI must be built with Streamlit components — do not add Flask or FastAPI for serving.",
        ],
        allowed: [],
        blocked: [],
    },
];

// ── Python Manifest Parser ────────────────────────────────────

function parsePythonDeps(
    pyprojectContent: string | null,
    requirementsContent: string | null
): { projectName: string; deps: Set<string> } {
    const deps = new Set<string>();
    let projectName = "my-project";

    if (pyprojectContent) {
        const lines = pyprojectContent.split("\n");
        let currentSection = "";
        let inDepsArray = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Track TOML section headers
            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].trim();
                inDepsArray = false;
                continue;
            }

            if (!trimmed || trimmed.startsWith("#")) continue;

            // Extract project name from [project] or [tool.poetry]
            if (currentSection === "project" || currentSection === "tool.poetry") {
                const nameMatch = trimmed.match(/^name\s*=\s*["']([^"']+)["']/);
                if (nameMatch) projectName = nameMatch[1];
            }

            // PEP 621: dependencies = [...] arrays
            if (
                currentSection === "project" ||
                currentSection.startsWith("project.optional-dependencies")
            ) {
                if (/^(?:dependencies|dev)\s*=\s*\[/.test(trimmed)) {
                    inDepsArray = true;
                }
                if (inDepsArray) {
                    const pkgMatches = trimmed.matchAll(
                        /["']([a-zA-Z][a-zA-Z0-9_.-]*)(?:\[.*?\])?\s*(?:[><=!~;][^"']*)?["']/g
                    );
                    for (const m of pkgMatches) {
                        deps.add(m[1].toLowerCase());
                    }
                    if (trimmed.includes("]")) {
                        inDepsArray = false;
                    }
                }
            }

            // Poetry: key = "version" under dependency sections
            if (
                /^tool\.poetry\.(dev-)?dependencies$/.test(currentSection) ||
                /^tool\.poetry\.group\.\w+\.dependencies$/.test(currentSection)
            ) {
                const depMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*=/);
                if (depMatch && depMatch[1] !== "python") {
                    deps.add(depMatch[1].toLowerCase());
                }
            }
        }
    }

    if (requirementsContent) {
        for (const line of requirementsContent.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
            const match = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_.-]*)/);
            if (match) {
                deps.add(match[1].toLowerCase());
            }
        }
    }

    return { projectName, deps };
}

// ══════════════════════════════════════════════════════════════
// DART / FLUTTER ECOSYSTEM
// ══════════════════════════════════════════════════════════════

const DART_SIGNATURES: EcosystemSignature[] = [
    {
        key: "flutter",
        label: "Flutter",
        category: "framework",
        invariants: [
            "Use Flutter's widget composition pattern — keep widgets small and focused.",
            "State management must use a single chosen solution project-wide.",
            "All assets must be declared in pubspec.yaml.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "flutter_bloc",
        label: "BLoC",
        category: "state",
        invariants: [
            "State management must use BLoC pattern — Cubits for simple state, Blocs for complex.",
            "Events and states must be immutable — use Equatable or Freezed.",
        ],
        allowed: ["equatable", "bloc"],
        blocked: [
            {
                name: "flutter_riverpod",
                reason: "Project uses BLoC. Do not mix state management solutions.",
                alternatives: ["flutter_bloc"],
            },
            {
                name: "get",
                reason: "Project uses BLoC. Do not mix state management solutions.",
                alternatives: ["flutter_bloc"],
            },
        ],
    },
    {
        key: "flutter_riverpod",
        label: "Riverpod",
        category: "state",
        invariants: [
            "State management must use Riverpod providers — use ConsumerWidget for reactive UI.",
            "Prefer NotifierProvider over StateProvider for complex state.",
        ],
        allowed: ["riverpod_annotation"],
        blocked: [
            {
                name: "flutter_bloc",
                reason: "Project uses Riverpod. Do not mix state management solutions.",
                alternatives: ["flutter_riverpod"],
            },
            {
                name: "get",
                reason: "Project uses Riverpod. Do not mix state management solutions.",
                alternatives: ["flutter_riverpod"],
            },
        ],
    },
    {
        key: "get",
        label: "GetX",
        category: "state",
        invariants: [
            "Use GetX for state, routing, and dependency injection consistently.",
        ],
        allowed: [],
        blocked: [
            {
                name: "flutter_bloc",
                reason: "Project uses GetX. Do not mix state management solutions.",
                alternatives: ["get"],
            },
            {
                name: "flutter_riverpod",
                reason: "Project uses GetX. Do not mix state management solutions.",
                alternatives: ["get"],
            },
        ],
    },
    {
        key: "provider",
        label: "Provider",
        category: "state",
        invariants: [
            "Use Provider for dependency injection and simple state management.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "dio",
        label: "Dio",
        category: "http",
        invariants: [
            "HTTP requests must use Dio — do not use the http package directly.",
        ],
        allowed: [],
        blocked: [
            {
                name: "http",
                reason: "Project uses Dio for HTTP requests.",
                alternatives: ["dio"],
            },
        ],
    },
    {
        key: "firebase_core",
        label: "Firebase",
        category: "backend-service",
        invariants: [
            "Firebase must be initialized before use — ensure Firebase.initializeApp() is called in main.",
        ],
        allowed: ["firebase_auth", "cloud_firestore", "firebase_storage"],
        blocked: [],
    },
    {
        key: "go_router",
        label: "GoRouter",
        category: "routing",
        invariants: [
            "Navigation must use go_router — do not use Navigator.push directly.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "freezed",
        label: "Freezed",
        category: "codegen",
        invariants: [
            "Data classes must use Freezed for immutable models with union types.",
        ],
        allowed: ["freezed_annotation", "json_serializable"],
        blocked: [],
    },
];

// ── Dart Manifest Parser (pubspec.yaml) ───────────────────────

function parsePubspecYaml(content: string): { projectName: string; deps: Set<string> } {
    const deps = new Set<string>();
    let projectName = "my-project";
    const lines = content.split("\n");
    let inDeps = false;
    let depsIndent = -1;

    for (const line of lines) {
        // Extract project name from root level
        const nameMatch = line.match(/^name:\s*(.+)/);
        if (nameMatch) {
            projectName = nameMatch[1].trim();
            continue;
        }

        // Check for deps section start
        if (/^(dependencies|dev_dependencies)\s*:/.test(line)) {
            inDeps = true;
            depsIndent = -1;
            continue;
        }

        // Check for section end (non-indented, non-blank, non-comment line)
        if (inDeps && /^\S/.test(line) && line.trim() !== "") {
            inDeps = false;
            depsIndent = -1;
            if (/^(dependencies|dev_dependencies)\s*:/.test(line)) {
                inDeps = true;
            }
            continue;
        }

        if (inDeps && line.trim() !== "" && !line.trim().startsWith("#")) {
            const indent = line.length - line.trimStart().length;
            if (depsIndent === -1) {
                depsIndent = indent;
            }
            if (indent === depsIndent) {
                const depMatch = line.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
                if (depMatch) {
                    deps.add(depMatch[1]);
                }
            }
        }
    }

    return { projectName, deps };
}

// ══════════════════════════════════════════════════════════════
// C# / .NET ECOSYSTEM
// ══════════════════════════════════════════════════════════════

const DOTNET_SIGNATURES: EcosystemSignature[] = [
    {
        key: "Microsoft.NET.Sdk.Web",
        label: "ASP.NET Core",
        category: "backend",
        invariants: [
            "Use ASP.NET Core middleware pipeline — register services in Program.cs.",
            "Use dependency injection via IServiceCollection — no manual instantiation.",
            "API controllers must use [ApiController] attribute with model validation.",
        ],
        allowed: ["Swashbuckle.AspNetCore", "Microsoft.AspNetCore.Authentication.JwtBearer"],
        blocked: [],
    },
    {
        key: "Microsoft.EntityFrameworkCore",
        label: "Entity Framework Core",
        category: "orm",
        invariants: [
            "All database access must go through Entity Framework Core — no raw ADO.NET.",
            "Use migrations for all schema changes — do not modify the database manually.",
        ],
        allowed: ["Microsoft.EntityFrameworkCore.Design"],
        blocked: [
            {
                name: "Dapper",
                reason: "Project uses Entity Framework Core. Do not add a second ORM.",
                alternatives: ["Microsoft.EntityFrameworkCore"],
            },
        ],
    },
    {
        key: "Microsoft.AspNetCore.Components",
        label: "Blazor",
        category: "frontend",
        invariants: [
            "UI must use Blazor components — do not mix with JavaScript frameworks.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "Microsoft.Maui",
        label: ".NET MAUI",
        category: "mobile",
        invariants: [
            "Use MAUI's MVVM pattern with data binding for all UI logic.",
            "Platform-specific code must use conditional compilation or platform services.",
        ],
        allowed: ["CommunityToolkit.Maui", "CommunityToolkit.Mvvm"],
        blocked: [],
    },
    {
        key: "xunit",
        label: "xUnit",
        category: "testing",
        invariants: [
            "All tests must use xUnit — do not add NUnit or MSTest.",
        ],
        allowed: ["Moq", "FluentAssertions"],
        blocked: [
            {
                name: "NUnit",
                reason: "Project uses xUnit for testing.",
                alternatives: ["xunit"],
            },
        ],
    },
    {
        key: "NUnit",
        label: "NUnit",
        category: "testing",
        invariants: [
            "All tests must use NUnit — do not add xUnit or MSTest.",
        ],
        allowed: ["Moq", "FluentAssertions"],
        blocked: [
            {
                name: "xunit",
                reason: "Project uses NUnit for testing.",
                alternatives: ["NUnit"],
            },
        ],
    },
    {
        key: "MediatR",
        label: "MediatR",
        category: "architecture",
        invariants: [
            "Use MediatR for CQRS — commands and queries must go through the mediator pipeline.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "Dapper",
        label: "Dapper",
        category: "orm",
        invariants: [
            "Database access must use Dapper — keep SQL queries in repository classes.",
        ],
        allowed: [],
        blocked: [
            {
                name: "Microsoft.EntityFrameworkCore",
                reason: "Project uses Dapper. Do not add Entity Framework Core.",
                alternatives: ["Dapper"],
            },
        ],
    },
    {
        key: "Serilog",
        label: "Serilog",
        category: "logging",
        invariants: [
            "Logging must use Serilog — do not use Console.WriteLine for application logging.",
        ],
        allowed: ["Serilog.Sinks.Console", "Serilog.Sinks.File"],
        blocked: [
            {
                name: "NLog",
                reason: "Project uses Serilog for logging.",
                alternatives: ["Serilog"],
            },
        ],
    },
    {
        key: "FluentValidation",
        label: "FluentValidation",
        category: "validation",
        invariants: [
            "Input validation must use FluentValidation — do not use DataAnnotations for complex rules.",
        ],
        allowed: [],
        blocked: [],
    },
];

// ── .NET Manifest Parser (.csproj) ────────────────────────────

function parseCsprojDeps(content: string): Set<string> {
    const deps = new Set<string>();

    // Check SDK for ASP.NET Core
    const sdkMatch = content.match(/<Project\s+Sdk="([^"]+)"/i);
    if (sdkMatch) {
        deps.add(sdkMatch[1]);
    }

    // Extract PackageReference includes
    const regex = /<PackageReference\s+Include="([^"]+)"/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
        deps.add(match[1]);
    }

    return deps;
}

// ══════════════════════════════════════════════════════════════
// GO ECOSYSTEM
// ══════════════════════════════════════════════════════════════

const GO_SIGNATURES: EcosystemSignature[] = [
    {
        key: "github.com/gin-gonic/gin",
        label: "Gin",
        category: "backend",
        invariants: [
            "Use Gin's middleware pattern for cross-cutting concerns.",
            "Route handlers must validate input using binding tags or custom validators.",
            "Group related routes using Gin's RouterGroup.",
        ],
        allowed: [],
        blocked: [
            {
                name: "github.com/labstack/echo",
                reason: "Project uses Gin. Do not mix Go HTTP frameworks.",
                alternatives: ["github.com/gin-gonic/gin"],
            },
            {
                name: "github.com/gofiber/fiber",
                reason: "Project uses Gin. Do not mix Go HTTP frameworks.",
                alternatives: ["github.com/gin-gonic/gin"],
            },
        ],
    },
    {
        key: "github.com/labstack/echo",
        label: "Echo",
        category: "backend",
        invariants: [
            "Use Echo's middleware and context pattern for request handling.",
        ],
        allowed: [],
        blocked: [
            {
                name: "github.com/gin-gonic/gin",
                reason: "Project uses Echo. Do not mix Go HTTP frameworks.",
                alternatives: ["github.com/labstack/echo"],
            },
        ],
    },
    {
        key: "github.com/gofiber/fiber",
        label: "Fiber",
        category: "backend",
        invariants: [
            "Use Fiber's Express-like middleware pattern for all routes.",
        ],
        allowed: [],
        blocked: [
            {
                name: "github.com/gin-gonic/gin",
                reason: "Project uses Fiber. Do not mix Go HTTP frameworks.",
                alternatives: ["github.com/gofiber/fiber"],
            },
        ],
    },
    {
        key: "github.com/go-chi/chi",
        label: "Chi",
        category: "backend",
        invariants: [
            "Use Chi's middleware chain for route handling — compose middleware explicitly.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "gorm.io/gorm",
        label: "GORM",
        category: "orm",
        invariants: [
            "All database access must go through GORM models — no raw database/sql queries.",
            "Use GORM's AutoMigrate for schema management in development.",
        ],
        allowed: ["gorm.io/driver/postgres", "gorm.io/driver/mysql", "gorm.io/driver/sqlite"],
        blocked: [],
    },
    {
        key: "github.com/stretchr/testify",
        label: "Testify",
        category: "testing",
        invariants: [
            "Use testify assertions and suites for clearer test output.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "github.com/gorilla/mux",
        label: "Gorilla Mux",
        category: "routing",
        invariants: [
            "Use Gorilla Mux for routing — register all routes in a central router.",
        ],
        allowed: [],
        blocked: [],
    },
];

// ── Go Manifest Parser (go.mod) ──────────────────────────────

function parseGoModDeps(content: string): { projectName: string; deps: Set<string> } {
    const deps = new Set<string>();
    let projectName = "my-project";

    const lines = content.split("\n");
    let inRequire = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Extract module name
        const moduleMatch = trimmed.match(/^module\s+(.+)/);
        if (moduleMatch) {
            const modulePath = moduleMatch[1].trim();
            const parts = modulePath.split("/");
            projectName = parts[parts.length - 1];
        }

        // Track require blocks
        if (trimmed.startsWith("require") && trimmed.includes("(")) {
            inRequire = true;
            continue;
        }
        if (inRequire && trimmed === ")") {
            inRequire = false;
            continue;
        }

        if (inRequire && trimmed && !trimmed.startsWith("//")) {
            const depMatch = trimmed.match(/^(\S+)\s+v/);
            if (depMatch) {
                deps.add(depMatch[1]);
            }
        }

        // Single-line require
        if (/^require\s+\S+\s+v/.test(trimmed)) {
            const depMatch = trimmed.match(/^require\s+(\S+)\s+v/);
            if (depMatch) {
                deps.add(depMatch[1]);
            }
        }
    }

    return { projectName, deps };
}

// ══════════════════════════════════════════════════════════════
// RUST ECOSYSTEM
// ══════════════════════════════════════════════════════════════

const RUST_SIGNATURES: EcosystemSignature[] = [
    {
        key: "actix-web",
        label: "Actix Web",
        category: "backend",
        invariants: [
            "Use Actix Web's extractor pattern for request handling.",
            "Application state must be shared via web::Data — no global mutable state.",
        ],
        allowed: ["actix-rt", "actix-cors"],
        blocked: [
            {
                name: "axum",
                reason: "Project uses Actix Web. Do not mix Rust HTTP frameworks.",
                alternatives: ["actix-web"],
            },
            {
                name: "rocket",
                reason: "Project uses Actix Web. Do not mix Rust HTTP frameworks.",
                alternatives: ["actix-web"],
            },
        ],
    },
    {
        key: "axum",
        label: "Axum",
        category: "backend",
        invariants: [
            "Use Axum's extractor pattern for request data.",
            "Shared state must be passed via State extractor — no global singletons.",
        ],
        allowed: ["axum-extra", "tower", "tower-http"],
        blocked: [
            {
                name: "actix-web",
                reason: "Project uses Axum. Do not mix Rust HTTP frameworks.",
                alternatives: ["axum"],
            },
            {
                name: "rocket",
                reason: "Project uses Axum. Do not mix Rust HTTP frameworks.",
                alternatives: ["axum"],
            },
        ],
    },
    {
        key: "rocket",
        label: "Rocket",
        category: "backend",
        invariants: [
            "Use Rocket's request guards for authentication and validation.",
        ],
        allowed: [],
        blocked: [
            {
                name: "actix-web",
                reason: "Project uses Rocket. Do not mix Rust HTTP frameworks.",
                alternatives: ["rocket"],
            },
            {
                name: "axum",
                reason: "Project uses Rocket. Do not mix Rust HTTP frameworks.",
                alternatives: ["rocket"],
            },
        ],
    },
    {
        key: "tokio",
        label: "Tokio",
        category: "async-runtime",
        invariants: [
            "Use Tokio as the async runtime — do not mix with async-std.",
        ],
        allowed: [],
        blocked: [
            {
                name: "async-std",
                reason: "Project uses Tokio. Do not mix async runtimes.",
                alternatives: ["tokio"],
            },
        ],
    },
    {
        key: "diesel",
        label: "Diesel",
        category: "orm",
        invariants: [
            "All database access must go through Diesel — no raw SQL.",
            "Use Diesel's migration system for schema changes.",
        ],
        allowed: [],
        blocked: [
            {
                name: "sea-orm",
                reason: "Project uses Diesel. Do not add a second ORM.",
                alternatives: ["diesel"],
            },
        ],
    },
    {
        key: "sea-orm",
        label: "SeaORM",
        category: "orm",
        invariants: [
            "All database access must go through SeaORM entities and queries.",
        ],
        allowed: ["sea-orm-migration"],
        blocked: [
            {
                name: "diesel",
                reason: "Project uses SeaORM. Do not add a second ORM.",
                alternatives: ["sea-orm"],
            },
        ],
    },
    {
        key: "serde",
        label: "Serde",
        category: "serialization",
        invariants: [
            "Use Serde derive macros for all serialization — no manual implementations.",
        ],
        allowed: ["serde_json", "serde_yaml"],
        blocked: [],
    },
    {
        key: "sqlx",
        label: "SQLx",
        category: "database",
        invariants: [
            "Use SQLx's compile-time checked queries where possible.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "clap",
        label: "Clap",
        category: "cli",
        invariants: [
            "CLI argument parsing must use Clap's derive macros.",
        ],
        allowed: [],
        blocked: [],
    },
];

// ── Rust Manifest Parser (Cargo.toml) ─────────────────────────

function parseCargoTomlDeps(content: string): { projectName: string; deps: Set<string> } {
    const deps = new Set<string>();
    let projectName = "my-project";

    const lines = content.split("\n");
    let currentSection = "";

    for (const line of lines) {
        const trimmed = line.trim();

        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();

            // Handle [dependencies.crate-name] style
            const depsSub = currentSection.match(
                /^(?:dev-|build-)?dependencies\.([a-zA-Z][a-zA-Z0-9_-]*)$/
            );
            if (depsSub) {
                deps.add(depsSub[1]);
            }
            continue;
        }

        if (!trimmed || trimmed.startsWith("#")) continue;

        // Extract package name
        if (currentSection === "package") {
            const nameMatch = trimmed.match(/^name\s*=\s*"([^"]+)"/);
            if (nameMatch) projectName = nameMatch[1];
        }

        // Extract dependencies
        if (
            currentSection === "dependencies" ||
            currentSection === "dev-dependencies" ||
            currentSection === "build-dependencies"
        ) {
            const depMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*=/);
            if (depMatch) {
                deps.add(depMatch[1]);
            }
        }
    }

    return { projectName, deps };
}

// ══════════════════════════════════════════════════════════════
// JVM (JAVA / KOTLIN) ECOSYSTEM
// ══════════════════════════════════════════════════════════════

const JVM_SIGNATURES: EcosystemSignature[] = [
    {
        key: "org.springframework.boot",
        label: "Spring Boot",
        category: "backend",
        invariants: [
            "Follow Spring Boot's layered architecture — controllers, services, repositories.",
            "Use constructor injection via @Autowired — no field injection.",
            "Configuration must use application.properties or application.yml — no hardcoded values.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "org.hibernate",
        label: "Hibernate",
        category: "orm",
        invariants: [
            "All database access must go through Hibernate/JPA entities and repositories.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "io.ktor",
        label: "Ktor",
        category: "backend",
        invariants: [
            "Use Ktor's plugin system for features — install plugins in Application module.",
            "Route definitions must be organized in separate routing modules.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "org.junit.jupiter",
        label: "JUnit 5",
        category: "testing",
        invariants: [
            "All tests must use JUnit 5 — do not add TestNG.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "androidx.compose",
        label: "Jetpack Compose",
        category: "frontend",
        invariants: [
            "UI must use Jetpack Compose — do not use XML layouts.",
        ],
        allowed: [],
        blocked: [],
    },
];

// ── JVM Manifest Parsers ──────────────────────────────────────

function parseGradleDeps(content: string): Set<string> {
    const deps = new Set<string>();

    // Match dependency declarations (Groovy and Kotlin DSL)
    // Groovy: implementation 'group:artifact:version'
    // Kotlin: implementation("group:artifact:version")
    const depRegex =
        /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|kapt|annotationProcessor)\s*(?:\(?\s*["'])([^"':]+):([^"':]+)/g;
    let match;
    while ((match = depRegex.exec(content)) !== null) {
        deps.add(`${match[1]}:${match[2]}`);
    }

    // Match plugin IDs
    const pluginRegex = /id\s*(?:\(?\s*["'])([^"']+)["']\)?/g;
    while ((match = pluginRegex.exec(content)) !== null) {
        deps.add(`plugin:${match[1]}`);
    }

    return deps;
}

function parseMavenDeps(content: string): { projectName: string; deps: Set<string> } {
    const deps = new Set<string>();
    let projectName = "my-project";

    // Extract project artifactId (before first <dependencies> block)
    const beforeDeps = content.split("<dependencies>")[0] || content;
    const nameMatch = beforeDeps.match(/<artifactId>\s*([^<]+?)\s*<\/artifactId>/);
    if (nameMatch) projectName = nameMatch[1];

    // Extract dependency groupId:artifactId pairs
    const depRegex =
        /<dependency>\s*<groupId>\s*([^<]+?)\s*<\/groupId>\s*<artifactId>\s*([^<]+?)\s*<\/artifactId>/gs;
    let match;
    while ((match = depRegex.exec(content)) !== null) {
        deps.add(`${match[1]}:${match[2]}`);
    }

    return { projectName, deps };
}

// ══════════════════════════════════════════════════════════════
// SWIFT ECOSYSTEM
// ══════════════════════════════════════════════════════════════

const SWIFT_SIGNATURES: EcosystemSignature[] = [
    {
        key: "vapor",
        label: "Vapor",
        category: "backend",
        invariants: [
            "Use Vapor's route grouping for organized endpoints.",
            "Database access must use Fluent ORM — no raw SQL.",
        ],
        allowed: ["fluent", "leaf"],
        blocked: [],
    },
    {
        key: "alamofire",
        label: "Alamofire",
        category: "http",
        invariants: [
            "HTTP networking must use Alamofire — do not use URLSession directly for API calls.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "swift-argument-parser",
        label: "Swift Argument Parser",
        category: "cli",
        invariants: [
            "CLI argument parsing must use ArgumentParser — no manual CommandLine parsing.",
        ],
        allowed: [],
        blocked: [],
    },
    {
        key: "grdb",
        label: "GRDB",
        category: "database",
        invariants: [
            "Local database access must use GRDB — no raw SQLite calls.",
        ],
        allowed: [],
        blocked: [],
    },
];

// ── Swift Manifest Parser (Package.swift) ─────────────────────

function parsePackageSwiftDeps(content: string): { projectName: string; deps: Set<string> } {
    const deps = new Set<string>();
    let projectName = "my-project";

    // Extract package name
    const nameMatch = content.match(/name:\s*"([^"]+)"/);
    if (nameMatch) projectName = nameMatch[1];

    // Extract dependencies from .package(url: "...", ...)
    const pkgRegex = /\.package\s*\(\s*url:\s*"([^"]+)"/g;
    let match;
    while ((match = pkgRegex.exec(content)) !== null) {
        const url = match[1];
        // Extract package name: last path segment before .git
        const segments = url.replace(/\.git$/, "").split("/");
        const name = segments[segments.length - 1];
        if (name) deps.add(name.toLowerCase());
    }

    return { projectName, deps };
}

// ══════════════════════════════════════════════════════════════
// MASTER DETECTION — scans project directory for all ecosystems
// ══════════════════════════════════════════════════════════════

async function safeRead(filePath: string): Promise<string | null> {
    try {
        return await readFile(filePath, "utf-8");
    } catch {
        return null;
    }
}

export async function detectProjectStack(projectDir: string): Promise<DetectedStack> {
    const stacks: DetectedStack[] = [];
    const fallbackName = basename(projectDir);

    // ── JS/TS: package.json ──
    const pkgContent = await safeRead(resolve(projectDir, "package.json"));
    if (pkgContent) {
        try {
            const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
            stacks.push(detectStack(pkg));
        } catch {
            /* invalid JSON, skip */
        }
    }

    // ── Python: pyproject.toml / requirements.txt ──
    const pyprojectContent = await safeRead(resolve(projectDir, "pyproject.toml"));
    const requirementsContent = await safeRead(resolve(projectDir, "requirements.txt"));
    if (pyprojectContent || requirementsContent) {
        const { projectName, deps } = parsePythonDeps(pyprojectContent, requirementsContent);
        if (deps.size > 0) {
            stacks.push(
                detectFromSignatures(projectName, deps, PYTHON_SIGNATURES, (dep, key) => dep === key)
            );
        }
    }

    // ── Dart/Flutter: pubspec.yaml ──
    const pubspecContent = await safeRead(resolve(projectDir, "pubspec.yaml"));
    if (pubspecContent) {
        const { projectName, deps } = parsePubspecYaml(pubspecContent);
        if (deps.size > 0) {
            stacks.push(
                detectFromSignatures(projectName, deps, DART_SIGNATURES, (dep, key) => dep === key)
            );
        }
    }

    // ── C#/.NET: *.csproj ──
    try {
        const files = await readdir(projectDir);
        const csprojFile = files.find((f) => f.endsWith(".csproj"));
        if (csprojFile) {
            const content = await readFile(resolve(projectDir, csprojFile), "utf-8");
            const deps = parseCsprojDeps(content);
            const name = csprojFile.replace(".csproj", "");
            stacks.push(
                detectFromSignatures(
                    name,
                    deps,
                    DOTNET_SIGNATURES,
                    (dep, key) => dep === key || dep.startsWith(key + ".")
                )
            );
        }
    } catch {
        /* readdir failed, skip */
    }

    // ── Go: go.mod ──
    const goModContent = await safeRead(resolve(projectDir, "go.mod"));
    if (goModContent) {
        const { projectName, deps } = parseGoModDeps(goModContent);
        if (deps.size > 0) {
            stacks.push(
                detectFromSignatures(
                    projectName,
                    deps,
                    GO_SIGNATURES,
                    (dep, key) => dep === key || dep.startsWith(key + "/")
                )
            );
        }
    }

    // ── Rust: Cargo.toml ──
    const cargoContent = await safeRead(resolve(projectDir, "Cargo.toml"));
    if (cargoContent) {
        const { projectName, deps } = parseCargoTomlDeps(cargoContent);
        if (deps.size > 0) {
            stacks.push(
                detectFromSignatures(projectName, deps, RUST_SIGNATURES, (dep, key) => dep === key)
            );
        }
    }

    // ── JVM: build.gradle(.kts) or pom.xml ──
    const gradleContent =
        (await safeRead(resolve(projectDir, "build.gradle"))) ||
        (await safeRead(resolve(projectDir, "build.gradle.kts")));
    if (gradleContent) {
        const deps = parseGradleDeps(gradleContent);
        if (deps.size > 0) {
            stacks.push(
                detectFromSignatures(
                    fallbackName,
                    deps,
                    JVM_SIGNATURES,
                    (dep, key) => dep.startsWith(key) || dep.startsWith(`plugin:${key}`)
                )
            );
        }
    } else {
        const pomContent = await safeRead(resolve(projectDir, "pom.xml"));
        if (pomContent) {
            const { projectName, deps } = parseMavenDeps(pomContent);
            if (deps.size > 0) {
                stacks.push(
                    detectFromSignatures(
                        projectName,
                        deps,
                        JVM_SIGNATURES,
                        (dep, key) => dep.startsWith(key) || dep.startsWith(`plugin:${key}`)
                    )
                );
            }
        }
    }

    // ── Swift: Package.swift ──
    const swiftContent = await safeRead(resolve(projectDir, "Package.swift"));
    if (swiftContent) {
        const { projectName, deps } = parsePackageSwiftDeps(swiftContent);
        if (deps.size > 0) {
            stacks.push(
                detectFromSignatures(projectName, deps, SWIFT_SIGNATURES, (dep, key) => dep === key)
            );
        }
    }

    // ── No manifests found ──
    if (stacks.length === 0) {
        return {
            projectName: fallbackName,
            frameworks: [],
            techStack: {},
            suggestedInvariants: [],
            suggestedBlocked: [...UNIVERSAL_BLOCKED],
            suggestedAllowed: [],
            suggestedReviewRequired: [],
        };
    }

    // Merge all detected stacks
    let result = stacks[0];
    for (let i = 1; i < stacks.length; i++) {
        result = mergeStacks(result, stacks[i]);
    }

    return result;
}
