import type { ColumnDef } from "@tanstack/react-table"
import { BadgeCheck, Heart, HeartOff } from "lucide-react"

import type { ShopRead } from "@/client"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ShopActionsMenu } from "./ShopActionsMenu"

const ADDRESS_PREVIEW_LIMIT = 10
const RETAIL_NAME_PREVIEW_LIMIT = 25
const RIGHTSHOLDER_PREVIEW_LIMIT = 25

export const columns: ColumnDef<ShopRead>[] = [
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
    accessorKey: "retail_name",
    header: "Retail Name",
    cell: ({ row }) => {
      const retailName = row.original.retail_name
      if (!retailName) {
        return (
          <span className="font-medium italic text-muted-foreground">
            No retail name
          </span>
        )
      }

      const preview =
        retailName.length > RETAIL_NAME_PREVIEW_LIMIT
          ? `${retailName.slice(0, RETAIL_NAME_PREVIEW_LIMIT)}...`
          : retailName

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="max-w-xs truncate block cursor-help font-medium">
              {preview}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{retailName}</TooltipContent>
        </Tooltip>
      )
    },
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => {
      const address = row.original.address
      if (!address) {
        return (
          <span className="max-w-xs truncate block text-muted-foreground italic">
            No address
          </span>
        )
      }

      const preview =
        address.length > ADDRESS_PREVIEW_LIMIT
          ? `${address.slice(0, ADDRESS_PREVIEW_LIMIT)}...`
          : address

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="max-w-xs truncate block cursor-help text-muted-foreground">
              {preview}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{address}</TooltipContent>
        </Tooltip>
      )
    },
  },
  {
    accessorKey: "shop_owner",
    header: "Rightsholder",
    cell: ({ row }) => {
      const rightsholder = row.original.shop_owner?.name
      if (!rightsholder) {
        return (
          <span className="max-w-xs truncate block text-muted-foreground italic">
            No rightsholder
          </span>
        )
      }

      const preview =
        rightsholder.length > RIGHTSHOLDER_PREVIEW_LIMIT
          ? `${rightsholder.slice(0, RIGHTSHOLDER_PREVIEW_LIMIT)}...`
          : rightsholder

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="max-w-xs truncate block cursor-help text-muted-foreground">
              {preview}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{rightsholder}</TooltipContent>
        </Tooltip>
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
        <span
          className={cn(
            "max-w-xs truncate block text-muted-foreground",
            !notes && "italic",
          )}
        >
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
