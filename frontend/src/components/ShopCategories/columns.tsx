import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, Check, Copy } from "lucide-react";

import type { ShopCategoryPublic } from "@/client";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";
import { CategoryActionsMenu } from "./CategoryActionsMenu";

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard();
  const isCopied = copiedText === id;

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy ID</span>
      </Button>
    </div>
  );
}

export const columns: ColumnDef<ShopCategoryPublic>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className={cn("font-medium")}>{row.original.name}</span>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) =>
      row.original.is_active ? (
        <div className="inline-flex items-center gap-1 text-emerald-600">
          <BadgeCheck className="size-4" />
          <span className="text-sm">Active</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Inactive</span>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <CategoryActionsMenu category={row.original} />
      </div>
    ),
  },
];
