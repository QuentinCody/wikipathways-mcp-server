import { afterEach, describe, expect, it, vi } from "vitest";
import { createWikipathwaysApiFetch } from "./api-adapter";
import { pathwayQuery } from "./sparql-query";
const api = createWikipathwaysApiFetch();
const uri = (value: string) => ({type: "uri", value});
const literal = (value: string) => ({type: "literal", value});
const path = "/sparql/pathway-interactions";
const row = {pathway: uri("https://identifiers.org/wikipathways/WP554_r123"), pathway_id: literal("WP554"), title: {...literal("Titre"), "xml:lang": "fr"}, organism: literal("Homo sapiens"), interaction: uri("https://example.org/interaction"), predicate: uri("http://vocabularies.wikipathways.org/wp#participants"), value: uri("https://identifiers.org/uniprot/P12345")};
function envelope(rows: unknown[] = [row], route = path) {
  return {head: {vars: pathwayQuery(route, route === "/sparql/datasets" ? {} : {pathway_id: "WP554"}).variables}, results: {bindings: rows}};
}
function mock(data: unknown, headers: Record<string, string> = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data), {headers: {"content-type": "application/sparql-results+json", ...headers}})));
}
const read = (params = {}) => api({method: "GET", path, params: {pathway_id: "WP554", ...params}});
afterEach(() => vi.unstubAllGlobals());
describe("bounded WikiPathways RDF", () => {
  it("preserves pathway revisions, species, direction predicate and RDF language", async () => {
    mock(envelope());
    const result = await read({limit: 1});
    expect(result.data).toMatchObject({...envelope(), _sparql: {next_offset: 1, complete: false, snapshot_version: null, response_sha256: expect.stringMatching(/^[0-9a-f]{64}$/)}});
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://sparql.wikipathways.org/sparql");
    expect(url.searchParams.get("query")).toContain('FILTER(STR(?pathway_id) = "WP554")');
    expect(url.searchParams.get("format")).toBe("application/sparql-results+json");
  });
  it("keeps native and mapped identifiers as different terms", async () => {
    const route = "/sparql/pathway-xrefs";
    const mapping = {pathway: row.pathway, pathway_id: row.pathway_id, node: uri("https://example.org/node"), native_id: literal("7157"), native_source: literal("Entrez Gene"), mapping_predicate: uri("http://vocabularies.wikipathways.org/wp#bdbUniprot"), mapped_id: uri("https://identifiers.org/uniprot/P04637")};
    mock(envelope([mapping], route));
    expect((await api({method: "GET", path: route, params: {pathway_id: "WP554"}})).data).toMatchObject(envelope([mapping], route));
  });
  it("preserves dataset dates as typed RDF without declaring a release pin", async () => {
    const route = "/sparql/datasets";
    const dataset = {dataset: uri("https://example.org/dataset"), date: {...literal("2026-09-01"), datatype: "http://www.w3.org/2001/XMLSchema#date"}};
    mock(envelope([dataset], route));
    expect((await api({method: "GET", path: route})).data).toMatchObject({...envelope([dataset], route), _sparql: {snapshot_version: null}});
  });
  it.each<Record<string, string>>([{"X-SQL-State": "S1TAT"}, {"X-SPARQL-MaxRows": "1"}])("suppresses continuation for partial upstream result %j", async headers => {
    mock(envelope(), headers);
    expect((await read({limit: 1})).data).toMatchObject({_sparql: {provider_partial: true, next_offset: null, complete: false}});
  });
  it("stops at the offset cap", async () => {
    mock(envelope());
    expect((await read({limit: 1, offset: 100000})).data).toMatchObject({_sparql: {next_offset: null, continuation_limit_reached: true}});
  });
  it("does not equate an empty page with absent biological evidence", async () => {
    mock(envelope([]));
    expect((await read()).data).toMatchObject({_sparql: {returned_rows: 0, complete: false, next_offset: null}});
  });
  it.each([{pathway_id: "WP554\" } UNION { ?s ?p ?o"}, {pathway_id: "WP554_r123"}, {pathway_id: "WP0"}, {limit: 101}, {limit: "10"}, {offset: -1}, {query: "DELETE WHERE {?s ?p ?o}"}, {endpoint: "https://elsewhere.test"}])("rejects invalid selection before fetch %j", async params => {
    mock({});
    await expect(read(params)).rejects.toMatchObject({status: 400});
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    {errors: [{message: "failed"}]},
    {boolean: true},
    {head: {vars: []}, results: {bindings: []}},
    envelope([{...row, pathway_id: literal("WP999")}]),
    envelope([{...row, interaction: undefined}]),
    envelope([{...row, value: {type: "literal", value: 1}}]),
    envelope([{...row, value: {...literal("x"), datatype: 1}}]),
    envelope([{...row, invented: literal("unexpected")}]),
  ])("rejects malformed or cross-pathway result %#", async data => {
    mock(data);
    await expect(read()).rejects.toMatchObject({status: 502});
  });
  it("rejects a response beyond the requested row bound", async () => {
    mock(envelope([row, row]));
    await expect(read({limit: 1})).rejects.toThrow("oversized SPARQL page");
  });
  it("rejects an oversized body", async () => {
    mock({padding: "x".repeat(4 * 1024 * 1024)});
    await expect(read()).rejects.toThrow("exceeds 4 MiB");
  });
  it("rejects HTML/error responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>unavailable</html>")));
    await expect(read()).rejects.toThrow("invalid JSON");
  });
  it("retains bounded native HTTP evidence with status and source", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>down</html>", {status: 503})));
    await expect(read()).rejects.toMatchObject({status: 503, message: "WikiPathways upstream HTTP 503",
      data: {http_status: 503, body_text: "<html>down</html>", body_complete: true, source_url: expect.stringContaining("https://sparql.wikipathways.org/sparql?query="), text_sha256: expect.stringMatching(/^[0-9a-f]{64}$/)}});
  });
  it.each([{method: "POST", path}, {method: "GET", path, body: {}}, {method: "GET", path: "/sparql/unknown"}])("rejects unsupported operation %#", async request => {
    mock({});
    await expect(api(request)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not route static JSON to the SPARQL host", async () => {
    mock({pathways: "123"});
    expect((await api({method: "GET", path: "/json/getCounts.json"})).data).toEqual({pathways: "123"});
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe("https://www.wikipathways.org/json/getCounts.json");
  });
  it("preserves GPML text responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<Pathway/>")));
    expect((await api({method: "GET", path: "/wikipathways-assets/pathways/WP554/WP554.gpml"})).data).toBe("<Pathway/>");
  });
});
