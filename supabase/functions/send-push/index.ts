import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createPushSender } from "@sently/push";
import { WebPushTransport, WebPushError } from "@sently/webpush";

type NotificationWebhook = {
  type?: string;
  table?: string;
  schema?: string;
  record?: {
    id?: string;
    recipient_id?: string;
    kind?: string;
    title?: string;
    body?: string;
    related_order_id?: string | null;
  } | null;
};

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let payload: NotificationWebhook;

    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (
      payload.type !== "INSERT" ||
      payload.schema !== "public" ||
      payload.table !== "notifications" ||
      !payload.record?.id ||
      !payload.record?.recipient_id
    ) {
      return Response.json({ ignored: true });
    }

    const notification = payload.record;

    // Only send push notifications for order-status changes.
    if (notification.kind !== "order_status") {
      return Response.json({ ignored: true, reason: "Not an order-status notification" });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID environment variables are missing.");
      return Response.json({ error: "Push configuration is incomplete" }, { status: 500 });
    }

    const { data: subscriptions, error: queryError } =
      await ctx.supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", notification.recipient_id);

    if (queryError) {
      console.error("Could not load push subscriptions:", queryError.message);
      return Response.json({ error: "Could not load subscriptions" }, { status: 500 });
    }

    if (!subscriptions?.length) {
      return Response.json({ sent: 0, reason: "No registered devices" });
    }

    const sender = createPushSender({
      transport: new WebPushTransport({
        vapidPublicKey,
        vapidPrivateKey,
        subject: "mailto:momsperisasupport@gmail.com",
      }),
    });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    try {
      for (const subscription of subscriptions) {
        try {
          await sender.send({
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            title: notification.title || "Mom's Perisa",
            body: notification.body || "You have an order update.",
          });

          sent++;
        } catch (error) {
          failed++;

          if (error instanceof WebPushError && [404, 410].includes(error.statusCode)) {
            const { error: deleteError } = await ctx.supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);

            if (deleteError) {
              console.error("Could not remove expired subscription:", deleteError.message);
            } else {
              removed++;
            }
          } else {
            console.error("Push delivery failed:", error);
          }
        }
      }
    } finally {
      await sender.close();
    }

    return Response.json({ sent, failed, expiredSubscriptionsRemoved: removed });
  }),
};
