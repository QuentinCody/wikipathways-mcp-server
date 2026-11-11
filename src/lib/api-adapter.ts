/**
 * WikiPathways API adapter — wraps wikipathwaysFetch into the ApiFetchFn
 * interface for use by the Code Mode __api_proxy tool.
 *
 * Static JSON/assets are GET-only files; /sparql/ helpers use bounded SELECT queries.
 *
 * The catalog uses paths like:
 *   /json/findPathwaysByText.json
 *   /json/getPathwayInfo.json
 *   /json/listOrganisms.json
 *   /wikipathways-assets/pathways/{pwId}/{pwId}.json
 *
 * The adapter passes them directly to the WikiPathways base URL. Non-JSON
 * responses (.gpml, .svg) are returned as text.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { sparqlRead } from "./sparql";
import { nativeError } from "./native-error";
import { wikipathwaysFetch } from "./http";

/**
 * Create an ApiFetchFn that routes through the WikiPathways JSON API.
 * No auth needed — WikiPathways is fully open (CC0 license).
 */
export function createWikipathwaysApiFetch(): ApiFetchFn {
    return async (request) => {
        if (request.path.startsWith("/sparql/")) return sparqlRead(request);
        const path = request.path;
        const params = request.params as Record<string, unknown> | undefined;

        const response = await wikipathwaysFetch(path, params);

        if (!response.ok) throw await nativeError(response, response.url || `https://www.wikipathways.org${path}`);

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            const text = await response.text();
            return { status: response.status, data: text };
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
