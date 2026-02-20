import type { ColumnDef } from "@tanstack/react-table"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import type { ReceiptShort } from "@/lib/receiptsApi"
import { ReceiptActionsMenu } from "./ReceiptActionsMenu"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy ID</span>
      </Button>
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(value / 100)
}

export const columns: ColumnDef<ReceiptShort>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "date_time",
    header: "Date",
    cell: ({ row }) => {
      const value = row.original.date_time
      return (
        <span className="text-sm">
          {new Intl.DateTimeFormat("ru-RU", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value))}
        </span>
      )
    },
  },
  {
    accessorKey: "shop_display",
    header: "Shop",
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.shop_display || row.original.shop?.address || "Unknown"}
      </span>
    ),
  },
  {
    accessorKey: "items_count",
    header: "Items",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.items_count}
      </span>
    ),
  },
  {
    accessorKey: "total_sum",
    header: "Total",
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold">
        {formatMoney(row.original.total_sum)}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ReceiptActionsMenu receipt={row.original} />
      </div>
    ),
  },
]
