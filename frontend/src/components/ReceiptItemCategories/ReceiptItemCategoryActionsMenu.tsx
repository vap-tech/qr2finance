import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { ReceiptItemCategoryPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteReceiptItemCategory from "./DeleteReceiptItemCategory"
import EditReceiptItemCategory from "./EditReceiptItemCategory"

interface ReceiptItemCategoryActionsMenuProps {
  category: ReceiptItemCategoryPublic
}

export const ReceiptItemCategoryActionsMenu = ({
  category,
}: ReceiptItemCategoryActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditReceiptItemCategory category={category} onSuccess={() => setOpen(false)} />
        <DeleteReceiptItemCategory id={category.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
