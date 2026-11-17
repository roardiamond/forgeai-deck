import type { OutcomeKind } from "@/lib/forge/types";

export type Sample = {
  id: string;
  label: string;
  blurb: string;
  kind: OutcomeKind;
  body: string;
};

export const SAMPLES: Sample[] = [
  {
    id: "northline",
    label: "Client brief",
    blurb: "Portal request from a freight desk",
    kind: "document",
    body: `Client: Northline Logistics
Contact: Priya Raman, Head of Customer Operations
Asked: 12 Nov 2026
Budget signal: 18–24 lakh INR, first release in 10 weeks

Northline runs a regional freight desk. Shippers email spreadsheets. Dispatchers retype them into a 2014 tool called LaneDesk. Customers call for status because tracking is a static PDF updated twice a day.

First release:
- Customer portal: shipment list, milestone status, upload of POD and invoice
- Dispatcher console: create shipment, assign carrier, exception queue
- Email and WhatsApp alerts when a milestone slips more than 4 hours
- Roles: customer admin, customer viewer, dispatcher, ops lead
- Must work on low-end Android phones used on the warehouse floor
- No magic-link login. Email, password, and an invite flow. SSO later.
- Data stays in India. They said "whatever you usually use" and named Postgres on a previous call.
- Out of scope: billing, fleet GPS, customs filing

Priya: "We lose about 6 hours a day to where-is-my-truck calls. If the portal is honest about delays, the calls drop."

They will call it a success when 30 active shippers are onboarded, the exception queue is used daily, and the PDF status page is retired.

Access they can give: one ops lead, about 6 hours a week. No in-house engineers.`,
  },
  {
    id: "notes",
    label: "Messy notes",
    blurb: "Standup scraps and loose risks",
    kind: "action",
    body: `standup scraps — 11 Nov

API timeouts again on /v1/quotes after 4pm IST. Rahul thinks it is the carrier rate cache. Meera says Redis memory is at 92% on the single node. No pager went off. Customers saw 504s for about 18 minutes. Restarting the worker calmed it. No postmortem written.

Onboarding checklist lives in three places: Notion, the sheet, and Ankit's head. The new CS hire missed the GST document step. Two accounts were billed without tax ids.

Jaipur warehouse photos: aisle C labels do not match the WMS. Priya wants that fixed before the 28 Nov count.

Sales idea: bundle a "priority desk" at +8% for shippers over 200 loads a month. Nobody has modeled the margin.

Also still open: rotate the staging database password that was pasted into Slack #eng on Friday. It may still be valid.`,
  },
  {
    id: "log",
    label: "Error log",
    blurb: "Webhook failures from the quotes API",
    kind: "code",
    body: `2026-11-11T10:42:11Z ERROR quotes webhook id=wh_19c
SignatureMismatch: expected sha256=9f2c… got sha256=11ab…
  at verifySignature (src/webhooks/verify.ts:28:11)
  at handleCarrierWebhook (src/webhooks/carrier.ts:41:5)

2026-11-11T10:42:11Z WARN retry scheduled attempt=2 delay=30s webhook=wh_19c

2026-11-11T10:42:40Z ERROR quotes webhook id=wh_19c
TypeError: Cannot read properties of undefined (reading 'laneId')
  at applyRate (src/quotes/apply-rate.ts:16:22)
  at handleCarrierWebhook (src/webhooks/carrier.ts:55:18)

Body excerpt:
{"event":"rate.updated","carrier":"HH","quoteId":"Q-4412","rate":18450}
Note: payload has no lane object. Older events included lane.id. HH changed the payload on 9 Nov. Our type still requires lane.

2026-11-11T16:06:02Z ERROR quotes 504 duration=30012ms route=POST /v1/quotes
Redis used_memory_rss=92% maxmemory-policy=noeviction
cache key prefix=rate:HH ttl=none (keys never expire)
worker restarts today: 3`,
  },
  {
    id: "csv",
    label: "Monthly numbers",
    blurb: "Loads, margin, delays, churn",
    kind: "insights",
    body: `month,loads,revenue_inr,carrier_cost_inr,support_tickets,on_time_pct,new_shippers,churned_shippers
2026-04,820,4100000,2870000,140,91,6,1
2026-05,860,4280000,3010000,136,92,5,2
2026-06,910,4510000,3290000,151,90,7,1
2026-07,980,4760000,3570000,168,88,8,2
2026-08,1040,4980000,3890000,210,84,9,3
2026-09,1110,5260000,4250000,246,81,8,4
2026-10,1180,5490000,4610000,268,79,6,6

Notes from finance: carrier cost is direct haulage only. Support tickets are "where is it" plus damage claims. on_time_pct is delivered within the promised window. No marketing spend in this sheet.`,
  },
];
