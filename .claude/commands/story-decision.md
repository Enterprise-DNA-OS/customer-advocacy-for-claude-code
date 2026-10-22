---
description: Record approval of exact wording or withdraw a story from use.
---

Read CLAUDE.md. Read the full advocate or request history first. Use only the operator's supplied facts and evidence. Never infer consent, acceptance, completed participation or approval. Read docs/cli.md for all flags. A permission grant is scoped by purpose and restrictions; review the text yourself. A reference match never sends an invitation.

```bash
node scripts/advocacy.mjs story-decision --story="<title or id>" --action=approve --evidence="<wording approval>" --actor="<operator>"
```

Use --json for further analysis. Return the result in this conversation. Do not send or publish anything.
