---
description: Import the documented Influitive activity-feed export.
---

Read CLAUDE.md. Read docs/replace-influitive.md. Inspect header names and dates, review the dry run, then rerun without --dry-run for the requested import. Imported history gives no permission. Review every new paused profile before activation.

```bash
node scripts/advocacy.mjs import influitive --file="<export.csv>" --dry-run --actor="<operator>"
```
