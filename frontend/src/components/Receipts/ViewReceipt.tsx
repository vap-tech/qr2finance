import { useQuery } from "@tanstack/react-query"

import { ReceiptsService } from "@/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

interface ViewReceiptProps {
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(value / 100)
}

const ViewReceipt = ({ id, open, onOpenChange }: ViewReceiptProps) => {
  const query = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => ReceiptsService.readReceipt({ id }),
    enabled: open,
  })

  const receiptData = query.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt Details</DialogTitle>
          <DialogDescription>
            Full receipt with payment totals and all items.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading && (
          <div className="text-sm text-muted-foreground">
            Loading receipt...
          </div>
        )}

        {query.isError && (
          <div className="text-sm text-destructive">Failed to load receipt</div>
        )}

        {receiptData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Date: </span>
                <span>
                  {new Intl.DateTimeFormat("ru-RU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(receiptData.receipt.date_time))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold">
                  {formatMoney(receiptData.receipt.total_sum)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Cash: </span>
                <span>{formatMoney(receiptData.receipt.cash_total_sum)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Card: </span>
                <span>{formatMoney(receiptData.receipt.ecash_total_sum)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Shop: </span>
                <span>
                  {receiptData.shop?.retail_name ||
                    receiptData.shop?.address ||
                    "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Items: </span>
                <span>{receiptData.items.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rightsholder: </span>
                <span>{receiptData.shop_owner?.name || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Cashier: </span>
                <span>{receiptData.cashier?.name || "N/A"}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Receipt Items</h4>
              <div className="space-y-2">
                {receiptData.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="border rounded-md px-3 py-2 text-sm flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {index + 1}. {item.name}
                      </div>
                      <div className="text-muted-foreground">
                        {item.quantity} {item.measure || "шт"} ×{" "}
                        {formatMoney(item.price)}
                      </div>
                    </div>
                    <div className="tabular-nums font-medium whitespace-nowrap">
                      {formatMoney(item.sum)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ViewReceipt
