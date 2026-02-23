import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { PaginationState } from "@tanstack/react-table";
import { CalendarIcon, ListChecks } from "lucide-react";
import { Suspense, useState } from "react";

import { ReceiptItemCategoriesService, ReceiptItemsService } from "@/client";
import { DataTable } from "@/components/Common/DataTable";
import PendingReceiptItems from "@/components/Pending/PendingReceiptItems";
import { columns } from "@/components/ReceiptItems/columns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

type SortField = "name" | "quantity" | "sum";
type SortOrder = "asc" | "desc";

const toDateParam = (value?: Date) => {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value?: Date, emptyLabel = "Pick a date") => {
  if (!value) return emptyLabel;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(
    value,
  );
};

function getReceiptItemsQueryOptions(
  pagination: PaginationState,
  sort: SortField,
  order: SortOrder,
  dateFrom?: string,
  dateTo?: string,
  categoryId?: string,
) {
  const skip = pagination.pageIndex * pagination.pageSize;
  const limit = pagination.pageSize;

  return {
    queryFn: () =>
      ReceiptItemsService.readReceiptItems({
        skip,
        limit,
        sort,
        order,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        categoryIds: categoryId ? [categoryId] : undefined,
      }),
    queryKey: [
      "receipt-items",
      pagination.pageIndex,
      pagination.pageSize,
      sort,
      order,
      dateFrom,
      dateTo,
      categoryId,
    ],
  };
}

function getReceiptItemCategoriesQueryOptions() {
  return {
    queryFn: () =>
      ReceiptItemCategoriesService.readReceiptItemCategories({
        skip: 0,
        limit: 1000,
      }),
    queryKey: ["receipt-item-categories-filter"],
  };
}

export const Route = createFileRoute("/_layout/receipt-items")({
  component: ReceiptItems,
  head: () => ({
    meta: [
      {
        title: "Receipt Items - FastAPI Cloud",
      },
    ],
  }),
});

function ReceiptItemsTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sort, setSort] = useState<SortField>("sum");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string>("all");

  const { data: receiptItems } = useSuspenseQuery(
    getReceiptItemsQueryOptions(
      pagination,
      sort,
      order,
      toDateParam(dateFrom),
      toDateParam(dateTo),
      categoryId === "all" ? undefined : categoryId,
    ),
  );

  const { data: categories } = useSuspenseQuery(
    getReceiptItemCategoriesQueryOptions(),
  );

  const resetFilters = () => {
    setSort("sum");
    setOrder("desc");
    setDateFrom(undefined);
    setDateTo(undefined);
    setCategoryId("all");
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const renderFilters = () => (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateLabel(dateFrom, "Date from")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom}
            onSelect={(value) => {
              setDateFrom(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="rounded-lg border"
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateLabel(dateTo, "Date to")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo}
            onSelect={(value) => {
              setDateTo(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="rounded-lg border"
          />
        </PopoverContent>
      </Popover>

      <Select
        value={categoryId}
        onValueChange={(value) => {
          setCategoryId(value);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.data.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort}
        onValueChange={(value) => {
          setSort(value as SortField);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="quantity">Quantity</SelectItem>
          <SelectItem value="sum">Total sum</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={order}
        onValueChange={(value) => {
          setOrder(value as SortOrder);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Order" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="asc">Ascending</SelectItem>
          <SelectItem value="desc">Descending</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (receiptItems.count === 0) {
    return (
      <div className="flex flex-col gap-6">
        {renderFilters()}

        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ListChecks className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">
            No grouped receipt items found
          </h3>
          <p className="text-muted-foreground">
            Try changing filters or date range.
          </p>
          <Button className="mt-4" variant="outline" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {renderFilters()}

      <DataTable
        columns={columns}
        data={receiptItems.data}
        manualPagination={true}
        rowCount={receiptItems.count}
        pageCount={Math.ceil(receiptItems.count / pagination.pageSize)}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    </div>
  );
}

function ReceiptItemsTable() {
  return (
    <Suspense fallback={<PendingReceiptItems />}>
      <ReceiptItemsTableContent />
    </Suspense>
  );
}

function ReceiptItems() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipt Items</h1>
          <p className="text-muted-foreground">
            Grouped positions from receipts with totals and frequency
          </p>
        </div>
      </div>
      <ReceiptItemsTable />
    </div>
  );
}
