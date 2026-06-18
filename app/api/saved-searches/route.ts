import { NextRequest } from "next/server";
import {
  addSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  savedSearchesEnabled,
} from "@/lib/saved-searches";
import type { WizardProfile } from "@/lib/types";

export const runtime = "nodejs";

const NOT_CONFIGURED = "Saved searches need server storage (Upstash) configured.";

/** List a user's saved searches. */
export async function GET(req: NextRequest) {
  if (!savedSearchesEnabled()) return new Response(NOT_CONFIGURED, { status: 503 });
  const anonId = new URL(req.url).searchParams.get("anonId");
  if (!anonId) return new Response("anonId required", { status: 400 });
  return Response.json({ searches: await listSavedSearches(anonId) });
}

/** Save a search (optionally with an email for new-match alerts). */
export async function POST(req: NextRequest) {
  if (!savedSearchesEnabled()) return new Response(NOT_CONFIGURED, { status: 503 });
  let body: { anonId?: string; profile?: WizardProfile; email?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body.anonId || !body.profile?.zip_code) {
    return new Response("anonId and profile required", { status: 400 });
  }
  const saved = await addSavedSearch(body.anonId, body.profile, body.email);
  return Response.json({ saved });
}

/** Delete a saved search. */
export async function DELETE(req: NextRequest) {
  if (!savedSearchesEnabled()) return new Response(NOT_CONFIGURED, { status: 503 });
  const { searchParams } = new URL(req.url);
  const anonId = searchParams.get("anonId");
  const id = searchParams.get("id");
  if (!anonId || !id) return new Response("anonId and id required", { status: 400 });
  await deleteSavedSearch(anonId, id);
  return Response.json({ ok: true });
}
