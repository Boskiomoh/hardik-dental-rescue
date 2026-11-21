// Shared by the deposit Edge Functions.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

// Service-role client: Edge Functions get these two env vars automatically.
// Only used server-side, after checking with Stripe.
export const adminDb = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// Comma-separated list, e.g. "https://hardik-dental-after.vercel.app,http://localhost:8081"
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
};

export const isAllowedOrigin = (req: Request) => allowedOrigins.includes(req.headers.get("origin") ?? "");

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

// Marks an appointment's deposit as paid if Stripe says the session is paid.
// Used by both confirm-deposit (on return from Checkout) and stripe-webhook.
export const markPaidIfStripeSaysSo = async (session: Stripe.Checkout.Session) => {
  if (session.payment_status !== "paid") return false;
  const appointmentId = session.metadata?.appointment_id;
  if (!appointmentId) return false;

  const { error } = await adminDb()
    .from("appointments")
    .update({ deposit_status: "paid", deposit_paid_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("stripe_checkout_session_id", session.id);
  if (error) throw error;
  return true;
};
