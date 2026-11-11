import { sha256Hex } from "@bio-mcp/shared";

/** Retain bounded upstream error evidence under the caller's read deadline. */
export async function nativeError(response: Response, sourceUrl: string): Promise<Error & { status: number; data: unknown }> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  let complete = !reader;
  try {
    while (reader) {
      const { done, value } = await reader.read();
      if (done) { complete = true; text += decoder.decode(); break; }
      const available = 64 * 1024 - bytes;
      text += decoder.decode(value.subarray(0, available), { stream: true });
      bytes += value.byteLength;
      if (bytes > 64 * 1024) break;
    }
  } finally { void reader?.cancel().catch(() => {}); }
  return Object.assign(new Error(`WikiPathways upstream HTTP ${response.status}`), { status: response.status,
    data: { source_url: sourceUrl, http_status: response.status, body_text: text, body_complete: complete,
      text_sha256: await sha256Hex(text), hash_scope: complete ? "complete decoded error text" : "bounded decoded error prefix",
      observed_at: new Date().toISOString() } });
}
