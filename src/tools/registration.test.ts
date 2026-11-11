import { afterEach, expect, it, vi } from "vitest";
import { McpServer } from "@bio-mcp/shared/mcp";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { registerCodeMode } from "./code-mode";
import { registerQueryData } from "./query-data";
import { registerGetSchema } from "./get-schema";
import { wikipathwaysCatalog } from "../spec/catalog";
import { sparqlWorkflows } from "../spec/sparql";
import { pathwayQuery } from "../lib/sparql-query";
import { createWikipathwaysApiFetch } from "../lib/api-adapter";
const json = (data: unknown) => new Response(JSON.stringify(data), {headers: {"content-type": "application/json"}});
afterEach(() => vi.unstubAllGlobals());
it("exposes dual aliases, discoverable RDF recipes and both-field errors", async () => {
  const server = new McpServer({name: "fixture", version: "1"});
  registerCodeMode(server, {CODE_MODE_LOADER: {get: () => ({})}} as unknown as Parameters<typeof registerCodeMode>[1]);
  registerQueryData(server, {}); registerGetSchema(server, {});
  const tools = (server as unknown as {_registeredTools: Record<string, {handler: (args: unknown, extra: unknown) => Promise<unknown>}>})._registeredTools;
  for (const suffix of ["search", "execute", "query_data", "get_schema"]) {
    expect(tools[`wikipathways_${suffix}`]).toBeDefined(); expect(tools[`mcp_wikipathways_${suffix}`]).toBeDefined();
  }
  expect(await tools.wikipathways_search.handler({query: sparqlWorkflows[0].title, category: "workflows", max_results: 5}, {})).toMatchObject({content: expect.any(Array), structuredContent: {success: true}});
  expect(await tools.mcp_wikipathways_query_data.handler({data_access_id: "wikipathways_fixture", sql: "SELECT 1"}, {})).toMatchObject({isError: true, content: expect.any(Array), structuredContent: expect.any(Object)});
});
it("stages complete RDF terms and query/paging metadata above 30 KiB", async () => {
  const raw = {head: {vars: pathwayQuery("/sparql/datasets", {}).variables}, results: {bindings: [{dataset: {type: "uri", value: "https://example.org/dataset"}, title: {type: "literal", value: "α".repeat(17000), "xml:lang": "el"}}]}};
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(raw)));
  const stored: unknown[] = [];
  const namespace = {idFromName: (name: string) => name, get: () => ({fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      stored.push((await request.json() as {data: unknown}).data);
      return json({success: true, tables_created: ["bindings"], total_rows: 1, input_rows: 1, table_row_counts: {bindings: 1}});
    }
    return json({success: true, schema: {tables: {bindings: {columns: [{name: "dataset"}]}}}});
  }})} as unknown as DurableObjectNamespace;
  const proxy = createApiProxyTool({apiFetch: createWikipathwaysApiFetch(), catalog: wikipathwaysCatalog, doNamespace: namespace, stagingPrefix: "wikipathways", maxInlineBytes: 30 * 1024});
  expect(await proxy.handler({method: "GET", path: "/sparql/datasets"}, {sql: () => []})).toMatchObject({__staged: true, data_access_id: expect.any(String)});
  expect(JSON.parse(stored[0] as string)).toMatchObject({...raw, _sparql: {complete: false, limit: 25, snapshot_version: null}});
  expect(stored[1]).toMatchObject(raw);
});
it.each([{__api_error: true}, {__stage_error: true}, {__staged: true, data_access_id: "rdf"}])("preserves first-operation handles %#", async handle => {
  for (const recipe of sparqlWorkflows) {
    const api = {get: vi.fn().mockResolvedValue(handle)};
    expect(await new Function("api", `return (async () => {${recipe.code}})()`)(api)).toEqual(handle);
    expect(api.get).toHaveBeenCalledTimes(1);
  }
});
it("retains mapping stage handles alongside dataset context", async () => {
  const metadata = {results: {bindings: []}};
  const handle = {__staged: true, data_access_id: "mapping"};
  const api = {get: vi.fn().mockResolvedValueOnce(metadata).mockResolvedValueOnce(handle)};
  expect(await new Function("api", `return (async () => {${sparqlWorkflows[0].code}})()`)(api)).toEqual({metadata, mappings: handle, complete: false});
});
it.each([{__api_error: true}, {__stage_error: true}])("static recipes preserve upstream failure %#", async handle => {
  for (const recipe of wikipathwaysCatalog.workflows!.slice(sparqlWorkflows.length)) {
    const api = {get: vi.fn().mockResolvedValue(handle), query: vi.fn()};
    expect(await new Function("api", `return (async () => {${recipe.code}})()`)(api)).toEqual(handle);
    expect(api.query).not.toHaveBeenCalled();
  }
});
