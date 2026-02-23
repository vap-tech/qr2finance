import { EllipsisVertical, ReceiptText } from "lucide-react";

import type { ReceiptItemGroupPublic } from "@/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReceiptItemActionsMenuProps {
  item: ReceiptItemGroupPublic;
}

export function ReceiptItemActionsMenu({ item }: ReceiptItemActionsMenuProps) {
  const href = `/receipts?item_name=${encodeURIComponent(item.name)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={href} className="cursor-pointer">
            <ReceiptText />
            Open Receipts With This Item
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
