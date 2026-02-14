import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { CashierPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteCashier from "./DeleteCashier"
import EditCashier from "./EditCashier"

interface CashierActionsMenuProps {
  cashier: CashierPublic
}

export const CashierActionsMenu = ({ cashier }: CashierActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditCashier cashier={cashier} onSuccess={() => setOpen(false)} />
        <DeleteCashier id={cashier.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
