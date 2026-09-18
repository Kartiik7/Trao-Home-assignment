"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Kit, Question, ItemMeta } from "@ai-interview-prep/types";
import { Pin, Sparkles, Pencil, Hand, Play, ArrowLeft, AlertCircle, X } from "lucide-react";
import QuestionsSection from "./QuestionsSection";
import CompanyBriefSection from "./CompanyBriefSection";
import WeakSpotsSection from "./WeakSpotsSection";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function KitBuilder({ initialKit, kitId }: { initialKit: Kit; kitId: string }) {
  const [kit, setKit] = useState<Kit>(initialKit);
  const [isPatching, setIsPatching] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  // Debounced patch
  const patchTimer = useRef<NodeJS.Timeout>(null);
  const patchQueue = useRef<Promise<void>>(Promise.resolve());
  const patchVersion = useRef(0);
  const pendingUpdates = useRef<Partial<Kit> | null>(null);

  const sendPatch = useCallback((updates: Partial<Kit>, version: number) => {
    patchQueue.current = patchQueue.current.then(async () => {
      try {
        const data = await apiFetch<{ kit: any }>(`/kits/${kitId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
          keepalive: true,
        });
        if (version === patchVersion.current) {
          setKit(data.kit.kit_data);
          setPatchError(null);
        }
      } catch (err: any) {
        console.error("Patch failed, reverting to last saved state", err);
        if (version === patchVersion.current) {
          setPatchError(err?.message || "Failed to save your changes. Reloading last saved version.");
          try {
            const fresh = await apiFetch<{ kit: any }>(`/kits/${kitId}`);
            if (version === patchVersion.current) setKit(fresh.kit.kit_data);
          } catch (refetchErr) {
            console.error("Rollback re-fetch also failed", refetchErr);
          }
        }
      } finally {
        if (version === patchVersion.current) setIsPatching(false);
      }
    });
  }, [kitId]);

  const applyPatch = useCallback((updates: Partial<Kit>) => {
    setKit((prev) => ({ ...prev, ...updates }));

    patchVersion.current += 1;
    const version = patchVersion.current;
    pendingUpdates.current = updates;

    if (patchTimer.current) clearTimeout(patchTimer.current);

    setIsPatching(true);
    patchTimer.current = setTimeout(() => {
      pendingUpdates.current = null;
      sendPatch(updates, version);
    }, 600); // 600ms debounce
  }, [sendPatch]);

  useEffect(() => {
    const flush = () => {
      if (patchTimer.current && pendingUpdates.current) {
        clearTimeout(patchTimer.current);
        sendPatch(pendingUpdates.current, patchVersion.current);
        pendingUpdates.current = null;
      }
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [sendPatch]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <Link href="/kits" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black mb-4 font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{kit.role.title}</h1>
          <p className="text-gray-500">{kit.source.company}</p>
        </div>
        <div className="flex items-center gap-4">
          {isPatching && <span className="text-sm text-gray-400 animate-pulse">Saving...</span>}
          {patchError && (
            <span className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-2.5 py-1 rounded-md">
              <AlertCircle size={14} /> {patchError}
              <button onClick={() => setPatchError(null)} className="ml-1 hover:text-red-800">
                <X size={12} />
              </button>
            </span>
          )}
          <Link 
            href={`/kits/${kitId}/practice`}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Play size={16} /> Start Practice
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Questions</h2>
        <QuestionsSection 
          kit={kit} 
          kitId={kitId}
          onUpdate={(questions) => applyPatch({ questions })} 
          onKitMerged={(newKit) => setKit(newKit)}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Company Insights</h2>
        <CompanyBriefSection 
          kit={kit} 
          kitId={kitId}
          onUpdate={(company_brief) => applyPatch({ company_brief })} 
          onKitMerged={(newKit) => setKit(newKit)}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Weak Spots Report</h2>
        <WeakSpotsSection kitId={kitId} />
      </section>

      {/* Add Flashcards, Schedule rendering here */}
    </div>
  );
}

export function MetaBadge({ meta }: { meta?: ItemMeta }) {
  if (!meta || meta.origin === "generated") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md">
        <Sparkles size={12} /> Generated {meta?.pinned && <Pin size={10} className="ml-1" />}
      </span>
    );
  }
  if (meta.origin === "edited") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-50 text-orange-700 rounded-md">
        <Pencil size={12} /> Edited {meta.pinned && <Pin size={10} className="ml-1" />}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-md">
      <Hand size={12} /> Manual <Pin size={10} className="ml-1" />
    </span>
  );
}
