import type { ColumnDef } from "@tanstack/react-table";

import type { ReceiptItemGroupPublic } from "@/client";

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function formatQuantity(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(3).replace(/\.?0+$/, "");
}

export const columns: ColumnDef<ReceiptItemGroupPublic>[] = [
  {
    id: "row_number",
    header: "#",
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (
        <span className="tabular-nums text-muted-foreground">
          {pageIndex * pageSize + row.index + 1}
        </span>
      );
    },
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "items_count",
    header: "Entries",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.items_count}
      </span>
    ),
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatQuantity(row.original.quantity)}
      </span>
    ),
  },
  {
    accessorKey: "sum",
    header: "Total",
    cell: ({ row }) => (
      <span className="tabular-nums font-semibold">
        {formatMoney(row.original.sum)}
      </span>
    ),
  },
];
