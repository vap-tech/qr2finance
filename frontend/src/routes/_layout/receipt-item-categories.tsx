import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { PaginationState } from "@tanstack/react-table"
import { FolderTree } from "lucide-react"
import { Suspense, useState } from "react"

import { ReceiptItemCategoriesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import PendingReceiptItemCategories from "@/components/Pending/PendingReceiptItemCategories"
import AddReceiptItemCategory from "@/components/ReceiptItemCategories/AddReceiptItemCategory"
import { columns } from "@/components/ReceiptItemCategories/columns"

function getReceiptItemCategoriesQueryOptions(pagination: PaginationState) {
  const skip = pagination.pageIndex * pagination.pageSize
  const limit = pagination.pageSize

  return {
    queryFn: () =>
      ReceiptItemCategoriesService.readReceiptItemCategories({ skip, limit }),
    queryKey: [
      "receipt-item-categories",
      pagination.pageIndex,
      pagination.pageSize,
    ],
  }
}

export const Route = createFileRoute("/_layout/receipt-item-categories")({
  component: ReceiptItemCategories,
  head: () => ({
    meta: [
      {
        title: "Receipt Item Categories - FastAPI Cloud",
      },
    ],
  }),
})

function ReceiptItemCategoriesTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const { data: categories } = useSuspenseQuery(
    getReceiptItemCategoriesQueryOptions(pagination),
  )

  if (categories.count === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FolderTree className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          You don't have any receipt item categories yet
        </h3>
        <p className="text-muted-foreground">
          Add a new category to get started
        </p>
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={categories.data}
      manualPagination={true}
      rowCount={categories.count}
      pageCount={Math.ceil(categories.count / pagination.pageSize)}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  )
}

function ReceiptItemCategoriesTable() {
  return (
    <Suspense fallback={<PendingReceiptItemCategories />}>
      <ReceiptItemCategoriesTableContent />
    </Suspense>
  )
}

function ReceiptItemCategories() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Receipt Item Categories
          </h1>
          <p className="text-muted-foreground">
            Create and manage your receipt item categories
          </p>
        </div>
        <AddReceiptItemCategory />
      </div>
      <ReceiptItemCategoriesTable />
    </div>
  )
}
