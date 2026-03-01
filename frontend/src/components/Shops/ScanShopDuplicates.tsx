import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScanSearch } from "lucide-react";

import { ShopsService } from "@/client";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import useCustomToast from "@/hooks/useCustomToast";
import { handleError } from "@/utils";

export default function ScanShopDuplicates() {
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useCustomToast();

  const scanNamesMutation = useMutation({
    mutationFn: () => ShopsService.scanNameDuplicates(),
    onSuccess: (result) => {
      showSuccessToast(
        `Name scan completed: ${result.marked}/${result.scanned} marked`,
      );
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
    onError: handleError.bind(showErrorToast),
  });

  const scanAddressesMutation = useMutation({
    mutationFn: () => ShopsService.scanAddressDuplicates(),
    onSuccess: (result) => {
      showSuccessToast(
        `Address scan completed: ${result.marked}/${result.scanned} marked`,
      );
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
    onError: handleError.bind(showErrorToast),
  });

  const isBusy = scanNamesMutation.isPending || scanAddressesMutation.isPending;

  return (
    <div className="flex items-center gap-2">
      <LoadingButton
        variant="outline"
        loading={scanNamesMutation.isPending}
        disabled={isBusy}
        onClick={() => scanNamesMutation.mutate()}
      >
        <ScanSearch className="size-4" />
        Scan Name Duplicates
      </LoadingButton>

      <LoadingButton
        variant="outline"
        loading={scanAddressesMutation.isPending}
        disabled={isBusy}
        onClick={() => scanAddressesMutation.mutate()}
      >
        <ScanSearch className="size-4" />
        Scan Address Duplicates
      </LoadingButton>

      <Button
        variant="ghost"
        size="sm"
        disabled={isBusy}
        onClick={() => queryClient.invalidateQueries({ queryKey: ["shops"] })}
      >
        Refresh
      </Button>
    </div>
  );
}
