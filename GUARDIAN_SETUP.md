# VidyaAI Guardian setup

## Deploy the access controls

```bash
npx firebase-tools deploy --only firestore:rules --project vidyaai-531c9
```

Guardian collections are server-only. Do not loosen those Firestore rules to
make a browser query work.

## Enable phone authentication

In Firebase Console for `vidyaai-531c9`:

1. Authentication → Sign-in method → enable **Phone**.
2. Authentication → Settings → Authorized domains: add the production domain.
3. Add Firebase test phone numbers while developing. They prevent SMS from
   being sent to real people during tests.

Firebase Phone Auth owns OTP generation, expiry, retry limits, and abuse
protection. The application never stores or sees OTP values.

## Sandbox safety mode

The Guardian safety route currently creates **sandbox database events only**.
It does not send push notifications, SMS, place calls, or collect location.
Do not turn it into a production emergency notification system until all of
the following are complete:

- An independently reviewed clinical safety policy and classifier evaluation.
- A staffed escalation and incident-response policy.
- Firebase Cloud Messaging credentials and guardian notification opt-in.
- A separate location-consent, retention, and deletion policy.
- Threat modelling, penetration testing, and consent/legal review appropriate
  for the jurisdictions and ages of users.

Never rely on the app as an emergency response service. Show local emergency
resources prominently; for India the application currently uses `112`.

## Test flow

1. Sign in as a student and visit `/student/guardian`.
2. Add a test Guardian phone number in E.164 format, e.g. `+919876543210`.
3. In another browser profile, visit `/guardian/login`, use that same Firebase
   test number and its test OTP, and complete the Guardian profile.
4. Accept the request in the Guardian dashboard.
5. Return to the student page and confirm the connection and permissions.
6. Confirm the Guardian dashboard shows only the connected student and any
   sandbox alerts—not tutor, counselling, study, or private conversation data.
