# Move an Influitive advocacy desk

The one-command importer accepts Influitive's documented Admin View activity-feed CSV. It brings contact details and event history into a local advocacy desk. It does not migrate the entire hosted community.

Source: [Influitive: Exporting all Advocate activity](https://support.influitive.com/article/50027-exporting-all-advocate-activity-i-e-the-dashboard-feed), checked 22 October 2026. In Admin View, go to Home, find the Activity Feed export, choose the required date range and All Items, and download the export. Check the selected range covers the history you need.

```bash
npm install
npm run migrate
node scripts/advocacy.mjs import influitive --file="/private/influitive.csv" --dry-run --actor="Advocacy coordinator"
node scripts/advocacy.mjs import influitive --file="/private/influitive.csv" --actor="Advocacy coordinator"
```

Use a fresh DATA_DIR or a controlled empty team database. Do not run seed on real data. The fictional example is examples/influitive-activity.csv, built from the vendor's documented headers, not a captured customer export.

| Export field | Destination |
|---|---|
| Event ID | Stable external activity key |
| Event Date | Event calendar date |
| Event Type | Original activity type, not an inferred workflow status |
| Related Object | Activity reference text |
| Contact ID | Stable external advocate key |
| Email, Name, Company | Advocate profile |
| Contact Type, Salesforce ID | Preserved in the original source row |
| Points | Historical numeric value, no reward balance or payment |

All eleven documented columns must be present. Extra columns, full rows and the exact original CSV are retained. Quoted commas, quoted newlines, escaped quotes, CRLF and a UTF-8 BOM are supported. For renamed headers pass --map with a private JSON object mapping standard names to source names. For example: {"Event ID":"Activity Identifier"}. No delimiter or format is silently guessed.

ISO calendar dates and ISO-leading timestamp strings use the written date. For slash-separated dates explicitly set --date-format=dmy or --date-format=mdy. The original full value is retained; no timestamp timezone conversion is claimed. Blank identifiers, blank profile names/company, invalid email, malformed dates, future events, duplicate events within a file and malformed points stop the batch. Check the preview before the live import.

The transaction validates the whole file. A failed batch changes nothing. An identical file is skipped. An unchanged event in a later file is skipped; a changed event or conflicting profile stops the batch for reconciliation. A second Contact ID sharing an email also stops rather than silently merging people. For source corrections, compare original rows, obtain an operator decision, and make a reviewed migration or extend the importer through /customise. Never erase old evidence to make an import pass.

Imported profiles are paused and have no permission grants. Classify industry/product/region, set the owner, review recent history and commitments, then record profile verification, retention review and purpose-specific permission evidence. Historical activity types are preserved as history, not automatically counted as reference assignments. Set conservative limits until recent calls and commitments are reconciled.

Community discussions, challenge definitions, reward fulfilment, media files, historical reference approvals and consent attachments are not in this activity export. Archive those separately and agree a mapping for any extra exports. Enterprise DNA scopes this work before switching. The free desk is useful offline; hosted community features and business connections are separate implementation work.

## Reconcile before switching

Compare exported event counts and dates with imported/skipped counts. Read several full advocate histories, verify source IDs and review every new paused profile. Check permission evidence separately. Run the weekly review beside the incumbent once. Use export to preserve all eight domain record types and original CSV text. Keep a database backup and test its restoration before moving real work. The JSON export is portable evidence, not an automatic database restore command.
