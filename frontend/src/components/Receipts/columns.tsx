import type { ColumnDef } from "@tanstack/react-table"
import { Banknote, CreditCard, Wallet } from "lucide-react"

import type { ReceiptShort } from "@/lib/receiptsApi"
import { ReceiptActionsMenu } from "./ReceiptActionsMenu"

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(value / 100)
}

function getPaymentKind(cashTotalSum: number, ecashTotalSum: number) {
  if (cashTotalSum > 0 && ecashTotalSum > 0) {
    return {
      label: "Mixed",
      icon: Wallet,
      className: "text-amber-600",
    }
  }
  if (cashTotalSum > 0) {
    return {
      label: "Cash",
      icon: Banknote,
      className: "text-emerald-600",
    }
  }
  if (ecashTotalSum > 0) {
    return {
      label: "Card",
      icon: CreditCard,
      className: "text-sky-600",
    }
  }
  return {
    label: "Unknown",
    icon: Wallet,
    className: "text-muted-foreground",
  }
}

export const columns: ColumnDef<ReceiptShort>[] = [
  {
    id: "row_number",
    header: "#",
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination
      return (
        <span className="tabular-nums text-muted-foreground">
          {pageIndex * pageSize + row.index + 1}
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
    accessorKey: "items_count",
    header: "Items",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.items_count}
      </span>
    ),
  },
  {
    id: "payment_kind",
    header: "Payment",
    cell: ({ row }) => {
      const kind = getPaymentKind(
        row.original.cash_total_sum,
        row.original.ecash_total_sum,
      )
      const Icon = kind.icon
      return (
        <span className={`inline-flex items-center gap-1 ${kind.className}`}>
          <Icon className="size-4" />
          <span className="text-sm">{kind.label}</span>
        </span>
      )
    },
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
