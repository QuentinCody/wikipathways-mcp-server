/**
 * WikiPathways HTTP client with rate limit handling.
 *
 * WikiPathways web service is open access (CC0 license), no auth required.
 * All endpoints require ?format=json for JSON responses.
 */

import { restFetch, type RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const WIKIPATHWAYS_BASE = "https://webservice.wikipathways.org";

export interface WikipathwaysFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    /** Override base URL */
    baseUrl?: string;
}

/**
 * Fetch from the WikiPathways web service API.
 * Automatically appends format=json to query parameters.
 */
export async function wikipathwaysFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: WikipathwaysFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? WIKIPATHWAYS_BASE;
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(opts?.headers ?? {}),
    };

    // Ensure format=json is always included
    const mergedParams: Record<string, unknown> = {
        ...params,
        format: "json",
    };

    return restFetch(baseUrl, path, mergedParams, {
        ...opts,
        headers,
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 3,
        timeout: opts?.timeout ?? 30_000,
        userAgent:
            "wikipathways-mcp-server/1.0 (bio-mcp; https://github.com/QuentinCody/wikipathways-mcp-server)",
    });
}
