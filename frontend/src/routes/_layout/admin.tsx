import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { PaginationState } from "@tanstack/react-table";
import { Suspense, useState } from "react";

import { type UserPublic, UsersService } from "@/client";
import AddUser from "@/components/Admin/AddUser";
import { columns, type UserTableData } from "@/components/Admin/columns";
import { DataTable } from "@/components/Common/DataTable";
import PendingUsers from "@/components/Pending/PendingUsers";
import useAuth from "@/hooks/useAuth";

function getUsersQueryOptions(pagination: PaginationState) {
  const skip = pagination.pageIndex * pagination.pageSize;
  const limit = pagination.pageSize;

  return {
    queryFn: () => UsersService.readUsers({ skip, limit }),
    queryKey: ["users", pagination.pageIndex, pagination.pageSize],
  };
}

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  beforeLoad: async () => {
    const user = await UsersService.readUserMe();
    if (!user.is_superuser) {
      throw redirect({
        to: "/",
      });
    }
  },
  head: () => ({
    meta: [
      {
        title: "Admin - FastAPI Cloud",
      },
    ],
  }),
});

function UsersTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const { user: currentUser } = useAuth();
  const { data: users } = useSuspenseQuery(getUsersQueryOptions(pagination));

  const tableData: UserTableData[] = users.data.map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
  }));

  return (
    <DataTable
      columns={columns}
      data={tableData}
      manualPagination={true}
      rowCount={users.count}
      pageCount={Math.ceil(users.count / pagination.pageSize)}
      pagination={pagination}
      onPaginationChange={setPagination}
    />
  );
}

function UsersTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent />
    </Suspense>
  );
}

function Admin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <AddUser />
      </div>
      <UsersTable />
    </div>
  );
}
