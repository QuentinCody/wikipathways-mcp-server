export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), {status});
}
function integer(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(`${name} must be an integer from ${min} to ${max}`);
  return value;
}
export function pathwayQuery(path: string, params: Record<string, unknown>) {
  const metadata = path === "/sparql/datasets";
  if (!["/sparql/datasets", "/sparql/pathway-xrefs", "/sparql/pathway-interactions"].includes(path)) fail("Unknown WikiPathways SPARQL helper", 404);
  const allowed = metadata ? ["limit", "offset"] : ["pathway_id", "limit", "offset"];
  for (const key of Object.keys(params)) if (!allowed.includes(key)) fail(`Unsupported SPARQL parameter: ${key}`);
  const id = params.pathway_id;
  if (!metadata && (typeof id !== "string" || !/^WP[1-9][0-9]{0,9}$/.test(id))) fail("pathway_id must be an exact WikiPathways ID such as WP554");
  const limit = integer(params.limit ?? 25, "limit", 1, 100);
  const offset = integer(params.offset ?? 0, "offset", 0, 100_000);
  const prefixes = `PREFIX wp: <http://vocabularies.wikipathways.org/wp#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX void: <http://rdfs.org/ns/void#>
PREFIX pav: <http://purl.org/pav/>`;
  let variables: string[];
  let required: string[];
  let patterns: string;
  const context = `?pathway a wp:Pathway ; dcterms:identifier ?pathway_id .
FILTER(STR(?pathway_id) = ${JSON.stringify(id ?? "")})
OPTIONAL { ?pathway dc:title ?title }
OPTIONAL { ?pathway wp:organismName ?organism }
OPTIONAL { ?pathway foaf:page ?page }`;
  if (metadata) {
    variables = ["dataset", "title", "date", "license"];
    required = ["dataset"];
    patterns = `?dataset a void:Dataset .
OPTIONAL { ?dataset dcterms:title ?title }
OPTIONAL { ?dataset pav:createdOn ?date }
OPTIONAL { ?dataset dcterms:license ?license }`;
  } else if (path === "/sparql/pathway-xrefs") {
    variables = ["pathway", "pathway_id", "title", "organism", "page", "node", "label", "native_id", "native_source", "mapping_predicate", "mapped_id"];
    required = ["pathway", "pathway_id", "node", "mapping_predicate", "mapped_id"];
    patterns = `${context}
?node dcterms:isPartOf ?pathway ; ?mapping_predicate ?mapped_id .
FILTER(STRSTARTS(STR(?mapping_predicate), "http://vocabularies.wikipathways.org/wp#bdb"))
OPTIONAL { ?node rdfs:label ?label }
OPTIONAL { ?node dcterms:identifier ?native_id }
OPTIONAL { ?node dc:source ?native_source }`;
  } else {
    variables = ["pathway", "pathway_id", "title", "organism", "page", "interaction", "predicate", "value"];
    required = ["pathway", "pathway_id", "interaction", "predicate", "value"];
    patterns = `${context}
?interaction a wp:Interaction ; dcterms:isPartOf ?pathway ; ?predicate ?value .`;
  }
  const selected = variables.map(variable => `?${variable}`).join(" ");
  return {id, limit, offset, variables, required, query: `${prefixes}\nSELECT DISTINCT ${selected} WHERE {\n${patterns}\n}\nORDER BY ${selected}\nLIMIT ${limit} OFFSET ${offset}`};
}
