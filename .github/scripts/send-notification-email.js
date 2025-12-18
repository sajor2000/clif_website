/**
 * Send email notifications for CLIF Data Dictionary updates
 * Uses Resend API (https://resend.com)
 *
 * Required environment variables:
 * - RESEND_API_KEY: Your Resend API key
 * - SUBSCRIBERS: JSON array of email addresses (stored as GitHub secret)
 * - UPDATE_TYPE: 'data-dictionary', 'changelog', or 'schema'
 * - CHANGED_FILES: List of changed files
 * - COMMIT_MESSAGE: The commit message
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

function getEmailSubject(updateType) {
  const subjects = {
    'data-dictionary': 'CLIF Data Dictionary Has Been Updated',
    changelog: 'CLIF Change Log Has Been Updated',
    schema: 'CLIF Schema Files Have Been Updated',
  };
  return subjects[updateType] || 'CLIF Documentation Has Been Updated';
}

function getEmailContent(updateType, changedFiles, commitMessage, commitDate) {
  const updateTypeLabels = {
    'data-dictionary': 'Data Dictionary',
    changelog: 'Change Log',
    schema: 'Schema Files',
  };

  const updateLabel = updateTypeLabels[updateType] || 'Documentation';

  // Format changed files as a list
  const filesList = changedFiles
    .split('\n')
    .filter((f) => f.trim())
    .map((f) => `<li><code>${f}</code></li>`)
    .join('\n');

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
    <h1 style="color: white; margin: 0; font-size: 24px;">CLIF Consortium</h1>
    <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 14px;">Common Longitudinal ICU data Format</p>
  </div>

  <!-- Main Content -->
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">

    <h2 style="color: #722F37; margin-top: 0;">${updateLabel} Update</h2>

    <p>Hello,</p>

    <p>The CLIF ${updateLabel} has been updated on <strong>${commitDate}</strong>.</p>

    <div style="background-color: #fff; padding: 15px; border-left: 4px solid #722F37; margin: 20px 0;">
      <strong>Update Summary:</strong><br>
      ${commitMessage}
    </div>

    ${
      filesList
        ? `
    <details style="margin: 20px 0;">
      <summary style="cursor: pointer; color: #722F37; font-weight: bold;">Files Changed</summary>
      <ul style="background-color: #fff; padding: 15px 15px 15px 35px; margin-top: 10px; border-radius: 4px;">
        ${filesList}
      </ul>
    </details>
    `
        : ''
    }

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${WEBSITE_URL}/data-dictionary/change-log"
         style="background-color: #722F37; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        View Change Log
      </a>
    </div>

    <p style="margin-top: 30px;">Quick Links:</p>
    <ul>
      <li><a href="${WEBSITE_URL}/data-dictionary" style="color: #722F37;">Data Dictionary (Latest)</a></li>
      <li><a href="${WEBSITE_URL}/data-dictionary/change-log" style="color: #722F37;">Change Log</a></li>
      <li><a href="https://github.com/clif-consortium/CLIF" style="color: #722F37;">GitHub Repository</a></li>
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
      CLIF Consortium | <a href="${WEBSITE_URL}" style="color: #999;">clif-consortium.org</a>
    </p>
  </div>

</body>
</html>
  `;
}

async function main() {
  const {
    RESEND_API_KEY,
    SUBSCRIBERS,
    UPDATE_TYPE,
    CHANGED_FILES,
    COMMIT_MESSAGE,
    COMMIT_DATE,
  } = process.env;

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
  const subject = getEmailSubject(UPDATE_TYPE);
  const htmlContent = getEmailContent(UPDATE_TYPE, CHANGED_FILES || '', COMMIT_MESSAGE || 'Documentation updated', COMMIT_DATE || new Date().toLocaleDateString());

  console.log(`Sending "${subject}" to ${recipients.length} recipient(s)...`);

  // Send emails (with small delay to avoid rate limits)
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