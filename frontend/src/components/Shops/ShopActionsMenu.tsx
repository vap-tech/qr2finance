import { EllipsisVertical } from "lucide-react";
import { useState } from "react";

import type { ShopRead } from "@/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeleteShop from "./DeleteShop";
import EditShop from "./EditShop";
import ManageShopAddresses from "./ManageShopAddresses";

interface ShopActionsMenuProps {
  shop: ShopRead;
}

export const ShopActionsMenu = ({ shop }: ShopActionsMenuProps) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ManageShopAddresses
          shopId={shop.id}
          shopName={shop.retail_name ?? shop.address ?? "Shop"}
          onSuccess={() => setOpen(false)}
        />
        <EditShop shop={shop} onSuccess={() => setOpen(false)} />
        <DeleteShop id={shop.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
