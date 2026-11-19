import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const APP_URL = Deno.env.get("APP_URL");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL");

const ALLOWED_EVENTS = ["report_published"];

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_API_KEY || !WEBHOOK_SECRET || !APP_URL || !FROM_EMAIL) {
    console.error("Missing configuration");
    return json({ error: "Not configured" }, 500);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const id = body?.record?.id;
    if (typeof id !== "string") return json({ error: "Bad request" }, 400);

    // Claim the row so a retry cannot send the same email twice.
    const { data: claimed, error: claimError } = await supabase
      .from("notifications_outbox")
      .update({ is_sent: true })
      .eq("id", id)
      .or("is_sent.is.null,is_sent.eq.false")
      .select("id, user_id, journey_id, event_type")
      .maybeSingle();

    if (claimError) {
      console.error("Claim failed", claimError);
      return json({ error: "Server error" }, 500);
    }
    if (!claimed) return json({ skipped: true }, 200);

    const release = async () => {
      await supabase.from("notifications_outbox").update({ is_sent: false }).eq("id", id);
    };

    if (!ALLOWED_EVENTS.includes(claimed.event_type)) {
      await release();
      return json({ skipped: true, reason: "event not handled" }, 200);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", claimed.user_id)
      .maybeSingle();

    if (profileError || !profile?.email) {
      console.error("Recipient not found", profileError);
      await release();
      return json({ error: "Recipient not found" }, 400);
    }

    const link = `${APP_URL.replace(/\/$/, "")}/home`;
    const subject = "Your Pathray Report is ready";
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2>Your Pathray Report is ready</h2>
        <p>Your funding-first assessment report is ready to read in your Pathray account.</p>
        <p>
          <a href="${link}"
             style="display: inline-block; padding: 12px 20px; background: #1B2F5E; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
            View your report
          </a>
        </p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [profile.email], subject, html }),
    });

    if (!resendRes.ok) {
      console.error("Resend failed", resendRes.status, await resendRes.text());
      await release();
      return json({ error: "Email provider failed" }, 502);
    }

    return json({ delivered: true }, 200);
  } catch (err) {
    console.error("Unexpected error", err);
    return json({ error: "Server error" }, 500);
  }
});