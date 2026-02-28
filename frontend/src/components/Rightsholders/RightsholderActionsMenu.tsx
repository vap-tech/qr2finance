import { EllipsisVertical } from "lucide-react";
import { useState } from "react";

import type { ShopOwnerPublic } from "@/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeleteRightsholder from "./DeleteRightsholder";
import EditRightsholder from "./EditRightsholder";
import ManageRightsholderNames from "./ManageRightsholderNames";

interface RightsholderActionsMenuProps {
  rightsholder: ShopOwnerPublic;
}

export const RightsholderActionsMenu = ({
  rightsholder,
}: RightsholderActionsMenuProps) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ManageRightsholderNames
          rightsholderId={rightsholder.id}
          rightsholderName={rightsholder.name}
          onSuccess={() => setOpen(false)}
        />
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
  );
};
