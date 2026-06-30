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

function formatDeadline(deadline: string): string {
  // deadline is stored as a date string (e.g. "2026-06-26"); render it readably in UTC
  const d = new Date(deadline.length <= 10 ? deadline + 'T12:00:00Z' : deadline);
  if (isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildProposalNotificationEmail(
  title: string,
  description: string | null,
  deadline: string,
  votingUrl: string,
): string {
  const descBlock = description
    ? `<p style="white-space: pre-line; color: #444;">${escapeHtml(description)}</p>`
    : '';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #8B1538; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #8B1538; font-size: 20px; margin: 0;">CLIF Consortium</h1>
  </div>

  <p>A new proposal is open and awaiting your vote:</p>

  <h2 style="font-size: 18px; color: #111; margin: 16px 0 8px;">${escapeHtml(title)}</h2>
  ${descBlock}

  <p style="margin: 16px 0;"><strong>Voting deadline:</strong> ${formatDeadline(deadline)}</p>

  <div style="margin: 28px 0;">
    <a href="${votingUrl}" style="background-color: #8B1538; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Review &amp; Vote
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">Please cast your vote before the deadline. If you have questions, reach out to <a href="mailto:clif_consortium@uchicago.edu">clif_consortium@uchicago.edu</a>.</p>

  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    CLIF Consortium &middot; Common Longitudinal ICU Data Format
  </div>
</body>
</html>`.trim();
}

export function buildProjectRunNotificationEmail(
  title: string,
  description: string | null,
  instructions: string | null,
  deadline: string | null,
  projectUrl: string,
): string {
  const descBlock = description
    ? `<p style="white-space: pre-line; color: #444;">${escapeHtml(description)}</p>`
    : '';
  const instrBlock = instructions
    ? `<div style="border-left: 4px solid #8B1538; background: #faf5f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
         <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #8B1538;">Instructions to run</p>
         <p style="margin: 0; white-space: pre-line; color: #444;">${escapeHtml(instructions)}</p>
       </div>`
    : '';
  const deadlineBlock = deadline
    ? `<p style="margin: 16px 0;"><strong>Deadline to upload results to Box:</strong> ${formatDeadline(deadline)}</p>`
    : '';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #8B1538; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #8B1538; font-size: 20px; margin: 0;">CLIF Consortium</h1>
  </div>

  <p>A new project run is ready for sites to run:</p>

  <h2 style="font-size: 18px; color: #111; margin: 16px 0 8px;">${escapeHtml(title)}</h2>
  ${descBlock}
  ${instrBlock}
  ${deadlineBlock}

  <div style="margin: 28px 0;">
    <a href="${projectUrl}" style="background-color: #8B1538; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      View Project Run
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">When your site has run it, check it off on the Project Run Tracker. Questions? Reach out to <a href="mailto:clif_consortium@uchicago.edu">clif_consortium@uchicago.edu</a>.</p>

  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    CLIF Consortium &middot; Common Longitudinal ICU Data Format
  </div>
</body>
</html>`.trim();
}

export function buildProposalReminderEmail(
  title: string,
  deadline: string,
  votingUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #8B1538; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #8B1538; font-size: 20px; margin: 0;">CLIF Consortium</h1>
  </div>

  <p><strong>Reminder:</strong> a proposal is still awaiting your vote and the deadline is approaching.</p>

  <h2 style="font-size: 18px; color: #111; margin: 16px 0 8px;">${escapeHtml(title)}</h2>

  <p style="margin: 16px 0;"><strong>Voting deadline:</strong> ${formatDeadline(deadline)}</p>

  <div style="margin: 28px 0;">
    <a href="${votingUrl}" style="background-color: #8B1538; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Cast Your Vote
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">You are receiving this because you have not yet voted on this proposal.</p>

  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    CLIF Consortium &middot; Common Longitudinal ICU Data Format
  </div>
</body>
</html>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
    <li>Cohort inclusion criteria</li>
    <li>Death datetime source</li>
    <li>Notes availability</li>
  </ul>

  <p><strong>How to edit:</strong></p>
  <ol>
    <li>Click the button below to go to <strong>Site Details</strong></li>
    <li>Switch to <strong>Table</strong> view using the toggle at the top right</li>
    <li>Find your site row and click the <strong>Edit</strong> button in the last column</li>
    <li>Fill in the fields and click <strong>Save Changes</strong></li>
  </ol>

  <div style="margin: 28px 0;">
    <a href="${siteUrl}" style="background-color: #8B1538; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Go to Site Details
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">If you have questions, please reach out to <a href="mailto:clif_consortium@uchicago.edu">clif_consortium@uchicago.edu</a>.</p>

  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    CLIF Consortium &middot; Common Longitudinal ICU Data Format
  </div>
</body>
</html>`.trim();
}
