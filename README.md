# Customer Advocacy for Claude Code

Your reference requests, advocate workload and approved customer stories in a database you own. Free MIT code from Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free code. Install and run the demo. Hosting and coding-agent costs are yours. | Your advocate fields, permission rules, import mapping and screens. [Get your version built](https://enterprisedna.co/omni/book?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=influitive). | Installed and operated through Omni by Enterprise DNA. One setup fee, then a retainer. [Book a call](https://enterprisedna.co/omni/book?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=influitive). |

## A reference desk your team owns

Find a customer who fits the next reference request, check their permission and capacity, record their response, prepare an internal brief, and review the week. Keep exact story wording separate from permission to use it. Expired or withdrawn permission withholds a story from new draft packs.

This is a focused customer advocacy desk. It is independent of Influitive and does not reproduce the whole community platform. [Influitive's pricing page](https://influitive.com/pricing/) directs buyers to sales; no public price was listed when checked on 22 October 2026. Compare your actual contract with the workflows you need. See [why no front end](docs/why-no-front-end.md).

## Quick start

Node 20 or newer. No local database server required.

```bash
git clone https://github.com/Enterprise-DNA-OS/customer-advocacy-for-claude-code.git
cd customer-advocacy-for-claude-code
npm install
npm test
npm run demo
```

The demo forces a separate local database under .data/demo and outputs under .data/demo-output. All names and organisations are fictional. It includes an overdue request, a busy advocate, a stale profile and an approved story whose permission expired. The demo does not touch DATABASE_URL.

For real records choose a fresh DATA_DIR or a controlled PostgreSQL connection, run npm run migrate, then import without seeding. [CLI reference](docs/cli.md) includes Bash and PowerShell examples.

## Commands

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

## Ten questions across your records

1. Which overdue requests still have no advocate?
2. Which advocates have reached their agreed capacity?
3. Which open assignments lost valid permission or a current profile?
4. Which approved stories must be withheld today?
5. Which active advocates have gone quiet for a month?
6. Where do open requests lack any matching active profile?
7. Which permissions expire in the next thirty days?
8. Which imported advocates still await profile review?
9. Which owners carry the largest unfulfilled request queue?
10. Which companies supplied completed references in the last thirty days?

The insights command answers each with current records. These cross-record answers are included here; this is not a claim that a configured Influitive report can never answer the same question.

## Your first hour: ten things to ask for

1. Show the reference desk and overdue requests.
2. Find candidates for REF-101 and explain every blocked match.
3. Show Ben's workload and cooldown.
4. Read Aroha's full profile and permission history.
5. Which story is withheld and why?
6. Draft the Monday review with owners for each exception.
7. Render the internal reference briefs in our brand.
8. Preview my activity export before importing it.
9. Add our customer segment field and include it in matching.
10. Add a read-only view of requests by owner and product.

## Import once, keep the evidence

```bash
node scripts/advocacy.mjs import influitive --file="examples/influitive-activity.csv" --dry-run --actor="Advocacy coordinator"
```

The importer supports the documented activity-feed CSV. It preserves original rows and the source file, validates the whole batch and skips repeat imports. Changed source history stops for reconciliation. Imported profiles start paused with no assumed permission. Review historical workload and classify profiles before activation. Community content, media and separate approval records need their own archive and mapping. [Switching guide](docs/replace-influitive.md).

## Documents, views and privacy checks

npm run docs renders internal reference briefs, permission review sheets and usable story wording packs. npm run view renders weekly work, advocate workload and record checks. Set business name, logo and colours in brand.json. The HTML has no action buttons or server. Every document is a draft. Rerender before use because old files do not change when permission is withdrawn.

[Compliance notes](docs/compliance.md) cite NZ privacy principles and Australian guidance. They explain what is checked, where a person must decide and which time periods are internal policies. No record check certifies compliance. Free-text audience restrictions require human review. The CLI never sends a message, publishes a story or pays a reward.

## Storage and verification

Eight domain record types use UUIDs, foreign keys, uniqueness constraints and timestamp triggers. Plain PostgreSQL migrations also run on PGlite. The CLI records operator labels and mutation history; these are not authentication or tamper-proof signatures. Public database roles receive no table or view grants. A team deployment needs identity, least privilege, backup and a tested restore. Exports contain all domain records and original CSV text; protect them as personal information.

npm test isolates its database and generated output. It verifies workflows, permission withdrawal, capacity and cooldown, approval transitions, transactional imports, rollback, source preservation, ambiguity, JSON errors, exports, drafts and escaped HTML. CI is configured for Node 20 and 22 on Linux and Windows; consult the actual Actions run for platform results.

## Licence

MIT. Copyright (c) 2026 Enterprise DNA. Influitive is its owner's trademark. This independent project is not affiliated with or endorsed by Influitive.
