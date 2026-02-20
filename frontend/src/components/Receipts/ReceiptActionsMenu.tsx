import { EllipsisVertical, Eye, ListPlus, Trash2 } from "lucide-react"
import { lazy, Suspense, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ReceiptShort } from "@/lib/receiptsApi"

const ViewReceipt = lazy(() => import("./ViewReceipt"))
const AddReceiptItems = lazy(() => import("./AddReceiptItems"))
const DeleteReceipt = lazy(() => import("./DeleteReceipt"))

interface ReceiptActionsMenuProps {
  receipt: ReceiptShort
}

export const ReceiptActionsMenu = ({ receipt }: ReceiptActionsMenuProps) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => {
              setMenuOpen(false)
              setViewOpen(true)
            }}
          >
            <Eye />
            View Receipt
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => {
              setMenuOpen(false)
              setAddItemOpen(true)
            }}
          >
            <ListPlus />
            Add Receipt Item
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => e.preventDefault()}
            onClick={() => {
              setMenuOpen(false)
              setDeleteOpen(true)
            }}
          >
            <Trash2 />
            Delete Receipt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {viewOpen ? (
        <Suspense fallback={null}>
          <ViewReceipt
            id={receipt.id}
            open={viewOpen}
            onOpenChange={setViewOpen}
          />
        </Suspense>
      ) : null}

      {addItemOpen ? (
        <Suspense fallback={null}>
          <AddReceiptItems
            receiptId={receipt.id}
            open={addItemOpen}
            onOpenChange={setAddItemOpen}
            onSuccess={() => setMenuOpen(false)}
          />
        </Suspense>
      ) : null}

      {deleteOpen ? (
        <Suspense fallback={null}>
          <DeleteReceipt
            id={receipt.id}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onSuccess={() => setMenuOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  )
}
