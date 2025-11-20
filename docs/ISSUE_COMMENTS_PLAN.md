# Issue Comment Tooling Plan

## Goals
1. Provide MCP tools for creating new Redmine issue comments (journals/notes) using only official REST endpoints.
2. Provide MCP tools for listing existing comments with basic pagination performed client-side.
3. Keep compatibility with multi-repository setup and security policies (SecretsResolver, fail-fast, no silent fallbacks).

## Non-Goals
- Updating or deleting existing comments (not supported by Redmine REST API).
- Installing/depending on Redmine plugins or direct DB access.

## Reference APIs
- `PUT /issues/:id.json` with `notes` field → append comment.
- `GET /issues/:id.json?include=journals` → returns journals array (no server-side paging).

## Planned Tools
1. `redmine_add_issue_comment`
   - Input: `issue_id` (number), `notes` (string), optional `private_notes` (boolean), optional `repository_id`.
   - Behavior: Performs PUT with `issue: { notes, private_notes }`. Returns formatted confirmation plus the new journal entry if API responds with `issue` object.

2. `redmine_list_issue_comments`
   - Input: `issue_id`, optional `repository_id`, `offset` (default 0), `limit` (default 20).
   - Implementation: fetch journals via GET, sort by created_on ascending, slice using offset/limit, return metadata (`total_count`, `next_offset`).

## Implementation Steps
1. **Schema Updates**
   - Add Zod schemas for add/list comment inputs.
   - Reuse `RedmineIssue` typing for journal subset or define `RedmineJournal` interface (id, user, notes, created_on, private).

2. **Handlers**
   - `handleRedmineAddIssueComment` → validates input, calls PUT, logs result, returns formatted text.
   - `handleRedmineListIssueComments` → fetch issue with journals, handles empty results, slices for pagination, formats output.

3. **Tool Registration**
   - Register both tools in `ListToolsRequestSchema` response with detailed descriptions and input schemas (including repository_id option).

4. **Testing & Validation**
   - Build via `npm run build`.
   - Manual smoke tests using MCP invocation for both new tools against a known repository (e.g., myredmine).

5. **Documentation**
   - README: update Redmine tools section to describe new comment tools and pagination behavior.

## Considerations
- Journals array may include entries without notes (status changes). Filter to only entries containing `notes` unless user requests all; for first version, include only entries with `notes`.
- Private notes flag requires Redmine permission; surface 403 errors with fail-fast messaging.
- For pagination, expose `has_more` and `next_offset` to aid clients.
