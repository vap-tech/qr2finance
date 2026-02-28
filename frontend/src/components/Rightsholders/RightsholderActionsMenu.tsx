import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { ShopOwnerPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteRightsholder from "./DeleteRightsholder"
import EditRightsholder from "./EditRightsholder"

interface RightsholderActionsMenuProps {
  rightsholder: ShopOwnerPublic
}

export const RightsholderActionsMenu = ({
  rightsholder,
}: RightsholderActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditRightsholder
          rightsholder={rightsholder}
          onSuccess={() => setOpen(false)}
        />
        <DeleteRightsholder
          id={rightsholder.id}
          onSuccess={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
