// Sends a confirmation email to each guest when they sign up for a session.
//
// Run every 15 minutes by .github/workflows/signup-confirmation-email.yml.
// Each run looks for claimed seats on upcoming open sessions that haven't
// been confirmed yet and emails the guest directly. The signup_email_log
// table (keyed on session + guest) guarantees each guest is emailed exactly
// once per session, even if they switch seats within it.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — Supabase (service role bypasses RLS)
//   GMAIL_USER, GMAIL_APP_PASSWORD           — Gmail account that sends the email
//   RECIPIENT                                — redirect all emails here (optional)
//   TEST_MODE=true                           — confirm the most recently claimed
//     upcoming seat regardless of the sent log, skip logging, and (unless
//     RECIPIENT is set) send to GMAIL_USER instead of the guest. For manual
//     end-to-end tests via workflow_dispatch.

import nodemailer from "nodemailer";

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
};

const SUPABASE_URL = need("SUPABASE_URL").replace(/\/$/, "");
const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const GMAIL_USER = need("GMAIL_USER");
const GMAIL_APP_PASSWORD = need("GMAIL_APP_PASSWORD");
const TEST_MODE = process.env.TEST_MODE === "true";
const RECIPIENT = process.env.RECIPIENT || (TEST_MODE ? GMAIL_USER : "");

const ZONE = "America/New_York";

const TITLES = {
  mommy: "Lesson for Beginners",
  beginner: "Lesson for Beginners",
  experienced: "Mommy Mahj!",
  openplay: "Open Play",
  crack_bam_create: "Crack, Bam, Create!",
};

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

const SELECT =
  "select=session_id,profile_id,reserved_at," +
  "sessions!inner(type,starts_at,ends_at,status)," +
  "profiles!inner(display_name,email)";

async function findSignups() {
  const now = encodeURIComponent(new Date().toISOString());
  const base =
    `seats?${SELECT}&profile_id=not.is.null` +
    `&sessions.status=eq.open&sessions.starts_at=gte.${now}`;

  if (TEST_MODE) {
    // Most recently claimed upcoming seat, logged or not.
    return await rest(`${base}&order=reserved_at.desc.nullslast&limit=1`);
  }

  const signups = await rest(base);
  if (signups.length === 0) return [];

  // Drop signups already confirmed.
  const ids = [...new Set(signups.map((s) => s.session_id))].join(",");
  const logged = await rest(
    `signup_email_log?select=session_id,profile_id&session_id=in.(${ids})`
  );
  const done = new Set(logged.map((r) => `${r.session_id}:${r.profile_id}`));
  return signups.filter((s) => !done.has(`${s.session_id}:${s.profile_id}`));
}

function fmt(iso, opts) {
  return new Intl.DateTimeFormat("en-US", { timeZone: ZONE, ...opts }).format(
    new Date(iso)
  );
}

function buildEmail(signup) {
  const session = signup.sessions;
  const title = TITLES[session.type] ?? session.type;
  const day = fmt(session.starts_at, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = `${fmt(session.starts_at, { hour: "numeric", minute: "2-digit" })} – ${fmt(session.ends_at, { hour: "numeric", minute: "2-digit" })}`;

  const subject = `${TEST_MODE ? "[TEST] " : ""}You're signed up — ${title}, ${day}`;

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const text =
    `Thanks for signing up, see you on ${day}!\n\n` +
    `${title}\n${day}, ${time}\n\n` +
    "— Sent automatically by the Fox Hill Mah Jongg site.";

  const html =
    `<div style="font-family:Georgia,serif;max-width:560px">` +
    `<p style="font-size:16px">Thanks for signing up, see you on <b>${esc(day)}</b>!</p>` +
    `<p>${esc(title)}<br>${esc(day)}, ${esc(time)}</p>` +
    `<p style="color:#888;font-size:12px;margin-top:24px">Sent automatically by the Fox Hill Mah Jongg site.</p>` +
    `</div>`;

  return { subject, text, html };
}

async function main() {
  const signups = await findSignups();
  if (signups.length === 0) {
    console.log("No new signups to confirm this run.");
    return;
  }

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  for (const signup of signups) {
    const to = RECIPIENT || signup.profiles.email;
    const { subject, text, html } = buildEmail(signup);
    await transport.sendMail({
      from: `"Fox Hill Mah Jongg" <${GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`Sent: ${subject} → ${to}`);

    if (!TEST_MODE) {
      await rest(`signup_email_log?on_conflict=session_id,profile_id`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          session_id: signup.session_id,
          profile_id: signup.profile_id,
          recipient: to,
        }),
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
