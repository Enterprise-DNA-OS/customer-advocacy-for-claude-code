# CLI reference

Use node scripts/advocacy.mjs followed by the command. Every command accepts --json. Flags accept either --name=value or --name value. Unknown flags fail. Mutations require a named --actor; this is a record label, not authentication. Dates use YYYY-MM-DD. Run npm run migrate first. All read commands operate on stored records; none fetches customer data from a network.

## Choose a database

By default data stays under .data/db. Set DATA_DIR to another folder or DATABASE_URL for a controlled PostgreSQL connection. Never seed an operational database. npm run demo always uses .data/demo and .data/demo-output even if DATABASE_URL is set.

For demo queries in Bash:

```bash
DATA_DIR=.data/demo node scripts/advocacy.mjs reference-desk
```

In PowerShell:

```powershell
$env:DATA_DIR='.data/demo'
node scripts/advocacy.mjs reference-desk
```

## Reads

advocates, reference-desk, advocate-load, permission-review, story-library, attention, compliance, dashboard, insights and activity take no arguments. advocate <name-or-id> returns the full profile history. request <code-or-id> returns the full request and assignments. match-reference <request> gives each candidate's result and blocking reasons. Names are case-insensitive and partial identifiers work. Ambiguous matches list candidates and exit 1.

## Profile and permission

```bash
node scripts/advocacy.mjs add --name="Alex Morgan" --email=alex@example.test --company="Example Systems" --industry=Manufacturing --product=Planning --region=NZ --owner=Maya --capacity=2 --cooldown=14 --actor="Coordinator"
node scripts/advocacy.mjs review-advocate --advocate="Alex Morgan" --status=active --retention=2027-06-01 --evidence="Profile and recent commitments reviewed on the recorded call" --actor="Coordinator"
node scripts/advocacy.mjs permission --advocate="Alex Morgan" --kind=reference --decision=granted --until=2027-05-01 --evidence="Recorded permission reference" --restrictions="Named prospects only; no recording" --actor="Coordinator"
```

New profiles start paused. review-advocate accepts optional --industry, --product, --region, --owner, --capacity and --cooldown updates. Status is active, paused or archived. Capacity is 1..100, cooldown is 0..365 days. Review evidence must reflect actual verification and history review. Set future dates appropriate to the agreement rather than copying this example.

Permission kinds are reference, story and speaker. Grant requires --until and --evidence. Revoke uses --decision=revoked and --evidence, no --until. Decisions append to history and the latest governs use. No consent is inferred from activity or points. Restrictions must be read by a human.

## Requests and responses

```bash
node scripts/advocacy.mjs add-request --code=REF-200 --prospect="Example prospect" --industry=Manufacturing --product=Planning --region=NZ --kind=reference --due=2027-04-01 --owner=Maya --brief="Discuss implementation with the named buyer" --actor="Coordinator"
node scripts/advocacy.mjs match-reference REF-200
node scripts/advocacy.mjs propose --request=REF-200 --advocate="Alex Morgan" --evidence="Coordinator checked audience and restrictions" --actor="Coordinator"
node scripts/advocacy.mjs record-response --assignment="<returned id>" --status=accepted --evidence="Advocate accepted the specific request" --actor="Coordinator"
node scripts/advocacy.mjs record-response --assignment="<returned id>" --status=completed --evidence="Actual call record" --outcome="Implementation questions answered" --actor="Coordinator"
```

Proposed assignments can become accepted, declined or cancelled. Accepted assignments can become completed or cancelled. Completed is terminal and requires --outcome. Acceptance and completion recheck permission and profile rules. Completion records today in UTC and fulfils the request. close-request --request=<code> --evidence=<reason> --actor=<operator> cancels an open request and its outstanding assignments. Nothing sends an invitation or a cancellation message.

Industry and product must match exactly, ignoring case. A nonempty region on the request must also match. Profile verification must be within ninety days; retention review and purpose permission must cover the later of today or the request date. Proposed and accepted work reserves capacity immediately. Recent completions count for thirty days; cooldown blocks a new assignment. Capacity is across all three purposes. These are editable policies, not legal periods.

## Stories and activity

add-story requires --advocate, --title, --body, --evidence and --actor. It stores draft wording. story-decision requires --story, --action=approve|withdraw, --evidence and --actor. Approval requires current story permission and a reviewed active profile. Approval is local wording evidence, never publication.

log requires --advocate, --type, --notes and --actor; optional --on is a past or current date. A log entry never changes permission, workload or a request's status.

## Files

import influitive --file=<CSV> --dry-run --actor=<operator> previews a transactional import. Read replace-influitive.md before running without --dry-run. Mapping and date-format flags are explained there.

export --out=<new private directory> writes all eight record types in one JSON snapshot, including original imports and audit history. Existing directories are refused. There is no automatic restore or delete command.

weekly-review writes a draft from dashboard, attention and compliance. draft-reference <request> writes an internal brief. draft-story <story> writes approved wording only when current checks pass. Each accepts --out=<new file>; default is a unique file in drafts/. Existing files are refused. OUTPUT_DIR changes the default output root.

npm run view renders three read-only dashboards; npm run docs renders internal briefs, permission review sheets and currently usable story packs. Configuration is in views.json, documents.json and brand.json. Rerender before sharing because static output does not update after a permission withdrawal. Keep output private and dispose of old copies through the organisation's retention procedure.
