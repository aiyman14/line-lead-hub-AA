# Email Scheduling Setup Guide

## Overview
The email scheduling feature allows admins to receive automated daily or weekly insights reports. However, this requires an external cron service to trigger the scheduling function.

## Why External Cron?
Supabase Edge Functions don't have built-in cron capabilities. We need an external service to call our `process-scheduled-emails` function every 5 minutes to check for due emails.

## Setup Instructions

### Option 1: Using cron-job.org (Recommended - Free)

1. Go to https://cron-job.org and create a free account

2. Create a new cron job with these settings:
   - **Title**: ProductionPortal Email Scheduler
   - **URL**: `https://[your-project-ref].supabase.co/functions/v1/process-scheduled-emails`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`)
   - **Request Method**: POST
   - **Headers**: Add header:
     - **Name**: `Authorization`
     - **Value**: `Bearer [your-anon-key]`

3. Save and enable the cron job

4. The service will now check for scheduled emails every 5 minutes

### Option 2: Using EasyCron

1. Go to https://www.easycron.com and create an account

2. Create a new cron job:
   - **URL to call**: `https://[your-project-ref].supabase.co/functions/v1/process-scheduled-emails`
   - **Cron Expression**: `*/5 * * * *` (every 5 minutes)
   - **HTTP Method**: POST
   - **Custom Headers**: `Authorization: Bearer [your-anon-key]`

3. Save and start the cron job

### Option 3: Using Your Own Server

If you have a server with crontab access:

```bash
# Add this to your crontab (crontab -e)
*/5 * * * * curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-emails
```

### Getting Your Credentials

- **Project Ref**: Found in your Supabase project URL
- **Anon Key**: Found in Project Settings > API > Project API keys

## How It Works

1. Admins configure email schedules in the UI (daily or weekly)
2. Schedules are saved to the `email_schedules` table with timezone info
3. Every 5 minutes, the cron service calls `process-scheduled-emails`
4. The function checks each active schedule against the factory's timezone
5. If it's time to send (within a 5-minute window), it triggers the email
6. The `last_sent_at` timestamp is updated to prevent duplicate sends

## Testing

Users can test their email configuration using the "Test" button in the UI, which immediately sends a test email without waiting for the scheduled time.

## Troubleshooting

### Emails not sending
1. Check that the external cron service is running and hitting the correct URL
2. Verify the Authorization header is set correctly
3. Check the Supabase Edge Function logs for errors
4. Ensure the schedule is marked as `is_active = true` in the database

### Wrong timezone
1. Verify the factory timezone is set correctly in Factory Settings
2. The function uses `toLocaleString` with the factory timezone to determine the current time

### Duplicate emails
The function includes duplicate prevention:
- Daily emails: Won't send if already sent today
- Weekly emails: Won't send if sent within the last 6 days
