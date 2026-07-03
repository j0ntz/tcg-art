# Payments setup runbook: everything outside the codebase

Deliverable 2 of [issue #12](https://github.com/j0ntz/tcg-art/issues/12). This is the exact
external setup for the recommended path from [payments-research.md](payments-research.md):
Stripe hosted Checkout + Stripe Billing + customer portal, wallets enabled through Checkout.
Execute it top to bottom; each step says where it happens and what to record. Verified against
Stripe docs on July 2, 2026.

**Placeholders used throughout.** `PROD_DOMAIN` is the site's production URL. Today that is the
Vercel production domain (`https://tcg-art.vercel.app`); when a custom domain lands, follow the
domain-change checklist in section 11 (webhook URL and payment method domain are both
domain-bound).

**Timing.** Steps 1-7 (test mode plus env vars) can be done today and cost nothing. Step 8 (live
mode) needs a
bank account and KYC details and should wait until the paywall build task is actually shipping.
The code that consumes these keys is a later task and needs auth first; nothing here blocks on it.

## 1. Create the Stripe account

1. Go to [dashboard.stripe.com/register](https://dashboard.stripe.com/register). Sign up with the
   project owner's email. Verify the email address.
2. Skip full business activation for now (that is step 8). A fresh account starts in a test
   sandbox, which is all steps 2-6 need.
3. In the top-left account menu, name the account `tcg-art` so live-mode branding starts clean.

## 2. Get the test API keys

1. Dashboard > **Developers > API keys** (make sure the **Test mode** toggle in the top bar
   is ON; test keys are prefixed `pk_test_` / `sk_test_`).
2. Record:
   - **Publishable key** (`pk_test_...`) -> becomes `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (`sk_test_...`) -> becomes `STRIPE_SECRET_KEY`
3. Optional hardening for later: Stripe now recommends restricted keys (`rk_`) over the raw
   secret key ([docs.stripe.com/keys](https://docs.stripe.com/keys)). For the first integration
   pass the secret key is fine; revisit before live mode if desired.

## 3. Create the products and prices (test mode)

Dashboard > **Product catalog > Add product**. Create two products, three prices, matching
[spec.md](spec.md) section 9:

| Product | Price | Type | Env var to record the price ID into |
|---|---|---|---|
| TCG-Art Pro | $3.00 USD | Recurring, monthly | `STRIPE_PRICE_PRO_MONTHLY` |
| TCG-Art Pro | $30.00 USD | Recurring, yearly | `STRIPE_PRICE_PRO_YEARLY` |
| TCG-Art Pro Lifetime | $60.00 USD | One-time | `STRIPE_PRICE_PRO_LIFETIME` |

1. For "TCG-Art Pro": add the $3 monthly price first, then use **Add another price** for the $30
   yearly price on the same product.
2. For the lifetime tier, create a separate product "TCG-Art Pro Lifetime" with a one-time $60
   price (Checkout sells recurring and one-time prices in different modes, and entitlement logic
   differs, so a separate product keeps reporting clean).
3. Open each price and copy its ID (`price_...`). Record all three against the env var names
   above. Price IDs are mode-specific; these are the TEST ones.

## 4. Enable payment methods (test mode)

1. Dashboard > **Settings > Payments > Payment methods** (this is per-mode; you are
   editing the test configuration).
2. Confirm ON: **Cards**, **Apple Pay**, **Google Pay**, **Link**. All four are typically on by
   default; Apple Pay and Google Pay need no further configuration for hosted Checkout
   ([Apple Pay](https://docs.stripe.com/apple-pay?platform=web),
   [Google Pay](https://docs.stripe.com/google-pay?platform=web)). Link is Stripe's one-click
   wallet and is on by default; leave it on
   ([Link](https://docs.stripe.com/payments/link)).
3. No Apple Developer account, no merchant certificate, and no
   `/.well-known/apple-developer-merchantid-domain-association` file is needed at any point in
   this runbook: "Stripe handles Apple merchant validation for you"
   ([Apple Pay docs](https://docs.stripe.com/apple-pay?platform=web)).

## 5. Register the webhook endpoint (test mode)

The app will expose one webhook route: `PROD_DOMAIN/api/stripe/webhook`.

1. Dashboard > **Developers > Webhooks > Add endpoint** (test mode).
2. Endpoint URL: `https://tcg-art.vercel.app/api/stripe/webhook` (substitute `PROD_DOMAIN`).
3. Select exactly these events (the fulfillment + subscription lifecycle set from
   [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted)
   and [build subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions)):
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. After creating the endpoint, click **Reveal** under Signing secret and record the `whsec_...`
   value -> becomes `STRIPE_WEBHOOK_SECRET`.
5. Local development note (for the build task, not this runbook): the Stripe CLI
   (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) prints its own temporary
   `whsec_...`; that one goes in `.env.local`, never in Vercel.

## 6. Enable the customer portal (test mode)

1. Dashboard > **Settings > Billing > Customer portal**.
2. Turn on: **Cancel subscriptions** (choose "at end of billing period"), **Update payment
   methods**, **Invoice history**. Optionally allow switching between the monthly and yearly
   prices (add both Pro prices to the allowed products list).
3. Set the business name and support email under Branding, then **Save**. The portal is no-code;
   the app will just create portal sessions
   ([customer portal](https://docs.stripe.com/customer-management)).

## 7. Vercel environment variables

Vercel dashboard > project **tcg-art** > **Settings > Environment Variables**. Create:

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` now; `pk_live_...` after step 8 | Test values in Development + Preview; live values in Production once live |
| `STRIPE_SECRET_KEY` | `sk_test_...` now; `sk_live_...` after step 8 | same split |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 5 (test); live endpoint's secret after step 8 | same split |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_...` (test) ; live ID after step 8 | same split |
| `STRIPE_PRICE_PRO_YEARLY` | `price_...` (test) ; live ID after step 8 | same split |
| `STRIPE_PRICE_PRO_LIFETIME` | `price_...` (test) ; live ID after step 8 | same split |

Notes:

- Until live mode exists, it is fine to put test values in all three environments; the step 8
  checklist replaces the Production ones.
- `NEXT_PUBLIC_` variables are inlined at build time; any change requires a redeploy to take
  effect. The server-side variables also only refresh on redeploy. Always redeploy after editing.
- Never commit any of these to the repo. `.env.local` (gitignored) mirrors the test values for
  local dev.

## 8. Go live (do this only when the paywall feature is ready to ship)

1. **Activate the account.** Dashboard > **Activate payments**. Stripe's KYC requires: legal
   entity type (sole proprietor works), name, address, SSN or EIN, website URL (`PROD_DOMAIN`),
   product description ("Pokemon card art search subscription"), support email, bank account for
   payouts, and a statement descriptor (use `TCGART`, it is what shows on customers' card
   statements) ([activation docs](https://docs.stripe.com/get-started/account/activate)).
2. **Recreate the catalog in live mode.** Toggle Test mode OFF. Objects do not cross modes
   ([docs.stripe.com/keys](https://docs.stripe.com/keys)), so repeat step 3 exactly in live mode
   and record the three LIVE price IDs.
3. **Repeat per-mode settings in live mode:** payment methods (step 4), webhook endpoint (step 5,
   same URL, new live signing secret), customer portal (step 6). Live webhook deliveries retry
   for up to 3 days on failure ([webhooks](https://docs.stripe.com/webhooks)).
4. **Get live keys** (Developers > API keys with Test mode off): `pk_live_...`, `sk_live_...`.
5. **Update Vercel Production env vars** with the six live values (keys, webhook secret, three
   price IDs) and redeploy production.
6. **Register the payment method domain.** Dashboard > **Settings > Payment method
   domains > Add a new domain**, enter the production domain (no scheme, e.g.
   `tcg-art.vercel.app`). This is required for wallets only when the payment form is embedded on
   our own domain, but it is a one-click no-downside step and future-proofs a later switch from
   hosted Checkout to embedded
   ([domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration?dashboard-or-api=dashboard)).
   Registration covers Apple Pay, Google Pay, and Link at once. Redo it if the domain ever
   changes.

## 9. Verification checklist

Test mode (after the build task wires the routes):

1. Buy the $3 plan with card `4242 4242 4242 4242` (any future expiry, any CVC). Confirm: redirect
   back to the success URL, a `checkout.session.completed` delivery marked 200 under
   Developers > Webhooks, and a new subscription under Customers.
2. Open the customer portal from the app and cancel; confirm `customer.subscription.updated`
   (cancel-at-period-end) arrives and access flips at the right time.
3. Buy the $60 lifetime price; confirm fulfillment fires from the webhook, not from the success
   page render (the handler must be idempotent; Stripe can deliver events more than once
   ([fulfillment docs](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted))).
4. Wallet check: open the hosted Checkout page in Safari on a device with a card in Apple Wallet
   and confirm the Apple Pay button renders; same for Chrome + Google Pay. Wallet buttons only
   appear on supporting device/browser combinations, absence elsewhere is expected.

Live mode, after step 8: make one real $3 purchase with a personal card, confirm the webhook
delivery and the subscription, then refund it from the Dashboard (Payments > select the
payment > Refund).

## 10. Tax posture (decision from the research doc)

1. Now: Dashboard > **Settings > Tax**, enable Stripe Tax **threshold monitoring** only. It
   is free until you actually register somewhere: pricing is "0.5% per transaction, where you're
   registered to collect taxes" ([tax pricing](https://stripe.com/tax/pricing)).
2. Do NOT enable tax collection anywhere yet. Collecting without being registered is not a thing;
   registration comes first ([how tax works](https://docs.stripe.com/tax/how-tax-works)).
3. When monitoring shows a US state threshold approaching, or EU sales become material: register
   (Stripe can handle US state registrations; EU consumer sales go through the non-Union OSS
   scheme, one registration + quarterly returns
   ([EU OSS](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en))), then enable collection
   for that jurisdiction, and budget for filing (Stripe files via partners, or Managed Payments
   takes it over wholesale per the research doc).

## 11. Ongoing operations

- **Webhook health:** Developers > Webhooks shows delivery attempts; configure the endpoint's
  alert email so repeated failures notify. A failing endpoint silently breaks entitlements.
- **Disputes:** $15 each, handled in Dashboard > Payments > Disputes. At a $3 price, refund
  quickly and generously; a dispute costs 5x the subscription.
- **Key hygiene:** if a secret key ever leaks (committed, pasted in a log), roll it immediately
  from Developers > API keys > Roll key, then update Vercel and redeploy.
- **Domain change:** when a custom domain replaces the vercel.app domain, update the webhook
  endpoint URL (both modes), re-register the payment method domain, and update the account's
  website URL under Settings > Business details.
