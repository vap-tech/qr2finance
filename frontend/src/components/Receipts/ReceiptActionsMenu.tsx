import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ReceiptShort } from "@/lib/receiptsApi"
import AddReceiptItems from "./AddReceiptItems"
import DeleteReceipt from "./DeleteReceipt"

interface ReceiptActionsMenuProps {
  receipt: ReceiptShort
}

export const ReceiptActionsMenu = ({ receipt }: ReceiptActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <AddReceiptItems
          receiptId={receipt.id}
          onSuccess={() => setOpen(false)}
        />
        <DeleteReceipt id={receipt.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
