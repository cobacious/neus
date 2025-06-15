# `@neus/db`

This package holds the Prisma schema and database utilities for Neus.

## Running migrations

Run Prisma migrations from this directory with:

```bash
pnpm prisma migrate dev
```

This command creates and updates the SQLite database stored at
`packages/db/prisma/dev.db` by default.

## Generating the client

After changing `schema.prisma`, regenerate the Prisma client with:

```bash
pnpm prisma generate
```

The generated client is output to `node_modules/@prisma/client` and can be
imported throughout the monorepo.
