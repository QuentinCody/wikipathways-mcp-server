import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

/** Keep RDF lexical values and optional term attributes intact in SQL. */
export function rdfTables(value: unknown): Record<string, Row[]> | undefined {
  const data = object(value) && Array.isArray(value.content) && object(value.structuredContent) ? value.structuredContent.data : value;
  if (!object(data) || !object(data._sparql) || !object(data.head) || !object(data.results) || !Array.isArray(data.results.bindings)) return undefined;
  const { results, ...context } = data;
  const { bindings, ...resultMetadata } = results as Row & { bindings: unknown[] };
  const terms: Row[] = [];
  const rows = bindings.map((binding, binding_index) => {
    if (object(binding)) for (const [variable, term] of Object.entries(binding)) {
      if (object(term)) terms.push({ binding_index, variable, type: term.type, value: term.value,
        datatype: term.datatype ?? null, language: term["xml:lang"] ?? null, native_json: JSON.stringify(term) });
    }
    return { binding_index, native_json: JSON.stringify(binding) };
  });
  return { rdf_bindings: rows, rdf_terms: terms, rdf_context: [{ native_json: JSON.stringify({ ...context, results: resultMetadata }) }] };
}

export const rdfSchemaHints: SchemaHints = { columnTypes: {
  native_json: "TEXT", variable: "TEXT", type: "TEXT", value: "TEXT", datatype: "TEXT", language: "TEXT",
} };
