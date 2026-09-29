"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else {
      router.replace("/kits");
    }
  }, [user, loading, router]);

  // Show a spinner while the auth check resolves (this page is purely a redirect gate)
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400" />
    </div>
  );
}
