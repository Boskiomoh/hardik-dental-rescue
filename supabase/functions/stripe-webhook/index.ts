// Stripe webhook: marks deposits paid even if the patient closes the tab
// before returning to the site. Register it in Stripe for the
// checkout.session.completed event and set STRIPE_WEBHOOK_SECRET.
import { markPaidIfStripeSaysSo, stripe } from "../_shared/deposit.ts";

const cryptoProvider = (await import("npm:stripe@17.7.0")).default.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret, undefined, cryptoProvider);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await markPaidIfStripeSaysSo(event.data.object);
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
