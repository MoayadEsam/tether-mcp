/**
 * Tether MCP — Framework Detector
 *
 * Scans a project's package.json to detect the framework, runtime,
 * and stack in use. Returns a structured profile used to generate
 * a smart tether.config.json.
 */

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
