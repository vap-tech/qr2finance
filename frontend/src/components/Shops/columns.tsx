import type { ColumnDef } from "@tanstack/react-table"
import { BadgeCheck, Check, Copy, Heart, HeartOff } from "lucide-react"

import type { ShopRead } from "@/client"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils"
import { ShopActionsMenu } from "./ShopActionsMenu"

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

export const columns: ColumnDef<ShopRead>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "retail_name",
    header: "Retail Name",
    cell: ({ row }) => {
      const retailName = row.original.retail_name
      return (
        <span className={cn("font-medium", !retailName && "italic text-muted-foreground")}>
          {retailName || "No retail name"}
        </span>
      )
    },
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => {
      const address = row.original.address
      return (
        <span className={cn("max-w-xs truncate block text-muted-foreground", !address && "italic")}>
          {address || "No address"}
        </span>
      )
    },
  },
  {
    accessorKey: "is_favorite",
    header: "Favorite",
    cell: ({ row }) =>
      row.original.is_favorite ? (
        <div className="inline-flex items-center gap-1 text-amber-600">
          <Heart className="size-4 fill-current" />
          <span className="text-sm">Yes</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1 text-muted-foreground">
          <HeartOff className="size-4" />
          <span className="text-sm">No</span>
        </div>
      ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) =>
      row.original.is_active ? (
        <div className="inline-flex items-center gap-1 text-emerald-600">
          <BadgeCheck className="size-4" />
          <span className="text-sm">Active</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Inactive</span>
      ),
  },
  {
    accessorKey: "notes",
    header: "Notes",
    cell: ({ row }) => {
      const notes = row.original.notes
      return (
        <span className={cn("max-w-xs truncate block text-muted-foreground", !notes && "italic")}>
          {notes || "No notes"}
        </span>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ShopActionsMenu shop={row.original} />
      </div>
    ),
  },
]
