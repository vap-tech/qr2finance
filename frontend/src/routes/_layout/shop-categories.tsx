import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FolderTree } from "lucide-react"
import { Suspense } from "react"

import { ShopCategoriesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import PendingShopCategories from "@/components/Pending/PendingShopCategories"
import AddCategory from "@/components/ShopCategories/AddCategory"
import { columns } from "@/components/ShopCategories/columns"

function getShopCategoriesQueryOptions() {
  return {
    queryFn: () =>
      ShopCategoriesService.readShopCategories({ skip: 0, limit: 100 }),
    queryKey: ["shop-categories"],
  }
}

export const Route = createFileRoute("/_layout/shop-categories")({
  component: ShopCategories,
  head: () => ({
    meta: [
      {
        title: "Shop Categories - FastAPI Cloud",
      },
    ],
  }),
})

function ShopCategoriesTableContent() {
  const { data: categories } = useSuspenseQuery(getShopCategoriesQueryOptions())

  if (categories.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FolderTree className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          You don't have any shop categories yet
        </h3>
        <p className="text-muted-foreground">Add a new category to get started</p>
      </div>
    )
  }

  return <DataTable columns={columns} data={categories.data} />
}

function ShopCategoriesTable() {
  return (
    <Suspense fallback={<PendingShopCategories />}>
      <ShopCategoriesTableContent />
    </Suspense>
  )
}

function ShopCategories() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shop Categories</h1>
          <p className="text-muted-foreground">
            Create and manage your shop categories
          </p>
        </div>
        <AddCategory />
      </div>
      <ShopCategoriesTable />
    </div>
  )
}
