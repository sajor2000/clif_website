# Email Notification System Setup Guide

This guide explains how to set up automated email notifications for CLIF Data Dictionary updates.

## Overview

When you push changes to the data dictionary, change log, or schema files, GitHub Actions will automatically send email notifications to your subscriber list using [Resend](https://resend.com).

**Cost**: Free (Resend offers 3,000 emails/month on free tier)

## Setup Instructions

### Step 1: Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up (free)
2. After signing in, go to **API Keys** in the sidebar
3. Click **Create API Key**
   - Name: `clif-notifications`
   - Permission: `Sending access`
   - Domain: `All domains` (or select your verified domain)
4. **Copy the API key** - you'll only see it once!

### Step 2: Verify Your Domain (Recommended)

To send from your own domain (e.g., `updates@clif-consortium.org`):

1. In Resend, go to **Domains** in the sidebar
2. Click **Add Domain**
3. Enter your domain (e.g., `clif-consortium.org`)
4. Add the DNS records Resend provides:
   - Usually 3-4 TXT records for SPF, DKIM, and verification
5. Wait for verification (usually 5-10 minutes)

**If you can't verify a domain**: You can use Resend's test domain for development:
- `onboarding@resend.dev` (limited to your own email for testing)

### Step 3: Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `RESEND_API_KEY` | Your Resend API key | `re_123abc...` |
| `EMAIL_SUBSCRIBERS` | JSON array of emails | `["email1@example.com","email2@example.com"]` |
| `TEST_EMAIL` | Your email for testing | `your.email@example.com` |

#### Subscriber List Format

The `EMAIL_SUBSCRIBERS` secret must be a valid JSON array:

```json
["alice@university.edu","bob@hospital.org","carol@research.edu"]
```

For larger lists, you can format it with line breaks (GitHub will handle it):
```json
[
  "alice@university.edu",
  "bob@hospital.org",
  "carol@research.edu",
  "more@emails.here"
]
```

### Step 4: Update the Script Configuration

Edit `.github/scripts/send-notification-email.js` and update these values:

```javascript
const WEBSITE_URL = 'https://clif-consortium.org'; // Your actual website URL
const FROM_EMAIL = 'CLIF Consortium <updates@clif-consortium.org>'; // Your verified email
```

### Step 5: Test the Workflow

1. Go to **Actions** tab in your GitHub repository
2. Click on **"Send Email Notifications on Data Dictionary Updates"**
3. Click **"Run workflow"**
4. Select `test_mode: true` to send only to your TEST_EMAIL
5. Click **"Run workflow"**
6. Check your test email inbox

## How It Works

### Triggers

The workflow triggers automatically on pushes to `main` that modify:
- `src/pages/data-dictionary/**` - Any data dictionary page
- `src/content/clif-data-dictionary-*.md` - Data dictionary content
- `src/pages/data-dictionary/change-log.astro` - Change log page
- `src/content/*.sql` - SQL schema files

### Manual Trigger

You can manually trigger emails from the GitHub Actions tab:
- **Test Mode ON**: Sends only to `TEST_EMAIL`
- **Test Mode OFF**: Sends to all subscribers

## Managing Subscribers

### Adding Subscribers

1. Go to GitHub → Settings → Secrets → Actions
2. Click on `EMAIL_SUBSCRIBERS`
3. Update the JSON array with new emails
4. Click "Update secret"

### Removing Subscribers

Same process - update the JSON array and remove the email.

### Handling Unsubscribes

When someone replies with "UNSUBSCRIBE":
1. Remove their email from the `EMAIL_SUBSCRIBERS` secret
2. Optionally reply confirming their removal

## Troubleshooting

### Emails Not Sending

1. Check the Actions tab for workflow run logs
2. Verify `RESEND_API_KEY` is correct
3. Verify `EMAIL_SUBSCRIBERS` is valid JSON
4. Check Resend dashboard for delivery status

### Emails Going to Spam

1. Verify your sending domain in Resend
2. Ensure SPF and DKIM records are set up
3. Use a professional "From" name

### Rate Limits

Resend free tier: 3,000 emails/month, 100 emails/day
- With 300 subscribers and monthly updates, you're well within limits
- The script includes a 100ms delay between emails to avoid issues

## Email Template Customization

The email template is in `.github/scripts/send-notification-email.js` in the `getEmailContent()` function.

Key customization points:
- Colors: The burgundy `#722F37` matches CLIF branding
- Links: Update URLs to your actual website
- Content: Modify the HTML template as needed

## Alternative: Using a University List Server

If your university requires using their email infrastructure:

1. **Option A**: Replace Resend with your university's SMTP
   - You'd need to use nodemailer instead of the Resend API
   - Requires SMTP credentials as GitHub secrets

2. **Option B**: Have the GitHub Action notify your list server
   - Send a single email to your list server address
   - The list server handles distribution

Let me know if you need help with either alternative approach.


gh secret list                                                                      
                                                                                      
  This will show you which secrets are configured. If all three are set, you can test 
  it:                                                                                 
                                                                                      
  gh workflow run email-notifications.yml -f test_mode=true                           
                                                                                      
  Then check if the email arrives at your test email address. You can monitor the     
  workflow run with:                                                                  
                                                                                      
  gh run watch 

  gh secret set EMAIL_SUBSCRIBERS --body '["kaveri@uchicago.edu", "theresemaria98@gmail.com"]'

  If it fails, you can see the logs with:                                             
                                                                                      
  gh run view --log

  To see runs for this workflow, try: gh run list --workflow=email-notifications.yml