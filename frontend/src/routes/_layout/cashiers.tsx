import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { PaginationState } from "@tanstack/react-table"
import { Users } from "lucide-react"
import { Suspense, useState } from "react"

import { CashiersService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddCashier from "@/components/Cashiers/AddCashier"
import { columns } from "@/components/Cashiers/columns"
import PendingCashiers from "@/components/Pending/PendingCashiers"

function getCashiersQueryOptions(pagination: PaginationState) {
  const skip = pagination.pageIndex * pagination.pageSize
  const limit = pagination.pageSize

  return {
    queryFn: () => CashiersService.readCashiers({ skip, limit }),
    queryKey: ["cashiers", pagination.pageIndex, pagination.pageSize],
  }
}

export const Route = createFileRoute("/_layout/cashiers")({
  component: Cashiers,
  head: () => ({
    meta: [
      {
        title: "Cashiers - FastAPI Cloud",
      },
    ],
  }),
})

function CashiersTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data: cashiers } = useSuspenseQuery(
    getCashiersQueryOptions(pagination),
  )

  if (cashiers.count === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          You don&apos;t have any cashiers yet
        </h3>
        <p className="text-muted-foreground">
          Add a new cashier to get started
        </p>
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={cashiers.data}
      manualPagination={true}
      rowCount={cashiers.count}
      pageCount={Math.ceil(cashiers.count / pagination.pageSize)}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  )
}

function CashiersTable() {
  return (
    <Suspense fallback={<PendingCashiers />}>
      <CashiersTableContent />
    </Suspense>
  )
}

function Cashiers() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cashiers</h1>
          <p className="text-muted-foreground">
            Create and manage your cashiers
          </p>
        </div>
        <AddCashier />
      </div>
      <CashiersTable />
    </div>
  )
}
