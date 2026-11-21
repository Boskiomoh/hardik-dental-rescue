// Called when the patient comes back from Stripe Checkout.
// POST { session_id } -> { status: "paid" | "unpaid" }
// Asks Stripe for the session; the browser's word is never trusted.
import { corsHeaders, isAllowedOrigin, json, markPaidIfStripeSaysSo, stripe } from "../_shared/deposit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!isAllowedOrigin(req)) return json(req, { error: "Origin not allowed" }, 403);

  const { session_id: sessionId } = await req.json().catch(() => ({}));
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return json(req, { error: "A valid session_id is required." }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = await markPaidIfStripeSaysSo(session);
    return json(req, { status: paid ? "paid" : "unpaid" });
  } catch {
    return json(req, { error: "Couldn't check the payment with Stripe." }, 502);
  }
});
