import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { fail, pathwayQuery } from "./sparql-query";
import { nativeError } from "./native-error";
export const SPARQL_ENDPOINT = "https://sparql.wikipathways.org/sparql";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Invalid WikiPathways SPARQL object", 502);
  return value as Record<string, unknown>;
}
async function bodyText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) fail("Empty WikiPathways SPARQL body", 502);
  const decoder = new TextDecoder("utf-8", {fatal: true, ignoreBOM: false});
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4 * 1024 * 1024) fail("WikiPathways SPARQL response exceeds 4 MiB; narrow the request", 502);
      text += decoder.decode(value, {stream: true});
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function sparqlRead(request: Parameters<ApiFetchFn>[0]) {
  if (request.method.toUpperCase() !== "GET" || request.body !== undefined) fail("SPARQL helpers require GET without a body", 405);
  const selected = pathwayQuery(request.path, request.params ?? {});
  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set("query", selected.query);
  url.searchParams.set("format", "application/sparql-results+json");
  const response = await fetch(url, {headers: {Accept: "application/sparql-results+json"}, signal: AbortSignal.timeout(45_000), redirect: "manual"});
  if (!response.ok) throw await nativeError(response, url.href);
  const raw = await bodyText(response);
  const { data, bindings } = parseSparqlBindings(raw, selected);
  const partialHeaders = {max_rows: response.headers.get("X-SPARQL-MaxRows"), sql_state: response.headers.get("X-SQL-State"), sql_message: response.headers.get("X-SQL-Message")};
  const partial = partialHeaders.max_rows !== null || (!!partialHeaders.sql_state && partialHeaders.sql_state !== "00000");
  const offsetLimit = selected.offset + selected.limit > 100_000;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return {status: response.status, data: {...data, _sparql: {
    endpoint: SPARQL_ENDPOINT, retrieved_at: new Date().toISOString(), query: selected.query,
    response_sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join(""),
    pathway_id: selected.id, limit: selected.limit, offset: selected.offset, returned_rows: bindings.length,
    next_offset: bindings.length === selected.limit && !partial && !offsetLimit ? selected.offset + selected.limit : null,
    provider_partial: partial, partial_headers: partialHeaders, continuation_limit_reached: bindings.length === selected.limit && offsetLimit,
    complete: false, snapshot_version: null,
    interpretation: "One page of RDF bindings, not unique entities. Preserve pathway/revision URIs, species, RDF language/datatype and unmapped/native identifiers. BridgeDb mappings are not biological equivalence; interaction membership alone does not establish direction or causality. Dataset metadata is separate and does not pin these live OFFSET pages or the static JSON API.",
  }}};
}

function parseSparqlBindings(raw: string, selected: { id: unknown; limit: number; offset: number; variables: string[]; required: string[]; query: string; }) {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { fail("WikiPathways SPARQL returned invalid JSON", 502); }
  const data = object(parsed);
  if (data.error !== undefined || data.errors !== undefined || data.boolean !== undefined) fail("WikiPathways did not return a successful SELECT result", 502);
  const vars = object(data.head).vars;
  const bindings = object(data.results).bindings;
  if (!Array.isArray(vars) || vars.length !== selected.variables.length || new Set(vars).size !== vars.length || selected.variables.some(v => !vars.includes(v))) fail("SPARQL variables disagree with query", 502);
  if (!Array.isArray(bindings) || bindings.length > selected.limit) fail("Invalid or oversized SPARQL page", 502);
  for (const binding of bindings) {
    const row = object(binding);
    for (const name of selected.required) if (row[name] === undefined) fail("Required SPARQL binding is absent", 502);
    for (const [name, value] of Object.entries(row)) {
      const term = object(value);
      if (!selected.variables.includes(name) || !["uri", "bnode", "literal", "typed-literal"].includes(String(term.type)) || typeof term.value !== "string" || (term.datatype !== undefined && typeof term.datatype !== "string") || (term["xml:lang"] !== undefined && typeof term["xml:lang"] !== "string")) fail("Malformed RDF binding", 502);
    }
    if (selected.id && object(row.pathway_id).value !== selected.id) fail("SPARQL returned a different pathway identifier", 502);
  }
  return { data, bindings };
}
