import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ListPlus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { addReceiptItems } from "@/lib/receiptsApi"

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  price: z.string().min(1, { message: "Price is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }),
  sum: z.string().min(1, { message: "Sum is required" }),
  measure: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddReceiptItemsProps {
  receiptId: string
  onSuccess: () => void
}

const AddReceiptItems = ({ receiptId, onSuccess }: AddReceiptItemsProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      price: "",
      quantity: "1",
      sum: "",
      measure: "шт",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      addReceiptItems(receiptId, [
        {
          name: data.name,
          price: Number(data.price),
          quantity: Number(data.quantity),
          sum: Number(data.sum),
          measure: data.measure || undefined,
        },
      ]),
    onSuccess: () => {
      showSuccessToast("Receipt item added successfully")
      setIsOpen(false)
      form.reset({
        name: "",
        price: "",
        quantity: "1",
        sum: "",
        measure: "шт",
      })
      onSuccess()
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : "Request failed")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] })
    },
  })

  const onSubmit = (data: FormData) => {
    const price = Number(data.price)
    const quantity = Number(data.quantity)
    const sum = Number(data.sum)

    if (!Number.isFinite(price) || price <= 0) {
      form.setError("price", { message: "Price must be > 0" })
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      form.setError("quantity", { message: "Quantity must be > 0" })
      return
    }
    if (!Number.isFinite(sum) || sum <= 0) {
      form.setError("sum", { message: "Sum must be > 0" })
      return
    }

    mutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem
        onSelect={(e) => e.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <ListPlus />
        Add Receipt Item
      </DropdownMenuItem>

      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Receipt Item</DialogTitle>
              <DialogDescription>
                Add one more item to this receipt.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Item name" type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Price <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Sum <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Quantity <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0.001}
                          step={0.001}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="measure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Measure</FormLabel>
                      <FormControl>
                        <Input placeholder="шт" type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Save
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default AddReceiptItems
