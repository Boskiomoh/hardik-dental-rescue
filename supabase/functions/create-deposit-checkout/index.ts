// Creates a Stripe Checkout session for a booking's deposit.
// POST { appointment_id } -> { url }
import { adminDb, corsHeaders, isAllowedOrigin, json, stripe } from "../_shared/deposit.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  // Success/cancel URLs are built from the origin, so only known sites may call this
  if (!isAllowedOrigin(req)) return json(req, { error: "Origin not allowed" }, 403);

  const { appointment_id: appointmentId } = await req.json().catch(() => ({}));
  if (typeof appointmentId !== "string" || !UUID.test(appointmentId)) {
    return json(req, { error: "A valid appointment_id is required." }, 400);
  }

  const db = adminDb();
  const { data: appointment, error } = await db
    .from("appointments")
    .select("id, appointment_date, appointment_time, service_type, doctor, deposit_status, deposit_amount_cents, patients(email)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) return json(req, { error: "Couldn't load the appointment." }, 500);
  if (!appointment) return json(req, { error: "Appointment not found." }, 404);
  if (appointment.deposit_status === "paid") return json(req, { error: "This deposit is already paid." }, 409);
  if (appointment.deposit_status !== "pending" || !appointment.deposit_amount_cents) {
    return json(req, { error: "This appointment doesn't need a deposit." }, 409);
  }

  const origin = req.headers.get("origin")!;
  const patientEmail = (appointment.patients as { email?: string } | null)?.email;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: appointment.deposit_amount_cents,
        product_data: {
          name: `Booking deposit: ${appointment.service_type}`,
          description: `${appointment.doctor}, ${appointment.appointment_date} at ${appointment.appointment_time.slice(0, 5)}`,
        },
      },
    }],
    customer_email: patientEmail || undefined,
    metadata: { appointment_id: appointment.id },
    success_url: `${origin}/booking?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/booking?deposit=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  const { error: saveError } = await db
    .from("appointments")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", appointment.id);
  if (saveError) return json(req, { error: "Couldn't start the payment." }, 500);

  return json(req, { url: session.url });
});
