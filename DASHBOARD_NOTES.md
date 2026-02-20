# Dashboard Notes

## Widgets

1. Revenue for period, receipts count, average check.
2. Payment split: cash / card / mixed.
3. Top shops by revenue.
4. Top shop categories by revenue.
5. Revenue and receipts trend by day/week.
6. Latest receipts list (quick open).
7. Anomalies: spikes/drops, suspicious totals.
8. Data quality: missing owner/cashier/category.
9. Cashier summary: receipts count and amount.
10. Quick actions: add receipt, add receipt item, open problematic records.

## MVP Dashboard

1. Totals (revenue, receipts, average check).
2. Payment split.
3. Time series (daily).
4. Top shops.
5. Latest receipts.

## Backend (Minimal)

Single endpoint:

- `GET /analytics/dashboard?date_from&date_to&shop_id&cashier_id`

Response sections:

1. `totals`
2. `payment_split`
3. `timeseries`
4. `top_shops`
5. `latest_receipts`
