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

## UI Plan (Components + Sections)

1. KPI row
- Components: `Card`, `Badge`, `Skeleton`
- Widgets: `Total spent`, `Receipts count`, `Avg receipt`, `Unique shops`

2. Spending trend by day
- Components: `Chart`, `Card`, `Tabs`
- Tabs: `7d`, `30d`, `90d`, `custom`

3. Top receipt-item categories
- Components: `Chart` (bar/pie), `Card`, `Empty`
- Metrics: category total and share

4. Top items (from `receipt-items`)
- Components: `Data Table`, `Card`, `Input`
- Columns: name, sum, quantity, entries

5. Top shops
- Components: `Data Table` or `Chart + Table`, `Card`
- Columns: shop, total, receipts count

6. Filter bar (top)
- Components: `Date Picker`, `Select`, `Combobox`, `Button Group`
- Filters: period, category, shop, sorting, reset/apply

7. Quick actions
- Components: `Dropdown Menu`, `Dialog`, `Button`
- Actions: open filtered receipts, export, open `receipt-items`

8. States
- Components: `Skeleton`, `Empty`, `Alert`
- Per widget: loading/empty/error

### MVP First Cut

Build first: `1 + 2 + 4 + 6`.

## Последний вывод (обновление)

1. KPI ряд — `Card` / `Badge` / `Skeleton`: `Total spent`, `Receipts count`, `Avg receipt`, `Unique shops`.
2. Динамика трат по дням — `Chart` / `Card` / `Tabs`: `7d` / `30d` / `90d` / `custom`.
3. Топ категорий пунктов чека — `Chart` / `Card` / `Empty`: сумма и доля.
4. Топ товаров (`receipt-items`) — `Data Table` / `Card` / `Input`: `name`, `sum`, `quantity`, `entries`.
5. Топ магазинов — `Data Table` или `Chart + Table` / `Card`: `shop`, `total`, `receipts count`.
6. Фильтр-панель сверху — `Date Picker` / `Select` / `Combobox` / `Button Group`: период, категория, магазин, сортировка, reset/apply.
7. Быстрые действия — `Dropdown Menu` / `Dialog` / `Button`: открыть чеки по фильтру, экспорт, переход в `receipt-items`.
8. Состояния — `Skeleton` / `Empty` / `Alert`: loading/empty/error на каждый виджет.

MVP: сначала `1 + 2 + 4 + 6`.
