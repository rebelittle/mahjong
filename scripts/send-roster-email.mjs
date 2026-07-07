// Sends the signup roster for upcoming sessions to the instructor.
//
// Run hourly by .github/workflows/session-email.yml. Each run looks for open
// sessions starting 4–7 hours from now (wide window so a delayed or skipped
// cron run still catches the session; on-time runs fire ~6 hours before) and
// emails the full list of names + emails, one email per session. The
// session_email_log table guarantees each session is emailed exactly once.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — Supabase (service role bypasses RLS)
//   GMAIL_USER, GMAIL_APP_PASSWORD           — Gmail account that sends the email
//   RECIPIENT                                — override recipient (optional)
//   TEST_MODE=true                           — email the roster for the next
//     upcoming session regardless of timing, and skip the sent log. For
//     manual end-to-end tests via workflow_dispatch.

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
const RECIPIENT = process.env.RECIPIENT || "mlittle@foxhill-school.com";
const TEST_MODE = process.env.TEST_MODE === "true";

// Per the user's request, no emails for sessions before Tuesday July 14 2026.
const EARLIEST_SESSION = "2026-07-14T00:00:00-04:00";

const ZONE = "America/New_York";

const TITLES = {
  mommy: "Lesson for Beginners",
  beginner: "Lesson for Beginners",
  experienced: "Mommy Mahj!",
  openplay: "Open Play",
  crack_bam_create: "Crack, Bam, Create!",
};

const SEAT_ORDER = { east: 0, south: 1, west: 2, north: 3 };

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
  "select=id,type,starts_at,ends_at,notes," +
  "seats(table_number,seat_position,profiles(display_name,email))";

async function findSessions() {
  if (TEST_MODE) {
    // Next upcoming open session, whenever it is.
    const rows = await rest(
      `sessions?${SELECT}&status=eq.open` +
        `&starts_at=gte.${encodeURIComponent(new Date().toISOString())}` +
        `&order=starts_at&limit=1`
    );
    return rows;
  }

  const now = Date.now();
  const lo = new Date(now + 4 * 3600_000).toISOString();
  const hi = new Date(now + 7 * 3600_000).toISOString();
  const sessions = await rest(
    `sessions?${SELECT}&status=eq.open` +
      `&starts_at=gte.${encodeURIComponent(lo)}` +
      `&starts_at=lt.${encodeURIComponent(hi)}` +
      `&order=starts_at`
  );

  const eligible = sessions.filter(
    (s) => new Date(s.starts_at) >= new Date(EARLIEST_SESSION)
  );
  if (eligible.length === 0) return [];

  // Drop sessions already emailed.
  const ids = eligible.map((s) => s.id).join(",");
  const logged = await rest(
    `session_email_log?select=session_id&session_id=in.(${ids})`
  );
  const done = new Set(logged.map((r) => r.session_id));
  return eligible.filter((s) => !done.has(s.id));
}

function fmt(iso, opts) {
  return new Intl.DateTimeFormat("en-US", { timeZone: ZONE, ...opts }).format(
    new Date(iso)
  );
}

function buildEmail(session) {
  const title = TITLES[session.type] ?? session.type;
  const day = fmt(session.starts_at, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = `${fmt(session.starts_at, { hour: "numeric", minute: "2-digit" })} – ${fmt(session.ends_at, { hour: "numeric", minute: "2-digit" })}`;

  const players = (session.seats ?? [])
    .filter((seat) => seat.profiles)
    .sort(
      (a, b) =>
        a.table_number - b.table_number ||
        SEAT_ORDER[a.seat_position] - SEAT_ORDER[b.seat_position]
    );

  const subject = `${TEST_MODE ? "[TEST] " : ""}${title} roster — ${day}, ${time} (${players.length} signed up)`;

  const byTable = new Map();
  for (const seat of players) {
    if (!byTable.has(seat.table_number)) byTable.set(seat.table_number, []);
    byTable.get(seat.table_number).push(seat.profiles);
  }

  const textTables = [...byTable]
    .map(
      ([n, ps]) =>
        `Table ${n}:\n` +
        ps.map((p) => `  - ${p.display_name} (${p.email})`).join("\n")
    )
    .join("\n\n");

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const htmlTables = [...byTable]
    .map(
      ([n, ps]) =>
        `<h3 style="margin:16px 0 4px">Table ${n}</h3><ul style="margin:0">` +
        ps
          .map((p) => `<li>${esc(p.display_name)} — ${esc(p.email)}</li>`)
          .join("") +
        "</ul>"
    )
    .join("");

  const none = "No one has signed up yet.";
  const text =
    `${title}\n${day}, ${time}\n${players.length} signed up\n\n` +
    (players.length ? textTables : none) +
    (session.notes ? `\n\nSession notes: ${session.notes}` : "") +
    "\n\n— Sent automatically by the Fox Hill Mah Jongg site.";

  const html =
    `<div style="font-family:Georgia,serif;max-width:560px">` +
    `<h2 style="margin-bottom:0">${esc(title)}</h2>` +
    `<p style="margin-top:4px">${esc(day)}, ${esc(time)}<br><b>${players.length} signed up</b></p>` +
    (players.length ? htmlTables : `<p>${none}</p>`) +
    (session.notes ? `<p><i>Session notes: ${esc(session.notes)}</i></p>` : "") +
    `<p style="color:#888;font-size:12px;margin-top:24px">Sent automatically by the Fox Hill Mah Jongg site.</p>` +
    `</div>`;

  return { subject, text, html };
}

async function main() {
  const sessions = await findSessions();
  if (sessions.length === 0) {
    console.log("No sessions to email about this run.");
    return;
  }

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  for (const session of sessions) {
    const { subject, text, html } = buildEmail(session);
    await transport.sendMail({
      from: `"Fox Hill Mah Jongg" <${GMAIL_USER}>`,
      to: RECIPIENT,
      subject,
      text,
      html,
    });
    console.log(`Sent: ${subject} → ${RECIPIENT}`);

    if (!TEST_MODE) {
      await rest(`session_email_log?on_conflict=session_id`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ session_id: session.id, recipient: RECIPIENT }),
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
