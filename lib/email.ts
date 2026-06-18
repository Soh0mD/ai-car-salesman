/**
 * Minimal Resend email sender (Wave 4 alerts). Uses the REST API directly — no SDK dependency.
 * No-ops (returns false) when RESEND_API_KEY / ALERT_FROM_EMAIL aren't configured.
 */

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.ALERT_FROM_EMAIL;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  if (!apiKey || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
