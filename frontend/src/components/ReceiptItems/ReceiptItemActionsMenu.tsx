import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisVertical, ReceiptText, Tags } from "lucide-react";
import { useState } from "react";

import { ReceiptItemCategoriesService, ReceiptItemsService } from "@/client";
import type { ReceiptItemGroupPublic } from "@/client";
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
  item: ReceiptItemGroupPublic;
}

export function ReceiptItemActionsMenu({ item }: ReceiptItemActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const href = `/receipts?item_name=${encodeURIComponent(item.name)}`;
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useCustomToast();

  const categoriesQuery = useQuery({
    queryKey: ["receipt-item-categories", "all"],
    queryFn: () =>
      ReceiptItemCategoriesService.readReceiptItemCategories({
        skip: 0,
        limit: 1000,
      }),
    enabled: dialogOpen,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      ReceiptItemsService.replaceReceiptItemsCategoriesByName({
        requestBody: {
          name: item.name,
          category_ids: selectedCategoryIds,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Categories updated for all matching receipt items");
      setDialogOpen(false);
      setMenuOpen(false);
      setSelectedCategoryIds([]);
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-items"] });
      queryClient.invalidateQueries({ queryKey: ["receipt"] });
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
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => setDialogOpen(true)}
          >
            <Tags />
            Assign Categories (by name)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Categories By Name</DialogTitle>
            <DialogDescription>
              This will replace categories for all receipt items with exact
              name:
              <span className="font-medium"> {item.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {categoriesQuery.isPending && (
              <p className="text-sm text-muted-foreground">
                Loading categories...
              </p>
            )}
            {categoriesQuery.isError && (
              <p className="text-sm text-destructive">
                Failed to load categories.
              </p>
            )}
            {!categoriesQuery.isPending && !categoriesQuery.isError && (
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
              disabled={categoriesQuery.isPending}
            >
              Save
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
