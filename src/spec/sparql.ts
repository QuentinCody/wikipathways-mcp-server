import type { ApiCatalog, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";
const paging = [
  {name: "limit", type: "number" as const, required: false, description: "Binding rows, 1–100; default 25"},
  {name: "offset", type: "number" as const, required: false, description: "0–100000; default 0. Live pages are not an immutable snapshot"},
];
export const sparqlEndpoints: ApiCatalog["endpoints"] = [
  {method: "GET", path: "/sparql/datasets", category: "sparql",
    summary: "Discover live RDF dataset metadata (URI, title, createdOn, license where supplied). Metadata does not establish equality with the static JSON release.", queryParams: paging},
  {method: "GET", path: "/sparql/pathway-xrefs", category: "sparql",
    summary: "One page of BridgeDb mapping predicates/identifiers for an exact pathway, alongside native node identifiers, species and pathway revision URI. Unmapped nodes are absent; mappings are not proof of biological equivalence.",
    queryParams: [{name: "pathway_id", type: "string", required: true, description: "Exact WP identifier, e.g. WP554"}, ...paging]},
  {method: "GET", path: "/sparql/pathway-interactions", category: "sparql",
    summary: "One page of raw RDF triples for pathway interactions. Retains interaction URI, type/source/target/participants/references predicates and values; pages can split an interaction. Do not infer directed pairs from participants.",
    queryParams: [{name: "pathway_id", type: "string", required: true, description: "Exact WP identifier, e.g. WP554"}, ...paging]},
];
export const sparqlWorkflows: WorkflowRecipe[] = [
  {title: "WikiPathways RDF cross-database identifiers with source context", keywords: ["SPARQL", "BridgeDb", "xref", "UniProt", "ChEBI", "identifier"],
    description: "Read dataset metadata and a bounded exact-pathway mapping page. Preserve native versus mapped identifier namespaces and revision URIs. Both pages may be partial and are not an atomic snapshot; follow _sparql.next_offset explicitly or inspect staged SQL.",
    code: `const metadata = await api.get("/sparql/datasets", {limit: 25, offset: 0});
if (metadata.__api_error || metadata.__stage_error || metadata.__staged) return metadata;
const mappings = await api.get("/sparql/pathway-xrefs", {pathway_id: "WP554", limit: 25, offset: 0});
return {metadata, mappings, complete: false};`},
  {title: "WikiPathways interaction predicates without inferring direction", keywords: ["SPARQL", "relationship", "interaction", "source", "target", "participants"],
    description: "Retain one bounded page of source RDF triples with interaction/pathway identity. Interpret source and target only if those predicates are present; participant membership is separate. A page need not contain every triple for an interaction.",
    code: `const interactions = await api.get("/sparql/pathway-interactions", {pathway_id: "WP554", limit: 25, offset: 0});
if (interactions.__api_error || interactions.__stage_error || interactions.__staged) return interactions;
return {interactions, complete: false};`},
];
