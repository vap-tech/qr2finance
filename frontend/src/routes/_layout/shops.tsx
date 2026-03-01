import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { PaginationState } from "@tanstack/react-table";
import { Store } from "lucide-react";
import { Suspense, useState } from "react";

import { ShopsService } from "@/client";
import { DataTable } from "@/components/Common/DataTable";
import PendingShops from "@/components/Pending/PendingShops";
import AddShop from "@/components/Shops/AddShop";
import ScanShopDuplicates from "@/components/Shops/ScanShopDuplicates";
import { columns } from "@/components/Shops/columns";

function getShopsQueryOptions(pagination: PaginationState) {
  const skip = pagination.pageIndex * pagination.pageSize;
  const limit = pagination.pageSize;

  return {
    queryFn: () => ShopsService.readShops({ skip, limit }),
    queryKey: ["shops", pagination.pageIndex, pagination.pageSize],
  };
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
});

function ShopsTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const { data: shops } = useSuspenseQuery(getShopsQueryOptions(pagination));

  if (shops.count === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Store className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">You don't have any shops yet</h3>
        <p className="text-muted-foreground">Add a new shop to get started</p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={shops.data}
      manualPagination={true}
      rowCount={shops.count}
      pageCount={Math.ceil(shops.count / pagination.pageSize)}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  );
}

function ShopsTable() {
  return (
    <Suspense fallback={<PendingShops />}>
      <ShopsTableContent />
    </Suspense>
  );
}

function Shops() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shops</h1>
          <p className="text-muted-foreground">Create and manage your shops</p>
        </div>
        <div className="flex items-center gap-2">
          <ScanShopDuplicates />
          <AddShop />
        </div>
      </div>
      <ShopsTable />
    </div>
  );
}
