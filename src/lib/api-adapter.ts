/**
 * WikiPathways API adapter — wraps wikipathwaysFetch into the ApiFetchFn
 * interface for use by the Code Mode __api_proxy tool.
 *
 * All WikiPathways endpoints are GET-only static files (no query params).
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
import { wikipathwaysFetch } from "./http";

/**
 * Create an ApiFetchFn that routes through the WikiPathways JSON API.
 * No auth needed — WikiPathways is fully open (CC0 license).
 */
export function createWikipathwaysApiFetch(): ApiFetchFn {
    return async (request) => {
        const path = request.path;
        const params = request.params as Record<string, unknown> | undefined;

        const response = await wikipathwaysFetch(path, params);

        if (!response.ok) {
            let errorBody: string;
            try {
                errorBody = await response.text();
            } catch {
                errorBody = response.statusText;
            }
            const error = new Error(
                `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
            ) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            const text = await response.text();
            return { status: response.status, data: text };
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
