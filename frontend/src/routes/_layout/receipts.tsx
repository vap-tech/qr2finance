import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { PaginationState } from "@tanstack/react-table";
import { ArrowRight, Download, Plus, ReceiptText, Upload } from "lucide-react";
import { lazy, Suspense, useRef, useState, type ChangeEvent } from "react";

import { OpenAPI, ReceiptsService, type ReceiptImportSummary } from "@/client";
import { DataTable } from "@/components/Common/DataTable";
import PendingReceipts from "@/components/Pending/PendingReceipts";
import { columns } from "@/components/Receipts/columns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useCustomToast from "@/hooks/useCustomToast";
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { showSuccessToast, showErrorToast } = useCustomToast();
  const queryClient = useQueryClient();

  const getToken = async () => {
    if (typeof OpenAPI.TOKEN === "function") {
      return (await OpenAPI.TOKEN({} as never)) || "";
    }
    return OpenAPI.TOKEN || "";
  };

  const parseError = async (response: Response) => {
    try {
      const payload = (await response.json()) as { detail?: unknown };
      const detail = payload?.detail;
      if (typeof detail === "string") {
        return detail;
      }
    } catch {
      // ignore
    }
    return "Request failed";
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportFrom) params.set("date_from", exportFrom);
      if (exportTo) params.set("date_to", exportTo);
      const url = `${OpenAPI.BASE}/api/v1/receipts/export${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const token = await getToken();
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const blob = await response.blob();
      const filename = `receipts-${new Date()
        .toISOString()
        .slice(0, 10)}.jsonl.zip`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      showSuccessToast("Export is ready. Download should start shortly.");
      setExportOpen(false);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await ReceiptsService.importReceipts({
        formData: { file },
      });
      const summary = result as ReceiptImportSummary;
      showSuccessToast(
        `Imported ${summary.imported}, skipped ${summary.skipped}, failed ${summary.failed}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground">
            Create and manage your receipts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.jsonl,.zip,application/x-ndjson,application/zip"
            className="hidden"
            onChange={handleImportChange}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-2 size-4" />
            {importing ? "Importing..." : "Import"}
          </Button>
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2" />
            Add Receipt
          </Button>
        </div>
      </div>
      <ReceiptsTable />
      {addOpen ? (
        <Suspense fallback={null}>
          <AddReceipt open={addOpen} onOpenChange={setAddOpen} />
        </Suspense>
      ) : null}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export receipts</DialogTitle>
            <DialogDescription>
              Optionally limit the export by date range.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="export-from">From</Label>
              <Input
                id="export-from"
                type="date"
                value={exportFrom}
                onChange={(event) => setExportFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="export-to">To</Label>
              <Input
                id="export-to"
                type="date"
                value={exportTo}
                onChange={(event) => setExportTo(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
