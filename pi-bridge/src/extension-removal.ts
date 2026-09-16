type JsonObject = Record<string, unknown>;

/** Deletion and runtime reload are distinct outcomes. Never turn a successful
 * disk deletion into an opaque exception because the subsequent reload failed.
 * This does not claim that deferred code was hot-unloaded from a busy session.
 */
export async function finishExtensionRemoval(
  removed: boolean,
  reloadRuntime: () => Promise<JsonObject>,
): Promise<JsonObject> {
  if (!removed) return {
    removed: false,
    removed_from_disk: false,
    reload_status: "not_found",
    reload_required: false,
    effective_on_next_turn: false,
  };
  let reload: JsonObject;
  try {
    reload = await reloadRuntime();
  } catch (error) {
    reload = { succeeded: false, error: error instanceof Error ? error.message : String(error) };
  }
  const sessions = Array.isArray(reload.sessions) ? reload.sessions : [];
  const scheduled = sessions.some(session => session && typeof session === "object" && session.scheduled === true);
  const aether = reload.aether_reload && typeof reload.aether_reload === "object"
    ? reload.aether_reload as JsonObject : undefined;
  const failed = reload.succeeded !== true;
  const partial = !failed && aether?.reloaded === false && Array.isArray(aether.errors) && aether.errors.length > 0;
  return {
    removed: true,
    removed_from_disk: true,
    reload_status: failed ? "failed" : partial ? "partial" : scheduled ? "deferred" : "applied",
    reload_required: failed || partial,
    effective_on_next_turn: scheduled,
    reload,
  };
}
