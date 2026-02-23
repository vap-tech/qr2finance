import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { PaginationState } from "@tanstack/react-table";
import { ArrowRight, Plus, ReceiptText } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { DataTable } from "@/components/Common/DataTable";
import PendingReceipts from "@/components/Pending/PendingReceipts";
import { columns } from "@/components/Receipts/columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readReceipts } from "@/lib/receiptsApi";

const AddReceipt = lazy(() => import("@/components/Receipts/AddReceipt"));

function getReceiptsQueryOptions(
  pagination: PaginationState,
  itemNameFilter: string,
) {
  const skip = pagination.pageIndex * pagination.pageSize;
  const limit = pagination.pageSize;

  return {
    queryFn: () => readReceipts({ skip, limit, itemName: itemNameFilter }),
    queryKey: [
      "receipts",
      pagination.pageIndex,
      pagination.pageSize,
      itemNameFilter,
    ],
  };
}

export const Route = createFileRoute("/_layout/receipts")({
  component: Receipts,
  head: () => ({
    meta: [
      {
        title: "Receipts - FastAPI Cloud",
      },
    ],
  }),
});

function ReceiptsTableContent() {
  const initialItemNameFilter =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("item_name") || ""
      : "";

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [itemNameInput, setItemNameInput] = useState(initialItemNameFilter);
  const [itemNameFilter, setItemNameFilter] = useState(initialItemNameFilter);

  const { data: receipts } = useSuspenseQuery(
    getReceiptsQueryOptions(pagination, itemNameFilter),
  );

  const applyItemFilter = () => {
    const nextFilter = itemNameInput.trim();
    setItemNameFilter(nextFilter);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="relative max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          applyItemFilter();
        }}
      >
        <Input
          className="pr-10"
          placeholder="Filter by item name"
          value={itemNameInput}
          onChange={(e) => {
            setItemNameInput(e.target.value);
          }}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
        >
          <ArrowRight className="size-4" />
        </Button>
      </form>

      {receipts.count === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ReceiptText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">
            {itemNameFilter.trim()
              ? "No receipts match this item filter"
              : "You don't have any receipts yet"}
          </h3>
          <p className="text-muted-foreground">
            {itemNameFilter.trim()
              ? "Try changing the filter text."
              : "Add a new receipt to get started"}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={receipts.data}
          manualPagination={true}
          rowCount={receipts.count}
          pageCount={Math.ceil(receipts.count / pagination.pageSize)}
          pagination={pagination}
          onPaginationChange={setPagination}
        />
      )}
    </div>
  );
}

function ReceiptsTable() {
  return (
    <Suspense fallback={<PendingReceipts />}>
      <ReceiptsTableContent />
    </Suspense>
  );
}

function Receipts() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground">
            Create and manage your receipts
          </p>
        </div>
        <Button className="my-4" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2" />
          Add Receipt
        </Button>
      </div>
      <ReceiptsTable />
      {addOpen ? (
        <Suspense fallback={null}>
          <AddReceipt open={addOpen} onOpenChange={setAddOpen} />
        </Suspense>
      ) : null}
    </div>
  );
}
