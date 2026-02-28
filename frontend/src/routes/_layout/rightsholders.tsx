import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { PaginationState } from "@tanstack/react-table"
import { Building2 } from "lucide-react"
import { Suspense, useState } from "react"

import { ShopOwnersService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import PendingRightsholders from "@/components/Pending/PendingRightsholders"
import AddRightsholder from "@/components/Rightsholders/AddRightsholder"
import { columns } from "@/components/Rightsholders/columns"

function getRightsholdersQueryOptions(pagination: PaginationState) {
  const skip = pagination.pageIndex * pagination.pageSize
  const limit = pagination.pageSize

  return {
    queryFn: () => ShopOwnersService.readShopOwners({ skip, limit }),
    queryKey: ["rightsholders", pagination.pageIndex, pagination.pageSize],
  }
}

export const Route = createFileRoute("/_layout/rightsholders")({
  component: Rightsholders,
  head: () => ({
    meta: [
      {
        title: "Rightsholders - FastAPI Cloud",
      },
    ],
  }),
})

function RightsholdersTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data: rightsholders } = useSuspenseQuery(
    getRightsholdersQueryOptions(pagination),
  )

  if (rightsholders.count === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          You don&apos;t have any rightsholders yet
        </h3>
        <p className="text-muted-foreground">
          Add a new rightsholder to get started
        </p>
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={rightsholders.data}
      manualPagination={true}
      rowCount={rightsholders.count}
      pageCount={Math.ceil(rightsholders.count / pagination.pageSize)}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  )
}

function RightsholdersTable() {
  return (
    <Suspense fallback={<PendingRightsholders />}>
      <RightsholdersTableContent />
    </Suspense>
  )
}

function Rightsholders() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rightsholders</h1>
          <p className="text-muted-foreground">
            Create and manage your rightsholders
          </p>
        </div>
        <AddRightsholder />
      </div>
      <RightsholdersTable />
    </div>
  )
}
