/**
 * WikiPathways API adapter — wraps wikipathwaysFetch into the ApiFetchFn
 * interface for use by the Code Mode __api_proxy tool.
 *
 * All WikiPathways endpoints are GET-only. The adapter automatically
 * appends format=json to every request's query parameters.
 *
 * The catalog uses paths like:
 *   /findPathwaysByText
 *   /getPathwayInfo
 *   /listOrganisms
 *
 * The adapter passes them directly to the WikiPathways base URL.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { wikipathwaysFetch } from "./http";

/**
 * Create an ApiFetchFn that routes through WikiPathways web service.
 * No auth needed — WikiPathways APIs are fully open (CC0 license).
 */
export function createWikipathwaysApiFetch(): ApiFetchFn {
    return async (request) => {
        const path = request.path;

        // Merge any query params — format=json is auto-appended by wikipathwaysFetch
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
