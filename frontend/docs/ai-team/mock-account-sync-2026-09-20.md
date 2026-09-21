# Development Mock Account Synchronization

- **Status:** Done
- **Project boundary:** `frontend/` Mock authentication, login presentation, tests, and frontend documentation only.
- **Mode / profile / risk / depth:** team build / web + docs / high / deep.
- **Non-goals:** No production credentials, backend configuration, database records, migrations, API contracts, or deployment changes.

## Canonical development-only accounts

| Surface | Account | Password | Intended use |
| --- | --- | --- | --- |
| Front office | `admin@example.com` | `Test1234` | Front-office administrator Demo account |
| Front office | `user@example` | `user123` | Front-office `FINANCE` Demo account |
| Back office | `admin` | `admin` | Shared back-office Demo account; then verify a front-office operator |

## Traceability

| Acceptance criterion | Implementation / documentation | Validation |
| --- | --- | --- |
| The two front-office credentials authenticate in development Mock mode. | `mock-users.ts`, `auth.service.ts`, login tests | Source search and Angular build |
| The back-office credential is distinct from front-office users. | `mock-authentication.provider.ts`, login display, test helper | Source search and Angular build |
| All frontend documentation lists the same three accounts. | `frontend/README.md`, existing team records, this file | Repository search for superseded credentials |
| Production does not expose these credentials. | `mock-authentication.provider.production.ts` remains disabled | Production Angular build |

## Validation record

| Check | Status | Evidence |
| --- | --- | --- |
| Superseded frontend Mock credentials removed | PASS | A repository scan found no prior front-office account or password variants in tracked frontend documentation/source |
| Angular production build | PASS | `npm run build` completed successfully; only existing bundle/style budget warnings remain |
| Focused Karma tests | BLOCKED | The local runner cannot resolve its existing `webpack` dependency; no packages were installed or changed |
