import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ListTree } from "lucide-react"
import { useMemo, useState } from "react"

import { type ShopOwnerNamePublic, ShopOwnersService } from "@/client"
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

interface ManageRightsholderNamesProps {
  rightsholderId: string
  rightsholderName: string
  onSuccess: () => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const ManageRightsholderNames = ({
  rightsholderId,
  rightsholderName,
  onSuccess,
}: ManageRightsholderNamesProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const detailsQuery = useQuery({
    queryKey: ["rightsholder", rightsholderId],
    queryFn: () => ShopOwnersService.readShopOwner({ id: rightsholderId }),
    enabled: isOpen,
  })

  const aliases = useMemo<ShopOwnerNamePublic[]>(() => {
    return detailsQuery.data?.aliases ?? []
  }, [detailsQuery.data?.aliases])

  const setPrimaryMutation = useMutation({
    mutationFn: (aliasId: string) =>
      ShopOwnersService.setPrimaryName({
        id: rightsholderId,
        requestBody: { alias_id: aliasId },
      }),
    onSuccess: () => {
      showSuccessToast("Primary name updated")
      queryClient.invalidateQueries({ queryKey: ["rightsholders"] })
      queryClient.invalidateQueries({ queryKey: ["rightsholder", rightsholderId] })
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
        <ListTree />
        Manage Names
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Name Variants</DialogTitle>
          <DialogDescription>
            All names observed for {rightsholderName}. Choose which one is primary.
          </DialogDescription>
        </DialogHeader>

        {detailsQuery.isLoading && (
          <div className="text-sm text-muted-foreground">Loading names...</div>
        )}

        {detailsQuery.isError && (
          <div className="text-sm text-destructive">Failed to load names</div>
        )}

        {detailsQuery.data && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              INN: <span className="font-mono">{detailsQuery.data.inn}</span>
            </div>
            {aliases.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No variants were recorded yet.
              </div>
            ) : (
              aliases.map((alias) => (
                <div
                  key={alias.id}
                  className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium break-all">{alias.name_raw}</span>
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
                  <LoadingButton
                    loading={
                      setPrimaryMutation.isPending &&
                      setPrimaryMutation.variables === alias.id
                    }
                    variant={alias.is_primary ? "outline" : "default"}
                    size="sm"
                    disabled={alias.is_primary}
                    onClick={() => setPrimaryMutation.mutate(alias.id)}
                    className="sm:ml-4"
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

export default ManageRightsholderNames
