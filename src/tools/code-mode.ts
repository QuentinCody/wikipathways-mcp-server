/**
 * WikiPathways Code Mode — registers search + execute tools for full API access.
 *
 * search: In-process catalog query, returns matching endpoints with docs.
 * execute: V8 isolate with api.get/api.post + searchSpec/listCategories.
 */

import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { wikipathwaysCatalog } from "../spec/catalog";
import { createWikipathwaysApiFetch } from "../lib/api-adapter";
import { wikipathwaysResponse } from "../lib/tool-result";

interface CodeModeEnv {
    WIKIPATHWAYS_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
}

/**
 * Register wikipathways_search and wikipathways_execute tools.
 */
export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
): void {
    const apiFetch = createWikipathwaysApiFetch();
    const registrar = {tool: (...args: unknown[]) => {
        const [name, ...rest] = args;
        const register = server.tool.bind(server) as (...values: unknown[]) => void;
        const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof wikipathwaysResponse>;
        const respond = (input: unknown, extra: unknown) => wikipathwaysResponse(() => handler(input, extra), env, String(name), extra, input);
        register(name, ...rest, respond);
        register(`mcp_${String(name)}`, ...rest, respond);
    }};

    // Register the search tool (in-process, no isolate)
    const searchTool = createSearchTool({
        prefix: "wikipathways",
        catalog: wikipathwaysCatalog,
    });
    searchTool.register(registrar);

    // Register the execute tool (V8 isolate via DynamicWorkerExecutor)
    const executeTool = createExecuteTool({
        prefix: "wikipathways",
        // Verifiable provenance: wikipathways_execute results carry a _meta.citation.
        source: { id: "wikipathways", name: "WikiPathways", url: "https://www.wikipathways.org", license: "CC0 1.0" },
        catalog: wikipathwaysCatalog,
        apiFetch,
        preserveApiErrors: true,
        stagingThreshold: 30 * 1024,
        maxInlineBytes: 30 * 1024,
        timeout: 90_000,
        doNamespace: env.WIKIPATHWAYS_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(registrar);
}
