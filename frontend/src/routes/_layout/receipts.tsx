import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { PaginationState } from "@tanstack/react-table"
import { ReceiptText } from "lucide-react"
import { Suspense, useState } from "react"

import { DataTable } from "@/components/Common/DataTable"
import PendingReceipts from "@/components/Pending/PendingReceipts"
import AddReceipt from "@/components/Receipts/AddReceipt"
import { columns } from "@/components/Receipts/columns"
import { readReceipts } from "@/lib/receiptsApi"

function getReceiptsQueryOptions(pagination: PaginationState) {
  const skip = pagination.pageIndex * pagination.pageSize
  const limit = pagination.pageSize

  return {
    queryFn: () => readReceipts({ skip, limit }),
    queryKey: ["receipts", pagination.pageIndex, pagination.pageSize],
  }
}

export const Route = createFileRoute("/_layout/receipts")({
  component: Receipts,
  head: () => ({
    meta: [
      {
        title: "Receipts - FastAPI Cloud",
      },
    ],
  }),
})

function ReceiptsTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data: receipts } = useSuspenseQuery(
    getReceiptsQueryOptions(pagination),
  )

  if (receipts.count === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <ReceiptText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          You don't have any receipts yet
        </h3>
        <p className="text-muted-foreground">
          Add a new receipt to get started
        </p>
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={receipts.data}
      manualPagination={true}
      rowCount={receipts.count}
      pageCount={Math.ceil(receipts.count / pagination.pageSize)}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  )
}

function ReceiptsTable() {
  return (
    <Suspense fallback={<PendingReceipts />}>
      <ReceiptsTableContent />
    </Suspense>
  )
}

function Receipts() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground">
            Create and manage your receipts
          </p>
        </div>
        <AddReceipt />
      </div>
      <ReceiptsTable />
    </div>
  )
}
