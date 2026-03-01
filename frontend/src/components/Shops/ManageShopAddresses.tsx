import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, CopyPlus, MapPinHouse } from "lucide-react"
import { useMemo, useState } from "react"

import { type ShopAddressPublic, ShopsService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface ManageShopAddressesProps {
  shopId: string
  shopName: string
  onSuccess: () => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const ManageShopAddresses = ({
  shopId,
  shopName,
  onSuccess,
}: ManageShopAddressesProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const detailsQuery = useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => ShopsService.readShop({ id: shopId }),
    enabled: isOpen,
  })

  const aliases = useMemo<ShopAddressPublic[]>(() => {
    return detailsQuery.data?.addresses ?? []
  }, [detailsQuery.data?.addresses])

  const setPrimaryMutation = useMutation({
    mutationFn: (aliasId: string) =>
      ShopsService.setPrimaryShopAddress({
        id: shopId,
        requestBody: { alias_id: aliasId },
      }),
    onSuccess: () => {
      showSuccessToast("Primary address updated")
      queryClient.invalidateQueries({ queryKey: ["shops"] })
      queryClient.invalidateQueries({ queryKey: ["shop", shopId] })
      onSuccess()
    },
    onError: handleError.bind(showErrorToast),
  })

  const splitMutation = useMutation({
    mutationFn: (aliasId: string) =>
      ShopsService.splitShopByAddress({ id: shopId, aliasId }),
    onSuccess: () => {
      showSuccessToast("Shop duplicate created from address")
      queryClient.invalidateQueries({ queryKey: ["shops"] })
      queryClient.invalidateQueries({ queryKey: ["shop", shopId] })
      onSuccess()
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem
        onSelect={(e) => e.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <MapPinHouse />
        Manage Addresses
      </DropdownMenuItem>

      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Address Variants</DialogTitle>
          <DialogDescription>
            Addresses observed for {shopName}. Set primary or split into duplicate
            shop.
          </DialogDescription>
        </DialogHeader>

        {detailsQuery.isLoading && (
          <div className="text-sm text-muted-foreground">Loading addresses...</div>
        )}

        {detailsQuery.isError && (
          <div className="text-sm text-destructive">Failed to load addresses</div>
        )}

        {detailsQuery.data && (
          <div className="space-y-3">
            {aliases.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No addresses were recorded yet.
              </div>
            ) : (
              aliases.map((alias) => (
                <div
                  key={alias.id}
                  className="rounded-md border p-3 flex flex-col gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium break-all">{alias.address_raw}</span>
                      {alias.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Seen: {alias.seen_count}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last seen: {formatDateTime(alias.last_seen_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <LoadingButton
                      loading={
                        setPrimaryMutation.isPending &&
                        setPrimaryMutation.variables === alias.id
                      }
                      variant={alias.is_primary ? "outline" : "default"}
                      size="sm"
                      disabled={alias.is_primary}
                      onClick={() => setPrimaryMutation.mutate(alias.id)}
                    >
                      {alias.is_primary ? (
                        <>
                          <Check className="size-4" />
                          Selected
                        </>
                      ) : (
                        "Set Primary"
                      )}
                    </LoadingButton>

                    <LoadingButton
                      loading={
                        splitMutation.isPending && splitMutation.variables === alias.id
                      }
                      variant="outline"
                      size="sm"
                      disabled={alias.is_primary}
                      onClick={() => splitMutation.mutate(alias.id)}
                    >
                      <CopyPlus className="size-4" />
                      Create Duplicate
                    </LoadingButton>
                  </div>
                </div>
              ))
            )}

            <div className="pt-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ManageShopAddresses
