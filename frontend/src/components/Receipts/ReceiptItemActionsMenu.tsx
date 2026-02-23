import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisVertical, Tags } from "lucide-react";
import { useEffect, useState } from "react";

import { ReceiptItemCategoriesService, ReceiptItemsService } from "@/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingButton } from "@/components/ui/loading-button";
import useCustomToast from "@/hooks/useCustomToast";
import { handleError } from "@/utils";

interface ReceiptItemActionsMenuProps {
  receiptId: string;
  itemId: string;
  itemName: string;
}

export function ReceiptItemActionsMenu({
  receiptId,
  itemId,
  itemName,
}: ReceiptItemActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useCustomToast();

  const itemQuery = useQuery({
    queryKey: ["receipt-item", itemId],
    queryFn: () => ReceiptItemsService.readReceiptItem({ itemId }),
    enabled: dialogOpen,
  });

  const categoriesQuery = useQuery({
    queryKey: ["receipt-item-categories", "all"],
    queryFn: () =>
      ReceiptItemCategoriesService.readReceiptItemCategories({
        skip: 0,
        limit: 1000,
      }),
    enabled: dialogOpen,
  });

  useEffect(() => {
    if (!dialogOpen) {
      setInitialized(false);
      return;
    }
    if (!itemQuery.data || initialized) {
      return;
    }
    setSelectedCategoryIds(itemQuery.data.category_ids ?? []);
    setInitialized(true);
  }, [dialogOpen, initialized, itemQuery.data]);

  const mutation = useMutation({
    mutationFn: async () =>
      ReceiptItemsService.replaceReceiptItemCategories({
        itemId,
        requestBody: { category_ids: selectedCategoryIds },
      }),
    onSuccess: () => {
      showSuccessToast("Categories updated successfully");
      setDialogOpen(false);
      setMenuOpen(false);
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["receipt-item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["receipt-items"] });
    },
  });

  const toggleCategory = (categoryId: string, checked: boolean) => {
    setSelectedCategoryIds((prev) => {
      if (checked) {
        if (prev.includes(categoryId)) {
          return prev;
        }
        return [...prev, categoryId];
      }
      return prev.filter((id) => id !== categoryId);
    });
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <EllipsisVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => setDialogOpen(true)}
          >
            <Tags />
            Assign Categories
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Categories</DialogTitle>
            <DialogDescription>{itemName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {(itemQuery.isPending || categoriesQuery.isPending) && (
              <p className="text-sm text-muted-foreground">Loading categories...</p>
            )}

            {(itemQuery.isError || categoriesQuery.isError) && (
              <p className="text-sm text-destructive">
                Failed to load categories for this item.
              </p>
            )}

            {!itemQuery.isPending &&
              !categoriesQuery.isPending &&
              !itemQuery.isError &&
              !categoriesQuery.isError && (
                <div className="space-y-1 rounded-md border p-3 max-h-56 overflow-y-auto">
                  {categoriesQuery.data?.data.length ? (
                    categoriesQuery.data.data.map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center gap-2 py-1 text-sm"
                      >
                        <Checkbox
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={(checked) =>
                            toggleCategory(category.id, checked === true)
                          }
                        />
                        <span>{category.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No categories found. Create categories first.
                    </p>
                  )}
                </div>
              )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={mutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <LoadingButton
              onClick={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={itemQuery.isPending || categoriesQuery.isPending}
            >
              Save
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
