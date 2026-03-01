import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ReceiptsService, ShopsService } from "@/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useCustomToast from "@/hooks/useCustomToast";
import { handleError } from "@/utils";

interface ChangeReceiptShopProps {
  receiptId: string;
  currentShopId: string | null;
  onSuccess: () => void;
  trigger?: "menu-item" | "button";
}

const SHOPS_PAGE_SIZE = 500;

const ChangeReceiptShop = ({
  receiptId,
  currentShopId,
  onSuccess,
  trigger = "menu-item",
}: ChangeReceiptShopProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState("");
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useCustomToast();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedShopId(currentShopId ?? "");
  }, [isOpen, currentShopId]);

  const shopsQuery = useQuery({
    queryKey: ["shops", "receipt-reassign"],
    queryFn: () => ShopsService.readShops({ skip: 0, limit: SHOPS_PAGE_SIZE }),
    enabled: isOpen,
  });

  const activeShops = useMemo(() => {
    return (shopsQuery.data?.data ?? []).filter((shop) => shop.is_active);
  }, [shopsQuery.data?.data]);

  const mutation = useMutation({
    mutationFn: (shopId: string) =>
      ReceiptsService.updateReceiptShop({
        id: receiptId,
        requestBody: { shop_id: shopId },
      }),
    onSuccess: () => {
      showSuccessToast("Receipt shop updated");
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      onSuccess();
      setIsOpen(false);
    },
    onError: handleError.bind(showErrorToast),
  });

  const isSameShop = selectedShopId !== "" && selectedShopId === currentShopId;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger === "menu-item" ? (
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={() => setIsOpen(true)}
        >
          <PencilLine />
          Change Shop
        </DropdownMenuItem>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
          <PencilLine className="size-4" />
          Change Shop
        </Button>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Receipt Shop</DialogTitle>
          <DialogDescription>
            Select another active shop for this receipt.
          </DialogDescription>
        </DialogHeader>

        {shopsQuery.isLoading && (
          <div className="text-sm text-muted-foreground">Loading shops...</div>
        )}

        {shopsQuery.isError && (
          <div className="text-sm text-destructive">Failed to load shops</div>
        )}

        {!shopsQuery.isLoading && !shopsQuery.isError && (
          <div className="space-y-2">
            <Select value={selectedShopId} onValueChange={setSelectedShopId}>
              <SelectTrigger>
                <SelectValue placeholder="Select shop" />
              </SelectTrigger>
              <SelectContent>
                {activeShops.map((shop) => {
                  const label =
                    shop.retail_name?.trim() ||
                    shop.address?.trim() ||
                    "Unnamed shop";
                  return (
                    <SelectItem key={shop.id} value={shop.id}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <LoadingButton
            loading={mutation.isPending}
            disabled={
              selectedShopId === "" || isSameShop || shopsQuery.isLoading
            }
            onClick={() => mutation.mutate(selectedShopId)}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeReceiptShop;
