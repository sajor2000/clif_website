const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CLIF Consortium <noreply@clif-icu.com>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.message || `Resend API error: ${res.status}` };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export function buildNewUserNotificationEmail(
  userName: string,
  userEmail: string,
  institution: string,
  adminUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #8B1538; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #8B1538; font-size: 20px; margin: 0;">CLIF Consortium</h1>
  </div>

  <p>A new user has signed up and is awaiting approval:</p>

  <table style="margin: 16px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600; color: #666;">Name</td><td style="padding: 6px 0;">${userName}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600; color: #666;">Email</td><td style="padding: 6px 0;">${userEmail}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600; color: #666;">Institution</td><td style="padding: 6px 0;">${institution}</td></tr>
  </table>

  <div style="margin: 28px 0;">
    <a href="${adminUrl}" style="background-color: #8B1538; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Review in Admin Panel
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    CLIF Consortium &middot; Common Longitudinal ICU Data Format
  </div>
</body>
</html>`.trim();
}

export function buildSiteReviewEmail(
  userName: string,
  siteName: string,
  siteUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #8B1538; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #8B1538; font-size: 20px; margin: 0;">CLIF Consortium</h1>
  </div>

  <p>Hi ${userName},</p>

  <p>You have been assigned to review and update the site details for <strong>${siteName}</strong> in the CLIF Consortium portal.</p>

  <p>Please review the following information and fill in any missing fields:</p>
  <ul>
    <li>Hospital type and number of hospitals</li>
    <li>Data source and date ranges</li>
    <li>ICU beds and data availability (ER, ICU, Ward)</li>
    <li>IRB information (name, number, approval date, type)</li>
    <li>CLIF ready date</li>
    <li>Cohort inclusion criteria</li>
    <li>Death datetime source</li>
    <li>Notes availability</li>
  </ul>

  <div style="margin: 28px 0;">
    <a href="${siteUrl}" style="background-color: #8B1538; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Review Site Details
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">If you have questions, please reach out to your consortium admin.</p>

  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    CLIF Consortium &middot; Common Longitudinal ICU Data Format
  </div>
</body>
</html>`.trim();
}
