import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Store } from "lucide-react"
import { Suspense } from "react"

import { ShopsService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import PendingShops from "@/components/Pending/PendingShops"
import AddShop from "@/components/Shops/AddShop"
import { columns } from "@/components/Shops/columns"

function getShopsQueryOptions() {
  return {
    queryFn: () => ShopsService.readShops({ skip: 0, limit: 100 }),
    queryKey: ["shops"],
  }
}

export const Route = createFileRoute("/_layout/shops")({
  component: Shops,
  head: () => ({
    meta: [
      {
        title: "Shops - FastAPI Cloud",
      },
    ],
  }),
})

function ShopsTableContent() {
  const { data: shops } = useSuspenseQuery(getShopsQueryOptions())

  if (shops.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Store className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">You don't have any shops yet</h3>
        <p className="text-muted-foreground">Add a new shop to get started</p>
      </div>
    )
  }

  return <DataTable columns={columns} data={shops.data} />
}

function ShopsTable() {
  return (
    <Suspense fallback={<PendingShops />}>
      <ShopsTableContent />
    </Suspense>
  )
}

function Shops() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shops</h1>
          <p className="text-muted-foreground">Create and manage your shops</p>
        </div>
        <AddShop />
      </div>
      <ShopsTable />
    </div>
  )
}
