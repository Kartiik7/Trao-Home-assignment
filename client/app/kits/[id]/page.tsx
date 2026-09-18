"use client";

import { useEffect, useState, use } from "react";
import { notFound, useRouter } from "next/navigation";
import KitLoaderWrapper from "./KitLoaderWrapper";
import { NavHeader } from "../../../components/NavHeader";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [kitDoc, setKitDoc] = useState<any>(null);
  const [kitLoading, setKitLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user && !authLoading) {
      setKitLoading(false);
      return;
    }

    if (user) {
      apiFetch<{ kit: any }>(`/kits/${id}`)
        .then((data) => {
          setKitDoc(data.kit);
        })
        .catch((err) => {
          console.error("Fetch error:", err);
          setError(true);
        })
        .finally(() => {
          setKitLoading(false);
        });
    }
  }, [user, authLoading, id]);

  if (authLoading || kitLoading) {
    return (
      <div className="flex flex-1 min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) return null;

  if (error || !kitDoc) {
    notFound();
  }

  // Delegate entirely to KitLoaderWrapper to handle optimistic swaps
  return (
    <>
      <NavHeader title="Kit Builder" backHref="/kits" backLabel="Dashboard" />
      <main className="min-h-screen bg-gray-50 pt-8 pb-20">
        <KitLoaderWrapper initialKitDoc={kitDoc} kitId={id} />
      </main>
    </>
  );
}
