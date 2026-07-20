# Stripe integration plan

ASCOFFICE uses prepaid export credits rather than a subscription. Registration
grants 3 complimentary exports by default. PDF and Excel each consume one credit.

## Stripe model

- Create one Product for export credits and three one-time JPY Prices: 5, 20 and
  50 exports.
- Use hosted Checkout Sessions in `payment` mode with dynamic payment methods.
- Enable invoice creation on every successful Checkout Session.
- Grant credits only from signed `checkout.session.completed` or
  `checkout.session.async_payment_succeeded` webhooks when payment status is paid.
- Keep Checkout Session IDs unique in MariaDB so webhook retries cannot grant the
  same purchase twice.
- Keep automatic tax disabled until ASCOFFICE confirms its Japanese tax
  registrations and product tax treatment.

## Local configuration

Copy the Stripe variables from `.env.example` to `.env.local`. Use a restricted
test key where possible, configure the webhook secret, and place each one-time
Price ID in its matching export-pack variable. Never commit keys.

## Test checklist

1. A new or existing user receives the complimentary credits exactly once.
2. Each PDF/Excel export atomically consumes one credit under concurrent requests.
3. A successful purchase grants the correct pack once, including webhook retries.
4. A failed or unpaid Checkout Session grants no credits.
5. The generated invoice appears in the user account and admin revenue totals.
6. Refunds are reviewed manually when purchased credits have already been used;
   automatic clawback should be introduced only with an explicit refund policy.
