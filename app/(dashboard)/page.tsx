"use client";

import { useOrganization } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import EmptyOrg from "./_components/empty-org";
import DrawList from "./_components/draw-list";

export default function DashboardPage() {
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  
  const query = {
    search: searchParams.get("search") || undefined,
    favorites: searchParams.get("favorites") || undefined,
  };
  
  return (
    <div className="flex-1 h-[calc(100%-80px)] p-6">
      {!organization ? (
        <EmptyOrg />
      ) : (
        <DrawList orgId={organization.id} query={query} />
      )}
    </div>
  );
}
