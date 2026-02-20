import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import {
  createReceiptFromRawFile,
  createReceiptFromRawJson,
} from "@/lib/receiptsApi"

const rawJsonSchema = z.object({
  payload: z.string().min(1, { message: "Raw JSON is required" }),
})

type RawJsonFormData = z.infer<typeof rawJsonSchema>

const fileSchema = z.object({
  file: z.instanceof(File, { message: "JSON file is required" }),
})

type FileFormData = z.infer<typeof fileSchema>

const AddReceipt = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState("json")
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const jsonForm = useForm<RawJsonFormData>({
    resolver: zodResolver(rawJsonSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      payload: "",
    },
  })

  const fileForm = useForm<FileFormData>({
    resolver: zodResolver(fileSchema),
    mode: "onBlur",
    criteriaMode: "all",
  })

  const jsonMutation = useMutation({
    mutationFn: (payload: unknown) => createReceiptFromRawJson(payload),
    onSuccess: () => {
      showSuccessToast("Receipt created successfully")
      jsonForm.reset()
      fileForm.reset()
      setIsOpen(false)
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : "Request failed")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] })
    },
  })

  const fileMutation = useMutation({
    mutationFn: (file: File) => createReceiptFromRawFile(file),
    onSuccess: () => {
      showSuccessToast("Receipt created successfully")
      jsonForm.reset()
      fileForm.reset()
      setIsOpen(false)
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : "Request failed")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] })
    },
  })

  const onJsonSubmit = (data: RawJsonFormData) => {
    try {
      const parsed = JSON.parse(data.payload)
      jsonMutation.mutate(parsed)
    } catch {
      jsonForm.setError("payload", { message: "Invalid JSON" })
    }
  }

  const onFileSubmit = (data: FileFormData) => {
    fileMutation.mutate(data.file)
  }

  const isPending = jsonMutation.isPending || fileMutation.isPending

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!isPending) {
          setIsOpen(open)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="my-4">
          <Plus className="mr-2" />
          Add Receipt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Receipt</DialogTitle>
          <DialogDescription>
            Import a receipt using raw JSON text or JSON file.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="json">Raw JSON</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="pt-2">
            <Form {...jsonForm}>
              <form onSubmit={jsonForm.handleSubmit(onJsonSubmit)}>
                <div className="grid gap-4 py-2">
                  <FormField
                    control={jsonForm.control}
                    name="payload"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          JSON payload{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <textarea
                            className="border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[260px] w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
                            placeholder='{"ticket":{"document":{"receipt":{...}}}}'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={jsonMutation.isPending}>
                      Cancel
                    </Button>
                  </DialogClose>
                  <LoadingButton type="submit" loading={jsonMutation.isPending}>
                    Save
                  </LoadingButton>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="file" className="pt-2">
            <Form {...fileForm}>
              <form onSubmit={fileForm.handleSubmit(onFileSubmit)}>
                <div className="grid gap-4 py-2">
                  <FormField
                    control={fileForm.control}
                    name="file"
                    render={({ field: { onChange, name, ref } }) => (
                      <FormItem>
                        <FormLabel>
                          JSON file <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            name={name}
                            ref={ref}
                            accept="application/json,.json"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) {
                                onChange(file)
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={fileMutation.isPending}>
                      Cancel
                    </Button>
                  </DialogClose>
                  <LoadingButton type="submit" loading={fileMutation.isPending}>
                    Save
                  </LoadingButton>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default AddReceipt
