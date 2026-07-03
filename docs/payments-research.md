# Payments research: provider comparison and recommendation

Deliverable 1 of [issue #12](https://github.com/j0ntz/tcg-art/issues/12). All fees and API shapes
verified against live provider docs on July 2, 2026 (they drift; re-verify before building). The
companion runbook for the recommended path is
[payments-setup-instructions.md](payments-setup-instructions.md).

## 1. What tcg-art needs

From [spec.md](spec.md) section 9: a Pro tier at $3/mo, $30/yr, or $60 lifetime, sold from a
Next.js App Router site on Vercel, by a solo US-based developer, with no auth system yet (Supabase
Auth is planned for v2; payments cannot ship before it, since a purchase must attach to a user).
That means the provider must handle:

- Recurring billing (monthly and yearly) plus a one-time lifetime purchase
- Cards and, ideally, Apple Pay / Google Pay
- Self-serve subscription management (cancel, update card) without us building a billing UI
- Webhooks a Vercel route handler can consume to grant and revoke entitlements
- Small transactions: at $3, fixed per-transaction fees dominate percentage fees

## 2. The wallet nuance: Google Pay and Apple Pay are methods, not processors

This reframes the whole comparison, so it comes first. Neither Google nor Apple settles funds for
a web merchant. Both wallets hand the merchant an encrypted token that a payment processor must
charge:

- Google Pay's web API "facilitates transactions by passing payment information from users to your
  payment service provider"; the integration request object literally names the gateway
  (`tokenizationSpecification.type: PAYMENT_GATEWAY` with `gateway: stripe`, `braintree`, `adyen`,
  etc.). Google charges no fee for this
  ([Google Pay web overview](https://developers.google.com/pay/api/web/overview),
  [request objects](https://developers.google.com/pay/api/web/reference/request-objects),
  [FAQ](https://developers.google.com/pay/api/web/support/faq)).
- Apple's own planning doc says a Payment Service Provider "can simplify and shorten your
  integration effort"; the alternative is decrypting Apple Pay tokens yourself and submitting them
  "for regular processing", i.e. still through an acquirer
  ([Apple Pay planning](https://developer.apple.com/apple-pay/planning/)).

So integrating a processor does get us the wallets for free, with one large asymmetry in setup
cost:

| | Direct integration | Through Stripe |
|---|---|---|
| Apple Developer account ($99/yr) | Required ([enrollment](https://developer.apple.com/support/enrollment/)) | Not required ([Stripe Apple Pay docs](https://docs.stripe.com/apple-pay?platform=web)) |
| Merchant ID + payment processing cert + merchant identity cert | You create and rotate them (cert expires every 25 months) ([Apple config](https://developer.apple.com/help/account/configure-app-capabilities/configure-apple-pay-on-the-web)) | Stripe handles all of it: "Don't follow the merchant validation process in the Apple Pay documentation" |
| Domain verification file at `/.well-known/` | You host Apple's file | Not needed; domain registration is a Stripe Dashboard action |
| Server-side merchant session validation | You build it (single-use session, 5-minute expiry) ([merchant validation](https://developer.apple.com/documentation/applepayontheweb/providing-merchant-validation)) | Stripe handles it |
| Google Pay production access | Google Pay & Wallet Console business profile + purchase-flow screenshots for review ([FAQ](https://developers.google.com/pay/api/web/support/faq)) | Not needed; a Dashboard toggle |

Conclusion: direct wallet integrations are strictly worse for us. They add Apple/Google review
processes and certificate plumbing while still requiring a processor underneath. The wallets are a
checkbox on whichever processor we pick, so the real comparison is Stripe vs PayPal vs a merchant
of record.

## 3. Stripe (payment processor)

**Covers:** cards, Apple Pay, Google Pay, and Link (Stripe's own one-click wallet, on by default)
through the same checkout; subscriptions via Stripe Billing; one-time payments for the lifetime
tier; a hosted customer portal for self-serve cancel/upgrade/card-update
([Checkout](https://docs.stripe.com/payments/checkout),
[Link](https://docs.stripe.com/payments/link),
[customer portal](https://docs.stripe.com/customer-management)).

**Fees (US account, verified on [stripe.com/pricing](https://stripe.com/pricing) and
[stripe.com/billing/pricing](https://stripe.com/billing/pricing)):** 2.9% + 30¢ per domestic card
transaction, +1.5% international cards, +1% currency conversion. Stripe Billing adds 0.7% of
recurring volume (the old cheaper Starter tier was retired; new accounts pay 0.7%
([support note](https://support.stripe.com/questions/changes-to-the-stripe-billing-starter-and-scale-plans))).
Checkout and the customer portal cost nothing extra. Disputes are $15 each. Wallets add no fee
([Google Pay via Stripe](https://docs.stripe.com/google-pay?platform=web)).

**Subscriptions:** recurring Prices sold through a Checkout Session in `subscription` mode is
Stripe's recommended integration; the $60 lifetime is the same flow in `payment` mode
([build subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions)).

**Wallets:** "No additional configuration is required to use Apple Pay in Checkout"; Google Pay is
a Dashboard toggle. No Apple Developer account, no hosted verification file. If we ever embed the
payment form on our own domain (Elements or embedded Checkout), we register the domain once in
Dashboard > Settings > Payment method domains; the hosted checkout.stripe.com redirect needs
nothing ([Apple Pay via Stripe](https://docs.stripe.com/apple-pay?platform=web),
[domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration?dashboard-or-api=dashboard)).

**Next.js / Vercel shape:** `stripe` + `@stripe/stripe-js` npm packages; an App Router route
handler creates the Checkout Session and 303-redirects to `session.url`; a second route handler
receives webhooks. The webhook handler must read the raw body (`await request.text()`) for
signature verification and should pin `export const runtime = "nodejs"`
([Next.js quickstart](https://docs.stripe.com/checkout/quickstart?client=next),
[webhooks](https://docs.stripe.com/webhooks)). Vercel's Fluid compute default gives 300s function
duration on every plan, so webhook timeouts are a non-issue
([Vercel changelog](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)).
The official [nextjs/saas-starter](https://github.com/nextjs/saas-starter) template implements
exactly this stack (Checkout, portal, webhook sync, auth), useful as a reference when the build
task comes.

**Tax/VAT:** we are the merchant of record. Stripe Tax monitors registration thresholds,
calculates, and collects (0.5% per transaction, charged only "where you're registered to collect
taxes", so enabling it for monitoring is free), but registering and remitting stays our job:
"you must file and remit the taxes collected in every location that you're registered in"
([Stripe Tax pricing](https://stripe.com/tax/pricing),
[how tax works](https://docs.stripe.com/tax/how-tax-works)).

**External setup:** account + KYC activation, create Products/Prices in test and live, enable
payment methods, register one webhook endpoint per mode, enable the portal, set 3 Vercel env vars
plus price IDs. Fully self-serve, no approval gate beyond standard KYC. Detailed in the
[runbook](payments-setup-instructions.md).

## 4. PayPal (payment processor)

**Covers:** PayPal-balance/branded checkout, unbranded card fields, Venmo; subscriptions via its
Subscriptions API; Apple Pay and Google Pay exist but only for one-time payments, not
subscriptions ([Apple Pay APM](https://developer.paypal.com/docs/checkout/apm/apple-pay/),
[Google Pay APM](https://developer.paypal.com/docs/checkout/apm/google-pay/)). Subscribing without
a PayPal wallet is not a documented first-class path; the subscription flow runs through the
PayPal button ([customize docs](https://developer.paypal.com/docs/subscriptions/customize/)).

**Fees (US, verified on [merchant fees](https://www.paypal.com/us/webapps/mpp/merchant-fees),
page dated June 29, 2026):** branded checkout 3.49% + 49¢; unbranded advanced card fields
2.89% + 29¢; chargebacks $20. A micropayments rate (4.99% + 9¢) exists but requires application
and is account-scoped in its legacy form, which would make the $60 tier more expensive.

**Next.js shape:** `@paypal/react-paypal-js` buttons on the client, `@paypal/paypal-server-sdk`
plus REST credentials on the server, webhook events like `BILLING.SUBSCRIPTION.CANCELLED` and
`PAYMENT.SALE.COMPLETED` ([subscriptions integrate](https://developer.paypal.com/docs/subscriptions/integrate/),
[webhook event names](https://developer.paypal.com/api/rest/webhooks/event-names/)). More DIY than
Stripe: no hosted checkout page and no hosted customer portal; buyers cancel from inside their
PayPal account settings, and we must consume the cancellation webhook to revoke access.

**Tax/VAT:** not a merchant of record; the only tax tooling in the Subscriptions API is a
merchant-supplied flat `taxes.percentage`
([Subscriptions API](https://developer.paypal.com/docs/api/subscriptions/v1/)).

**External setup:** verified business account, REST app credentials, separate sandbox and live
apps with duplicated configuration, webhook registration per app, and a 24-72h review when going
live ([going live](https://developer.paypal.com/api/rest/production/)).

**Verdict:** higher fees than Stripe at every price point, wallets that do not cover
subscriptions, and more lifecycle code to write. PayPal makes sense only as a second checkout
option for PayPal-loyal buyers, and note that Stripe cannot bridge this for us: PayPal through
Stripe is available only to businesses in Europe, not US accounts
([Stripe PayPal docs](https://docs.stripe.com/payments/paypal)).

## 5. Merchant of record: Paddle (and the Lemon Squeezy situation)

A merchant of record resells our product: the MoR is the legal seller, so it owns global sales
tax/VAT registration and remittance, chargebacks, and PCI liability; the buyer's card statement
shows the MoR's name, e.g. PADDLE.NET
([what is MoR](https://www.paddle.com/blog/what-is-merchant-of-record),
[Paddle chargebacks](https://www.paddle.com/help/manage/risk-prevention/understanding-chargebacks-with-paddle)).

**Paddle:** 5% + 50¢ per transaction, everything included (tax, subscription billing, hosted
checkout overlay, customer portal, cards + Apple Pay + Google Pay + PayPal)
([pricing](https://www.paddle.com/pricing),
[payment methods](https://developer.paddle.com/concepts/payment-methods/overview)). Good Next.js
story: `@paddle/paddle-js` + `@paddle/paddle-node-sdk`, both actively maintained, and an official
[App Router starter kit](https://github.com/PaddleHQ/paddle-nextjs-starter-kit). The catches:

- Products priced under $10 "require contacting sales for custom pricing"
  ([pricing](https://www.paddle.com/pricing)). Our anchor price is $3/mo, so the headline rate is
  not even guaranteed self-serve.
- Onboarding is a real approval gate: domain review wants a live HTTPS site with visible pricing,
  Terms, refund policy, and privacy policy; manual review runs 5-7 business days, and Paddle
  tightened screening after a $5M FTC settlement in June 2025
  ([verification](https://www.paddle.com/help/start/account-verification/what-is-domain-verification),
  [FTC](https://www.ftc.gov/news-events/news/press-releases/2025/06/paddle-will-pay-5-million-settle-ftc-allegations-unfair-payment-processing-practices-facilitation)).
- Payouts are monthly (created the 1st, sent by the 15th) with a $100 minimum
  ([payouts](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)), vs Stripe's
  rolling ~2-day payouts.

**Lemon Squeezy:** the other commonly recommended MoR, but not a safe pick in mid-2026. Stripe
acquired it in July 2024; the founders now say the team is heads-down on "Stripe's new merchant of
record product" and admit slower support and fewer updates, with a migration path to that product
as the stated goal ([January 2026 update](https://www.lemonsqueezy.com/blog/2026-update)). Its
official JS SDK has not shipped a release since November 2024. Building on it today means building
on a wind-down.

**Stripe Managed Payments:** the successor, Stripe's own MoR for digital products: a 3.5% fee on
top of standard processing, handling tax in 80+ countries, disputes, and transaction-level
support. Still in preview (API version `2026-02-25.preview`, ToS acceptance required)
([Managed Payments](https://stripe.com/managed-payments),
[pricing](https://support.stripe.com/questions/managed-payments-pricing?locale=en-GB),
[changelog](https://docs.stripe.com/changelog/clover/2026-02-25/managed-payments)). Not something
to build on today, but it matters strategically: it is the escape hatch that later offloads tax
compliance without leaving Stripe.

**Others, for completeness:** [Polar.sh](https://polar.sh/docs/merchant-of-record/fees)
(developer-first open-source MoR, 5% + 50¢ on the free tier, cheaper with monthly plans),
[Gumroad](https://gumroad.com/pricing) (creator storefront, 10% + 50¢, MoR since January 2025),
FastSpring (enterprise MoR, no self-serve pricing, roughly 5.9% + 95¢ by third-party reports).
None beats Paddle for this use case, and all share the MoR fee structure that punishes a $3 price.

## 6. Fees at tcg-art's actual price points

Computed from the verified rates above (domestic US card, no tax):

| Price point | Stripe (Checkout + Billing) | PayPal branded | Paddle MoR | Stripe Managed Payments (preview) |
|---|---|---|---|---|
| $3/mo | ~$0.41 (13.6%) | ~$0.59 (19.8%) | $0.65 (21.7%) | ~$0.49 (16.4%) |
| $30/yr | ~$1.38 (4.6%) | ~$1.54 (5.1%) | $2.00 (6.7%) | ~$2.22 (7.4%) |
| $60 lifetime | ~$2.04 (3.4%, no Billing fee) | ~$2.58 (4.3%) | $3.50 (5.8%) | ~$4.14 (6.9%) |

Stripe is cheapest at all three points. The MoR premium is the price of tax offloading; at $3 the
fixed 50¢ makes it a 22% haircut.

## 7. The tax reality (why anyone picks an MoR)

- **US sales tax:** economic nexus thresholds are $100,000/year in most states (CA/NY/TX:
  $500,000), though some states keep an alternative 200-transaction trigger
  ([Avalara state guide](https://www.avalara.com/us/en/learn/guides/state-by-state-guide-economic-nexus-laws.html)).
  At $3/mo, dollar thresholds are years away; the 200-transaction states are the only early
  exposure, and SaaS is not even taxable in many states.
- **EU VAT:** the uncomfortable one. A non-EU business selling digital services to EU consumers
  owes destination-country VAT from the first sale, no threshold; the non-Union OSS scheme reduces
  this to one registration and a single quarterly return
  ([EU OSS](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en),
  [non-Union OSS](https://simplyvat.com/non-union-oss/)). The 10k EUR relief applies only to
  EU-established sellers.
- **On plain Stripe** we own all of this. The mitigations, in order: enable Stripe Tax threshold
  monitoring from day one (free until registered), register via OSS when EU sales become material
  (or US states as thresholds near, Stripe can file US registrations), and if worldwide B2C volume
  ever makes compliance a real burden, migrate the checkout to Stripe Managed Payments and hand
  the whole problem to Stripe for 3.5%.

## 8. Recommendation

**Build Stripe only: hosted Stripe Checkout + Stripe Billing + the no-code customer portal, with
Apple Pay, Google Pay, and Link enabled as Checkout payment methods. Defer Stripe Tax collection
(enable only its free threshold monitoring). Do not integrate PayPal, direct wallet APIs, or a
merchant of record.**

Reasoning:

1. **Fewest moving parts.** One provider covers subscriptions, the lifetime one-off, cards, both
   wallets, dunning, and self-serve billing management. The site's code surface is two route
   handlers (create-session, webhook) plus a pricing page button. Hosted Checkout and the hosted
   portal mean no payment UI to build or maintain.
2. **Least compliance surface.** PCI is SAQ-A (card data never touches us), Apple Pay requires no
   Apple Developer account or certificates, and tax exposure at launch volume is negligible and
   monitored for free.
3. **Cheapest.** Lowest effective fee at all three price points (section 6).
4. **No approval gate.** Stripe activation is standard KYC. Paddle's domain review and sub-$10
   sales-call requirement are friction we cannot afford on a $3 anchor price.
5. **Aligned with the spec and the ecosystem.** [spec.md](spec.md) already pencils in Stripe; the
   official Next.js saas-starter implements this exact stack; the v2 Supabase Auth plan pairs with
   it cleanly.
6. **Clean upgrade paths.** If tax compliance grows teeth, Stripe Managed Payments takes over
   without a provider migration. If PayPal buyers matter later, a PayPal button can be added
   alongside Stripe without touching the Stripe integration.

**What we forgo:**

- **PayPal-balance buyers.** Some customers only pay via PayPal, and a US Stripe account cannot
  offer PayPal as a Stripe payment method (Europe-only). If conversion data later shows demand, a
  separate PayPal one-time-payment button for the lifetime tier is the cheapest re-entry.
- **Venmo.** Same story, PayPal-only.
- **MoR tax offloading.** We own registrations and filings when they eventually apply. Mitigated
  by free threshold monitoring and the Managed Payments escape hatch.
- **Paddle's bundled extras** (localized pricing, their fraud/chargeback absorption; disputes on
  Stripe cost $15 and are our problem).

Non-goals confirmed: no product code in this task. The build task that implements this needs auth
first (spec v2), plus the two route handlers and entitlement checks; the external setup a human
must do is the whole of [payments-setup-instructions.md](payments-setup-instructions.md).
