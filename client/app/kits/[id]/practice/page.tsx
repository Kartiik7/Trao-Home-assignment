"use client";

import { useEffect, useState, use } from "react";
import { notFound } from "next/navigation";
import PracticeSession from "../../../../components/practice/PracticeSession";
import { NavHeader } from "../../../../components/NavHeader";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  
  const [data, setData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user && !authLoading) {
      setDataLoading(false);
      return;
    }

    if (user) {
      apiFetch<any>(`/kits/${id}/practice`)
        .then((resData) => {
          setData(resData);
        })
        .catch((err) => {
          console.error("Fetch error:", err);
          setError(true);
        })
        .finally(() => {
          setDataLoading(false);
        });
    }
  }, [user, authLoading, id]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex flex-1 min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) return null;

  if (error || !data) {
    notFound();
  }

  return (
    <>
      <NavHeader title="Practice Mode" backHref={`/kits/${id}`} backLabel="Kit Builder" />
      <main className="min-h-screen bg-gray-50 flex flex-col pt-12 pb-20 px-6">
        <PracticeSession 
          flashcards={data.ordered_flashcards} 
          stats={data.stats} 
          kitId={id} 
        />
      </main>
    </>
  );
}
