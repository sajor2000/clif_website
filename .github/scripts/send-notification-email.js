/**
 * Send email notifications for CLIF Data Dictionary updates
 * Uses Resend API (https://resend.com)
 *
 * Required environment variables:
 * - RESEND_API_KEY: Your Resend API key
 * - SUBSCRIBERS: JSON array of email addresses (stored as GitHub secret)
 * - COMMIT_MESSAGE: The full commit message (subject + body)
 * - COMMIT_DATE: The commit date
 */

const WEBSITE_URL = 'https://clif-icu.com';
const FROM_EMAIL = 'CLIF Consortium <updates@clifconsortium.org>';

async function sendEmail(to, subject, htmlContent) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: subject,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send to ${to}: ${error}`);
  }

  return response.json();
}

function formatCommitMessage(message) {
  // Escape HTML first
  let formatted = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert markdown-style formatting to HTML
  // **bold** → <strong>bold</strong>
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // ### Header → styled header
  formatted = formatted.replace(/^### (.+)$/gm, '<strong style="font-size: 1.1em; color: #722F37;">$1</strong>');

  // ## Header → larger styled header
  formatted = formatted.replace(/^## (.+)$/gm, '<strong style="font-size: 1.2em; color: #722F37;">$1</strong>');

  // `code` → highlighted code style
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">$1</code>');

  // Convert markdown links [text](url) to clickable links
  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color: #722F37;">$1</a>');

  // Convert remaining plain URLs to clickable links
  formatted = formatted.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #722F37;">$1</a>');

  // Convert bullet points: - at start of line → bullet
  formatted = formatted.replace(/^- /gm, '• ');

  // Convert newlines to HTML breaks
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

function getEmailContent(commitMessage, commitDate) {
  const formattedMessage = formatCommitMessage(commitMessage);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CLIF Update Notification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <!-- Header -->
  <div style="background-color: #722F37; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="${WEBSITE_URL}/images/logos/clif_logo_white_email.png" alt="CLIF Consortium" style="max-width: 200px; height: auto;">
    <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 14px;">Common Longitudinal ICU data Format</p>
  </div>

  <!-- Main Content -->
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">

    <p>Hello,</p>

    <p>The CLIF Data Dictionary and mCIDE have been updated on <strong>${commitDate}</strong>.</p>

    <div style="background-color: #fff; padding: 15px; border-left: 4px solid #722F37; margin: 20px 0;">
      <strong>What Changed:</strong><br><br>
      ${formattedMessage}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${WEBSITE_URL}/data-dictionary/change-log"
         style="background-color: #722F37; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        View Change Log
      </a>
    </div>

    <p style="margin-top: 30px;">Quick Links:</p>
    <ul>
      <li><a href="${WEBSITE_URL}/data-dictionary/data-dictionary-2.1.0" style="color: #722F37;">Data Dictionary 2.1.0 (Current Implementation)</a></li>
      <li><a href="https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/tree/main/mCIDE" style="color: #722F37;">mCIDE</a></li>
      <li><a href="${WEBSITE_URL}/data-dictionary/change-log" style="color: #722F37;">Change Log</a></li>
    </ul>

  </div>

  <!-- Footer -->
  <div style="background-color: #333; color: #999; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
    <p style="margin: 0 0 10px 0;">
      You're receiving this because you subscribed to CLIF Consortium updates.
    </p>
    <p style="margin: 0;">
      To unsubscribe, please reply to this email with "UNSUBSCRIBE" in the subject line.
    </p>
    <p style="margin: 10px 0 0 0; color: #666;">
      CLIF Consortium | <a href="${WEBSITE_URL}" style="color: #999;">clif-icu.com</a>
    </p>
  </div>

</body>
</html>
  `;
}

async function main() {
  const { RESEND_API_KEY, SUBSCRIBERS, COMMIT_MESSAGE, COMMIT_DATE } =
    process.env;

  // Validate required env vars
  if (!RESEND_API_KEY) {
    console.error('Error: RESEND_API_KEY is required');
    process.exit(1);
  }

  if (!SUBSCRIBERS) {
    console.error('Error: SUBSCRIBERS is required');
    process.exit(1);
  }

  // Parse recipients
  let recipients = [];
  try {
    recipients = JSON.parse(SUBSCRIBERS);
  } catch (e) {
    console.error('Error: SUBSCRIBERS must be a valid JSON array');
    process.exit(1);
  }

  if (recipients.length === 0) {
    console.log('No recipients found. Skipping email send.');
    return;
  }

  // Generate email content
  const subject = 'CLIF Data Dictionary and mCIDE Have Been Updated';
  const htmlContent = getEmailContent(
    COMMIT_MESSAGE || 'Documentation updated',
    COMMIT_DATE || new Date().toLocaleDateString()
  );

  console.log(`Sending "${subject}" to ${recipients.length} recipient(s)...`);

  // Send emails (with delay to respect Resend rate limit)
  let successCount = 0;
  let failCount = 0;

  for (const email of recipients) {
    try {
      await sendEmail(email, subject, htmlContent);
      console.log(`  Sent to: ${email}`);
      successCount++;

      // Delay between emails to respect Resend rate limit (2 requests/second)
      await new Promise((resolve) => setTimeout(resolve, 550));
    } catch (error) {
      console.error(`  Failed: ${email} - ${error.message}`);
      failCount++;
    }
  }

  console.log(`\nComplete: ${successCount} sent, ${failCount} failed`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
