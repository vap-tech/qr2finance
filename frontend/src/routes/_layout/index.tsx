import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CreditCard, Wallet } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AnalyticsService,
  CashiersService,
  ReceiptItemsService,
  ShopCategoriesService,
  ShopsService,
} from "@/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useAuth from "@/hooks/useAuth";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - FastAPI Cloud",
      },
    ],
  }),
});

type PeriodPreset = "7d" | "30d" | "90d" | "custom";

const toDateParam = (value?: Date) => {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(value / 100);

const formatCount = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getPresetRange = (preset: PeriodPreset) => {
  if (preset === "custom") return undefined;
  const today = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));
  return { from: start, to: today } satisfies DateRange;
};

const formatRangeLabel = (range?: DateRange) => {
  if (!range?.from) return "Pick a range";
  const fromLabel = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(range.from);
  if (!range.to) return fromLabel;
  const toLabel = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(range.to);
  return `${fromLabel} — ${toLabel}`;
};

function DashboardContent() {
  const { user: currentUser } = useAuth();
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(
    undefined,
  );
  const [shopCategoryId, setShopCategoryId] = useState<string>("all");
  const [shopId, setShopId] = useState<string>("all");
  const [cashierId, setCashierId] = useState<string>("all");

  const activeRange = useMemo(
    () => (period === "custom" ? customRange : getPresetRange(period)),
    [period, customRange],
  );

  const dateFrom = toDateParam(activeRange?.from);
  const dateTo = toDateParam(activeRange?.to);

  const { data: dashboard } = useSuspenseQuery({
    queryKey: [
      "dashboard",
      period,
      dateFrom,
      dateTo,
      shopCategoryId,
      shopId,
      cashierId,
    ],
    queryFn: () =>
      AnalyticsService.readDashboard({
        dateFrom,
        dateTo,
        shopCategoryId: shopCategoryId === "all" ? undefined : shopCategoryId,
        shopId: shopId === "all" ? undefined : shopId,
        cashierId: cashierId === "all" ? undefined : cashierId,
        latestLimit: 10,
      }),
  });

  const { data: shops } = useSuspenseQuery({
    queryKey: ["dashboard-shops"],
    queryFn: () => ShopsService.readShops({ skip: 0, limit: 1000 }),
  });

  const { data: shopCategories } = useSuspenseQuery({
    queryKey: ["dashboard-shop-categories"],
    queryFn: () =>
      ShopCategoriesService.readShopCategories({ skip: 0, limit: 1000 }),
  });

  const { data: cashiers } = useSuspenseQuery({
    queryKey: ["dashboard-cashiers"],
    queryFn: () => CashiersService.readCashiers({ skip: 0, limit: 1000 }),
  });

  const { data: topItems } = useSuspenseQuery({
    queryKey: ["dashboard-top-items", dateFrom, dateTo],
    queryFn: () =>
      ReceiptItemsService.readReceiptItems({
        skip: 0,
        limit: 5,
        sort: "sum",
        order: "desc",
        dateFrom,
        dateTo,
      }),
  });

  const filteredShops = useMemo(() => {
    if (shopCategoryId === "all") return shops.data;
    return shops.data.filter((shop) =>
      shop.category_ids.includes(shopCategoryId),
    );
  }, [shops.data, shopCategoryId]);

  useEffect(() => {
    if (shopId === "all") return;
    if (!filteredShops.some((shop) => shop.id === shopId)) {
      setShopId("all");
    }
  }, [filteredShops, shopId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl truncate max-w-sm">
          Hi, {currentUser?.full_name || currentUser?.email} 👋
        </h1>
        <p className="text-muted-foreground">
          Welcome back, nice to see you again!!!
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Filters</CardTitle>
          <CardDescription>Adjust the dashboard scope</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Tabs
              value={period}
              onValueChange={(value) => setPeriod(value as PeriodPreset)}
            >
              <TabsList>
                <TabsTrigger value="7d">7d</TabsTrigger>
                <TabsTrigger value="30d">30d</TabsTrigger>
                <TabsTrigger value="90d">90d</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start gap-2">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <span className="text-sm">
                    {formatRangeLabel(activeRange)}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={activeRange}
                  onSelect={(range) => {
                    setPeriod("custom");
                    setCustomRange(range);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select value={shopCategoryId} onValueChange={setShopCategoryId}>
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {shopCategories.data.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="All shops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shops</SelectItem>
                {filteredShops.map((shop) => (
                  <SelectItem key={shop.id} value={shop.id}>
                    {shop.retail_name || shop.address || "Unnamed shop"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cashierId} onValueChange={setCashierId}>
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="All cashiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cashiers</SelectItem>
                {cashiers.data.map((cashier) => (
                  <SelectItem key={cashier.id} value={cashier.id}>
                    {cashier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total spent</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(dashboard.totals.revenue)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatCount(dashboard.totals.receipts_count)} receipts
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Average receipt</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(Math.round(dashboard.totals.avg_receipt))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Based on {formatCount(dashboard.totals.receipts_count)} receipts
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Receipts count</CardDescription>
            <CardTitle className="text-2xl">
              {formatCount(dashboard.totals.receipts_count)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatCount(dashboard.totals.unique_shops)} unique shops
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Payment split</CardDescription>
            <CardTitle className="text-2xl">
              {formatPercent(dashboard.payment_split.cash_percent)} cash
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Wallet className="size-4 text-emerald-600" />
              {formatMoney(dashboard.payment_split.cash_total_sum)}
            </span>
            <span className="inline-flex items-center gap-2">
              <CreditCard className="size-4 text-sky-600" />
              {formatMoney(dashboard.payment_split.ecash_total_sum)}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending trend</CardTitle>
            <CardDescription>Daily totals</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {dashboard.timeseries.length === 0 ? (
              <Empty className="border-none p-0">
                <EmptyHeader>
                  <EmptyTitle>No data yet</EmptyTitle>
                  <EmptyDescription>
                    Receipts will appear here once they are added.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ChartContainer
                className="h-full w-full"
                config={{
                  revenue: { label: "Revenue", color: "var(--chart-1)" },
                  receipts: { label: "Receipts", color: "var(--chart-2)" },
                }}
              >
                <LineChart
                  data={dashboard.timeseries}
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={formatMoney} />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const revenueItem = payload.find(
                        (item) => item.dataKey === "revenue",
                      );
                      if (!revenueItem) return null;

                      return (
                        <div className="bg-popover/80 backdrop-blur text-popover-foreground border border-border/70 ring-1 ring-black/5 dark:ring-white/10 grid min-w-[8rem] items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs shadow-xl">
                          <div className="font-medium">{label}</div>
                          <div className="text-foreground font-mono font-medium tabular-nums">
                            {formatMoney(Number(revenueItem.value))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Bar
                    dataKey="receipts_count"
                    fill="var(--color-receipts)"
                    opacity={0.25}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top shops</CardTitle>
            <CardDescription>By revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.top_shops.length === 0 ? (
              <Empty className="border-none p-0">
                <EmptyHeader>
                  <EmptyTitle>No shops yet</EmptyTitle>
                  <EmptyDescription>
                    Shops will appear after receipts.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.top_shops.map((shop) => (
                    <TableRow key={shop.shop_id}>
                      <TableCell className="font-medium">
                        <span
                          className="inline-flex max-w-[220px] truncate"
                          title={
                            [shop.shop_name, shop.shop_address]
                              .filter(Boolean)
                              .join(" · ") || undefined
                          }
                        >
                          {shop.shop_display || "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(shop.total_sum)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
            <CardDescription>By total spend</CardDescription>
          </CardHeader>
          <CardContent>
            {topItems.data.length === 0 ? (
              <Empty className="border-none p-0">
                <EmptyHeader>
                  <EmptyTitle>No items yet</EmptyTitle>
                  <EmptyDescription>
                    Items will appear once receipts are added.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Sum</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topItems.data.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.sum)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity % 1 === 0
                          ? item.quantity
                          : item.quantity.toFixed(3).replace(/\\.0+$/, "")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest receipts</CardTitle>
            <CardDescription>Quick access</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.latest_receipts.data.length === 0 ? (
              <Empty className="border-none p-0">
                <EmptyHeader>
                  <EmptyTitle>No receipts yet</EmptyTitle>
                  <EmptyDescription>
                    Once you add receipts, they appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.latest_receipts.data.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">
                        {receipt.shop_display ||
                          receipt.shop?.address ||
                          "Unknown"}
                      </TableCell>
                      <TableCell>
                        {new Intl.DateTimeFormat("ru-RU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(receipt.date_time))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatMoney(receipt.total_sum)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[380px] w-full lg:col-span-2" />
        <Skeleton className="h-[380px] w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[360px] w-full" />
        <Skeleton className="h-[360px] w-full" />
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
