"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import qs from "query-string";
import { ChangeEvent, useEffect, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

export const SearchInput = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [value, setValue] = useState("");
  const [debouncedValue] = useDebounceValue(value, 500);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  useEffect(() => {
    const url = qs.stringifyUrl(
      {
        url: "/",
        query: {
          search: debouncedValue,
          favorites: searchParams.get("favorites"),
        },
      },
      { skipEmptyString: true, skipNull: true }
    );

    router.push(url);
  }, [debouncedValue, router, searchParams]);

  return (
    <div className="w-full relative">
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 pointer-events-none" />
      <Input
        className="w-full max-w-[516px] pl-11 h-11 rounded-xl border-gray-300 bg-white shadow-soft 
          focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200
          hover:shadow-md hover:border-gray-400"
        placeholder="Search Draws..."
        onChange={handleChange}
        value={value}
      />
    </div>
  );
};
