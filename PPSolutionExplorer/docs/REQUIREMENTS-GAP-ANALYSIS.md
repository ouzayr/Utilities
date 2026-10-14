# Requirements gap analysis – "Local Power Automate Flow Workbench"

Compares the brainstormed requirements against PP Solution Explorer as built.

**Status key**
- **Had**: already in the first release.
- **Added**: implemented in this round.
- **Partial**: some of it is done. The limit is stated.
- **Blocked by principle**: conflicts with a non-negotiable rule in `CLAUDE.md` (read-only, or local-only). Needs a product decision first.
- **Needs environment**: needs a live connection to a Power Platform environment (Dataverse/Flow APIs, sign-in). That also breaks the local-only rule.

## Bottom line

About 60 % of the list fits the current product (a read-only analyser) and is now implemented. The rest falls into two groups, and both change what the product is:

1. **Authoring and write-back**: editing, publishing, find-and-replace, bulk edits, refactoring. This breaks principle 1, "Read-only toward customer assets".
2. **Live environment access**: import from or publish to an environment, run history, live-vs-local comparison. This breaks principle 4, "Local only", and adds sign-in and secret handling.

Neither is a coding gap. Each is a scope decision with real risk: Microsoft's flow format is not formally versioned, and a bad write to a customer's flow is far worse than a misread. See "Decision needed" at the end.

## 1. Flow authoring and management

| Requirement | Status | Notes |
|---|---|---|
| Open and view cloud flows locally | Had | Solution zip, flow package zip, flow JSON. |
| Edit cloud flows locally | Blocked by principle | Read-only by design. |
| Import from environment / publish back | Blocked by principle + Needs environment | Import from an export file works today. |
| Create flows from a file, drag-and-drop actions | Blocked by principle | This means building a designer. Large scope. |
| Multiple flows and solutions in one workspace | Had / Added | Many imports side by side. Search across all of them is new. |
| Templates and snippets library | Blocked by principle | Only useful with authoring. |
| Multiple environments, environment-aware connection references | Partial | Import one export per environment and compare them to see drift (connection references and environment variables included). No live environment switching. |

## 2. Visualization

| Requirement | Status | Notes |
|---|---|---|
| Full canvas with nested conditions, scopes, loops | Had | Cytoscape + ELK, with branch lanes. |
| Collapse and expand sections | Added | Double-click a container, or Collapse all / Expand all. Edges re-attach to the collapsed node. Jumping to a hidden step expands its parents. |
| Minimap and zoom-to-fit | Added | Minimap with a viewport rectangle and click-to-navigate. Fit button. |
| Colour coding by type, connector, status | Added | Colour by step type, connector, quality findings (error/warning/info) or changes against a baseline. "Disabled" status isn't shown: exports carry no per-action disabled flag. |

## 3. Dependency analysis

| Requirement | Status | Notes |
|---|---|---|
| Click an action to highlight what it depends on and what depends on it | Added | Follows runAfter and data flow both ways. |
| Where variables, outputs and expressions are used | Had / Added | Data-flow edges and node links existed. New: per-step expression list with JSON path and the references each expression reads. |
| Detect unused actions and variables | Added | Rule PPSE009 (variable never read) and PPSE010 (data operation output never used). |
| Detect broken references | Added | Rule PPSE008 (Error) for an unknown action, an uninitialised variable, or a runAfter outside the scope. Dynamic references stay PPSE004 (Info). |
| Impact analysis | Had | Recursive SQL query over the graph. |

## 4. Search and navigation

| Requirement | Status | Notes |
|---|---|---|
| Search by name, type, connector, expression, value | Had | The "raw JSON" option covers expressions and values. |
| Jump from a search result to the canvas | Had / Added | Now centres and selects the step, expanding collapsed parents. |
| Find and replace | Blocked by principle | Find works today. Replace means writing to the flow. |
| Cross-flow search across the workspace | Added | "Search all" page, across every import. |

## 5. Editing operations

| Requirement | Status |
|---|---|
| Duplicate or move sections, preview changes, undo/redo, bulk edits | Blocked by principle. All of these only exist with authoring. |

## 6. Version comparison

| Requirement | Status | Notes |
|---|---|---|
| Compare two versions with a visual overlay | Added | Compare page, plus a canvas overlay: added (green), changed (amber), moved (purple), removed listed in the panel. |
| Property-level diff | Added | JSON-path diff, e.g. `inputs/parameters/$filter: … eq 0 → … eq 1`. runAfter status changes are shown. Designer noise (`operationMetadataId`) is ignored. |
| Local version history with Git integration | Partial | Every import is kept and can be compared, which gives a local history. No Git integration: the tool never writes files, and unpacking exports into Git is better done with `pac solution unpack` in your own pipeline. |
| Compare local copy against live environment | Needs environment | Workaround: export from the environment, import, compare. |
| Detect drift between environments | Added | Import the DEV and PROD exports and compare. IDs are kept across solution import, so they line up. |

Steps are matched by stable ID. A renamed action shows as removed plus added; matching by similarity would be guessing.

## 7. Performance and quality analysis

| Requirement | Status | Notes |
|---|---|---|
| Performance issues | Added / Partial | Sequential loops calling connectors without concurrency (PPSE011), List rows without $top or pagination (PPSE007), unused output (PPSE010). Loops that need sequential runs (they set variables) are not flagged. "Unfiltered queries" beyond $top is not checked. |
| Rule-based suggestions with severity | Had / Added | 14 rules (was 7), each with a category and severity. |
| Complexity score per flow | Added | Score = steps + 2·branches + 5·depth + 0.5·expressions + 10·log10(paths). Rated Low / Medium / High / VeryHigh. Shown in the viewer, inventory and docs. |
| Best-practice checks | Added | Error handling (PPSE001), naming (PPSE002), hard-coded GUIDs and URLs (PPSE005, PPSE013), plain-text secrets (PPSE012, Error). The secret value is never shown. |
| Run history analysis | Needs environment | Run history isn't in exports. |
| Configurable rule sets per team or project | Added | `Quality:Profiles:<name>`: turn rules on or off, change severity, set thresholds and secret key names. A Rules page shows the effective settings. |

## 8. Documentation

| Requirement | Status | Notes |
|---|---|---|
| Per-flow docs (purpose, trigger, steps, connectors) | Had | "Purpose" needs AI to be switched on. |
| Inputs and outputs | Partial | Trigger, connectors and data access are covered. A formal input/output schema table is not generated. |
| Markdown and other formats | Had | Markdown and HTML. |
| Diagrams embedded in docs | Added | Mermaid flowchart per flow (scopes as subgraphs, branch lanes, failure edges). Checked by rendering it with Mermaid 11. Flows over 300 steps skip the diagram. HTML shows the diagram source; no script is loaded, to stay offline. |
| Change log from version differences | Added | `/api/diff?…&format=md|html`. |
| Solution-wide docs with connector and dependency inventory | Had / Added | New connector inventory: premium flag, connection references, flows, step counts, deprecated usage. Complexity added per flow. |

## 9. AI integration

| Requirement | Status | Notes |
|---|---|---|
| Work with AI assistants inside VS Code (Copilot, Claude Code) | Blocked by principle | Technically small: a read-only MCP server on the API. But it sends flow content to whatever model the assistant uses, often a cloud model. That breaks "Local only" unless you change the rule. |
| AI can read, search and explain flows | Had | Through the local llama.cpp layer. |
| AI can modify and review flows | Blocked by principle | "Review" works: AI explains rule findings. "Modify" doesn't. |
| Integrate Power Platform skills | Not started | Needs a definition of which skills. Depends on the MCP decision above. |
| Natural-language queries | Had | Turned into a structured query, checked against known values, and shown to the user. |
| AI-assisted refactoring with human approval | Blocked by principle | Needs authoring. |
| AI explanation of expressions and complex logic | Added | "Explain" on each expression in the node panel, as a background job. The expression is re-read on the server (not taken from the client) and redacted. |

## 10. Governance and safety

| Requirement | Status | Notes |
|---|---|---|
| Pre-publish validation and confirmation | Partial | Validation exists (rules, broken references). Publish doesn't. |
| Automatic backup before publish or overwrite | N/A | Nothing is ever overwritten. Deleting an import keeps tags and notes. |
| Audit log of changes made through the tool | Added | `audit_log` table and Audit page. Records imports, tags, notes, AI jobs and accepted AI tags, with OS user and time. Append-only. |
| No secrets stored in plain text | Had | No credentials are needed. Secret-type environment variables are not stored. The DB connection string sits in a git-ignored, permission-restricted file. |
| Inventory: connectors, owners, premium, deprecated | Added / Partial | Connectors, premium and deprecated are done. **Owners are not in exports**, so they need an environment connection. Premium and deprecated lists are configuration (`Inventory:*`), not Microsoft data: check them against current licensing docs. |

## 11. Non-functional

| Requirement | Status | Notes |
|---|---|---|
| Hundreds of actions without lag | Added | Graph lookups are now indexed (they were linear scans). Test: about 2,000 steps parsed, traced (1.8M+ paths counted, 1,000 listed), rule-checked and scored in about 0.4 s. The canvas uses collapse and a minimap for large flows. ELK layout on 1,000+ visible nodes takes seconds in the browser; collapse-all helps. |
| Fully local, no data sent except to explicitly connected services | Had | Stricter than the requirement: no environment connection exists at all. |
| Resilient to Microsoft format changes | Had / Added | Unknown types are kept as Unknown. New: a warning when a flow uses an unexpected schema version. Parsing is best-effort; one bad flow file doesn't stop the others. |
| Clear error messages | Added | Invalid JSON or XML reports file, line and position. A bad environment variable definition becomes a warning, not a failure. |

## Decision needed

| Option | What it adds | Cost and risk |
|---|---|---|
| **A. Stay read-only** (current) | Analysis, docs, comparison, governance | Lowest risk. Authoring stays in the Power Automate designer. |
| **B. "Edit to file"** | Local edits (find/replace, bulk edits, duplicate/move, snippets, AI refactor with approval) that **export a new solution zip** for a human to import with the normal tools | Breaks principle 1 in a limited way. Needs a write-safe serializer, round-trip tests on real exports, and undo/redo. Medium to large effort. |
| **C. Live environment connection** | Import/publish, run history, live drift, owners, "local vs live" | Breaks principle 4. Needs Entra ID sign-in (MSAL), token storage in the OS keychain, Dataverse/Flow API clients, throttling and retries. Large effort; needs security review. |
| **D. MCP for coding assistants** | Copilot or Claude Code can query and explain flows | Small effort (read-only tools). Data reaches the assistant's model, so it needs an explicit opt-in switch, redaction, and principle 4 amended. |

My recommendation: **A + D (opt-in, read-only)** now. Treat **B** as a separate project only if consultants actually need bulk edits, and prove it first on real exports. Avoid **C** unless run-history analysis is a must-have. It brings the most risk and the most moving parts.
