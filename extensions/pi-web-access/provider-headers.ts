import type { complete } from "@earendil-works/pi-ai/compat";

// Keep Pi's nullable removal markers intact when delegating to its own client.
export type CompletionHeaders = NonNullable<Parameters<typeof complete>[2]>["headers"];

/** Direct fetch callers must not serialize Pi's null markers as literal headers. */
export function httpProviderHeaders(
  headers: Readonly<Record<string, string | null>> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}
