## Build Commands

```bash
# Install dependencies
pnpm install

# Start development server (website + API)
pnpm run dev --workspace=website

# Start SPA dev servers (separate terminals)
pnpm run dev --workspace=dashboard    # Dashboard SPA on port 3002
pnpm run dev --workspace=admin        # Admin SPA on port 3003

# Run all tests
pnpm test

# Run a single test file
npx vitest run path/to/file.test.ts --config .config/vitest.config.mts

# Lint and format
pnpm run format        # Oxfmt format with .config/oxfmt.config.ts
pnpm run lint          # Oxlint check with auto-fix

# Database
docker-compose up -d                              # Start PostgreSQL
pnpm run migrate:latest --workspace=dbmigrator     # Run migrations
pnpm run db-codegen --workspace=@queryme/db        # Generate Kysely types

# Create new migration
cd apps/dbmigrator/src && npx kysely migrate:make <name>

# Generate OpenAPI client (requires dev server running)
pnpm run openapi --workspace=website
```

## Architecture

This is a TypeScript monorepo with npm workspaces:

**Apps:**

- `apps/website` - Next.js frontend with Tailwind/ShadCN UI. API routes are proxied through `/api`. Proxy (middleware) handles auth + rewrites for SPA routes
- `apps/internal-api` - Hono API with TypeBox schemas and OpenAPI generation. Mounted at `/api` via Next.js
- `apps/frontends/dashboard` - React SPA (Vite + TanStack Router) served at `/dashboard`. Requires authentication
- `apps/frontends/admin` - React SPA (Vite + TanStack Router) served at `/admin`. Requires authentication + is_admin
- `apps/dbmigrator` - Kysely database migrations

**Packages:**

- `packages/db` - Kysely database client and generated types (`@queryme/db`)
- `lib/typescript/dao` - Data access objects shared between API and website (`@lib/dao`)
- `lib/typescript/api-client` - Hey-API generated client code shared between website and SPAs (`@lib/api-client`)
- `lib/typescript/ui/components` - Shared ShadCN UI components and theme (`@ui/components`)
- `lib/typescript/utils/*` - Utility libraries (e.g., `@utils/numbers`)
