import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { deleteReceipt } from "@/lib/receiptsApi"

interface DeleteReceiptProps {
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const DeleteReceipt = ({
  id,
  open,
  onOpenChange,
  onSuccess,
}: DeleteReceiptProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { handleSubmit } = useForm()

  const mutation = useMutation({
    mutationFn: () => deleteReceipt(id),
    onSuccess: () => {
      showSuccessToast("The receipt was deleted successfully")
      onOpenChange(false)
      onSuccess()
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : "Request failed")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] })
    },
  })

  const onSubmit = async () => {
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Delete Receipt</DialogTitle>
            <DialogDescription>
              This receipt and all its items will be permanently deleted. Are
              you sure?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={mutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <LoadingButton
              variant="destructive"
              type="submit"
              loading={mutation.isPending}
            >
              Delete
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteReceipt
