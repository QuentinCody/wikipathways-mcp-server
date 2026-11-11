# Wikipathways MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query the upstream WikiPathways API in natural language. It belongs to the [Bio MCP](../../README.md) monorepo.

## Connect

The server is deployed and ready at:

```
https://wikipathways-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "wikipathways": {
      "command": "npx",
      "args": ["mcp-remote", "https://wikipathways-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8836/mcp` (start it with `./scripts/dev-servers.sh wikipathways`):

```json
{
  "mcpServers": {
    "wikipathways-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8836/mcp"]
    }
  }
}
```

## Tools

- `wikipathways_search` — discover static JSON, pathway assets and bounded RDF operations
- `wikipathways_execute` — **Code Mode**: write JavaScript in a V8 isolate (`api.get()` / `api.post()` / `searchSpec()`) instead of issuing tool calls one by one
- `wikipathways_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `wikipathways_get_schema` — inspect the inferred schema of a staged dataset

Large responses (>30KB) are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Every tool returns both a human-readable `content` summary and a structured `structuredContent` payload.

## Development

```bash
./scripts/dev-servers.sh wikipathways            # run locally (port 8836)
pnpm --filter wikipathways-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).

---

*Auto-generated baseline README — refine with server-specific detail as needed.*

## Bounded SPARQL relationships and identifier mappings

The existing static JSON/assets API is complemented by three read-only helpers against `https://sparql.wikipathways.org/sparql`:

- `/sparql/datasets`: RDF dataset URI, title, creation date and license where present.
- `/sparql/pathway-xrefs`: native node identifiers plus BridgeDb mapping predicates and mapped RDF identifiers for an exact `pathway_id` such as `WP554`. Unmapped nodes are absent; mappings are not biological equivalence assertions.
- `/sparql/pathway-interactions`: native interaction triples for that pathway, retaining types, source, target, participants and references as separate predicates. A page can split an interaction; participant membership alone does not imply direction or causality.

Each helper accepts `limit` (1–100, default 25) and `offset` (0–100000, default 0). The two pathway helpers require `pathway_id`. Arbitrary SPARQL and endpoint overrides are not accepted. The catalog provides mapping and interaction recipes with explicit partial coverage and staged/error-handle preservation.

Full SPARQL JSON terms retain URI, language and datatype, alongside pathway/revision URIs and organism names. `_sparql` includes query, retrieval time, raw UTF-8 response SHA-256, paging and provider-partial headers. Partial results suppress continuation. Metadata does not pin live OFFSET pages or establish that the static JSON and RDF datasets share a release; `snapshot_version` stays unknown. Preserve namespace and revision differences during cross-server joins.

All four tools have both `wikipathways_*` and `mcp_wikipathways_*` aliases. Results over 30 KiB stage, including large single-record assets; check the returned handle before dereferencing inline properties. New SPARQL reads have a 45-second timeout and 4 MiB response bound, with a 90-second Code Mode execution budget.

These queries follow the [official SPARQL examples](https://github.com/wikipathways/wikipathways.github.io/blob/main/sparql.md), [Semantic Web portal](https://sandbox.wikipathways.org/rdf.html) and [provider interaction RDF](https://github.com/wikipathways/SARS-CoV-2-WikiPathways/blob/master/wp/Human/WP5414.ttl). This fills existing API coverage; no newly released 2026 endpoint is claimed.

October 5, 2026 native and local Worker acceptance passed: seven dataset bindings, 306 mapping bindings and 250 interaction triples for `WP554_r139872`; all 11 catalog examples and five recipes executed successfully. All catalogued static distributions matched their native payload hashes. These observations do not establish corpus-wide coverage or an atomic snapshot. Changes are undeployed; see the [acceptance review](../../docs/audits/2026-10-05-wikipathways-review.md).

Staged RDF adds `rdf_bindings(binding_index, native_json)`, `rdf_terms(binding_index, variable, type, value, datatype, language, native_json)` and `rdf_context(native_json)`. Term values remain strings, including numeric-looking literals. An unbound variable has no term row; repeated bindings retain separate indices. The canonical `payloads` table retains the complete original response independently of these SQL projections. SQL queries and schemas can themselves stage when their full response exceeds 30 KiB; follow each returned handle.

Every tool alias cites successes and errors. Upstream errors retain status, source URL, a bounded 64 KiB decoded body and its hash/completeness. Static counts and file sizes change; use `/json/getCounts.json` and current responses instead of historical catalog estimates.

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from WikiPathways and stays under the terms of that source: CC0.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
