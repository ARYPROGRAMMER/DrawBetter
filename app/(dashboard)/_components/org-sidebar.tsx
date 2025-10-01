"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrganizationSwitcher, UserButton, useOrganization } from "@clerk/nextjs";
import { LayoutDashboard, Star } from "lucide-react";
import { Poppins } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";

const font = Poppins({
  subsets: ["latin"],
  weight: ["600"],
});

const OrgSidebar = () => {
  const searchParams = useSearchParams();
  const favorites = searchParams.get("favorites");
  const { isLoaded } = useOrganization();

  return (
    <div className="hidden lg:flex flex-col space-y-6 w-[206px] pl-5 pt-5">
      <Link href="/">
        <div className="flex items-center gap-x-2">
          <Image src="/onlylogo.svg" alt="Logo" width={60} height={60} />

          <span className={cn("font-semibold text-2xl", font.className)}>
            Draw Better
          </span>
        </div>
      </Link>

      {/* Conditional rendering: OrganizationSwitcher if organizations are enabled, UserButton otherwise */}
      <div className="flex justify-center">
        {isLoaded ? (
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                rootBox: {
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                },
                organizationSwitcherTrigger: {
                  padding: "6px",
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  justifyContent: "space-between",
                  backgroundColor: "white",
                },
              },
            }}
          />
        ) : (
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: {
                  width: "40px",
                  height: "40px",
                },
              },
            }}
          />
        )}
      </div>
      <div className="space-y-1 w-full opeaci">
        <Button
          variant={favorites ? "ghost" : "secondary"}
          asChild
          size={"lg"}
          className="font-normal justify-start px-2 w-full"
        >
          <Link href="/">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Team Draws
          </Link>
        </Button>
        <Button
          variant={favorites ? "secondary" : "ghost"}
          asChild
          size={"lg"}
          className="font-normal justify-start px-2 w-full"
        >
          <Link href="/?favorites=true">
            <Star className="h-4 w-4 mr-2" />
            Favorite Draws
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default OrgSidebar;
