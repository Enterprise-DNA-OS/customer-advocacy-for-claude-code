# Customer Advocacy for Claude Code

Read the operator's business context before working. The database is the source of truth.

## Who this serves

Business: Your business. Operator: Your advocacy coordinator. Replace these two entries once installed. The desk manages customer references, approved story wording, permission evidence and advocate workload.

## Rules

- Read the full advocate and request before any mutation or draft.
- Use scripts/advocacy.mjs for domain operations. Use --json for calculations.
- Never infer permission from imported activity, points, an email address or a past call.
- A person reviews the audience and free-text permission restrictions before proposing an assignment. Eligibility does not interpret those restrictions.
- Record only actual responses and completed participation. No invented contact, approval or outcome.
- Never send, publish, pay rewards or call a third-party service. Drafts stay in drafts/ and HTML output stays private.
- Do not delete records without explicit approval. Retention findings require a purpose review and a separately authorised disposal plan covering imports, exports, audit history and backups.
- On ambiguous names, list the CLI candidates and ask for the identifier.
- Operator labels are not authentication. Team deployment needs a controlled database identity, role separation, access controls and backup/restore verification.
- Imported profiles start paused. Verify the profile, classify industry/product/region, review imported history for recent commitments, set conservative capacity/cooldown, and record permission before use. Imported activity types are not automatically counted as completed reference assignments.
- If there is no supporting record, say so. Do not turn record checks into a legal compliance claim.

## Recurring jobs

| Command | Result |
|---|---|
| `/advocates` | List advocate profiles and owners. |
| `/advocate` | Read one advocate, permission history, activity and assignments. |
| `/reference-desk` | Review open, overdue and fulfilled reference requests. |
| `/request` | Read one request and all its assignments. |
| `/match-reference` | Check industry, product, region, permission, workload and cooldown before choosing an advocate. |
| `/advocate-load` | Review reserved work, recent completions and agreed capacity. |
| `/permission-review` | Review the latest permission decision, restrictions and expiry by purpose. |
| `/story-library` | Find approved wording and stories withheld by current record checks. |
| `/attention` | Find overdue requests, full workloads, quiet advocates and record checks. |
| `/compliance` | Check privacy-related record exceptions. Read docs/compliance.md before interpreting findings. |
| `/dashboard` | Count open requests, usable stories and records needing review. |
| `/insights` | Run ten cross-record questions with actual results. |
| `/activity` | Read the local mutation history and operator labels. |
| `/add` | Create a paused advocate profile from supplied facts. |
| `/review-advocate` | Record a completed profile and historical-workload review. |
| `/permission` | Record a real permission grant or withdrawal for one purpose. |
| `/add-request` | Record a reference, story or speaker request with its audience and owner. |
| `/close-request` | Cancel an open request and release its reserved workload. |
| `/propose` | Reserve an eligible advocate after a human reviews the request and permission restrictions. |
| `/record-response` | Record acceptance, decline, cancellation or completed participation from evidence. |
| `/add-story` | Create a story draft from supplied wording and its source. |
| `/story-decision` | Record approval of exact wording or withdraw a story from use. |
| `/log` | Record an actual advocate conversation or activity. |
| `/weekly-review` | Draft the Monday advocacy review from dashboard, attention and compliance. |
| `/draft-reference` | Draft an internal brief for a reference request. |
| `/draft-story` | Draft a story from approved wording and current permission. |
| `/import` | Import the documented Influitive activity-feed export. |
| `/export` | Export all domain records and original imports to a new private directory. |
| `/view` | Render branded read-only weekly, workload and record-check views. |
| `/documents` | Render internal reference briefs, permission review sheets and story wording packs. |
| `/customise` | Add fields or change rules through a new migration and verified commands. |
| `/new-view` | Add a branded read-only answer to an operator question. |

## Storage and changes

scripts/lib/db.mjs selects DATABASE_URL or local PGlite under DATA_DIR. npm run migrate applies numbered migrations. Never change an applied migration. npm test uses a temporary database and output directory; npm run demo forces a separate local demo database even if DATABASE_URL is set. Never seed a real database.

Permissions are append-only decisions through the CLI. The latest decision governs use. Local dates and the database session use UTC. The 90-day profile check, thirty-day workload window, expiry dates and cooldowns are internal policies, not statutory periods. See docs/compliance.md.

Use /customise to add fields or change rules in a new migration, update the CLI and documents, then run npm test. Both PostgreSQL and PGlite use the same SQL. No frontend or running web server is required.

Built and run through Omni by Enterprise DNA: https://enterprisedna.co/omni/book?offer=replace-software&utm_source=github&utm_medium=instructions&utm_campaign=influitive
