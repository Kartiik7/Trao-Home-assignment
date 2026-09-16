"use client";

import { useState, useCallback, useRef } from "react";
import type { Kit, Question, ItemMeta } from "@ai-interview-prep/types";
import { Pin, Sparkles, Pencil, Hand, Play } from "lucide-react";
import QuestionsSection from "./QuestionsSection";
import CompanyBriefSection from "./CompanyBriefSection";
import Link from "next/link";

export default function KitBuilder({ initialKit, kitId }: { initialKit: Kit; kitId: string }) {
  const [kit, setKit] = useState<Kit>(initialKit);
  const [isPatching, setIsPatching] = useState(false);

  // Debounced patch
  const patchTimer = useRef<NodeJS.Timeout>(null);
  
  const applyPatch = useCallback(async (updates: Partial<Kit>) => {
    // Optimistic UI update
    setKit((prev) => ({ ...prev, ...updates }));

    if (patchTimer.current) clearTimeout(patchTimer.current);
    
    setIsPatching(true);
    patchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:5000/kits/${kitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        
        if (!res.ok) throw new Error("Failed to patch kit");
        const data = await res.json();
        // Overwrite with server truth (pins might have been auto-added)
        setKit(data.kit.kit_data);
      } catch (err) {
        console.error("Patch failed, rollback would happen here", err);
        // Simple rollback mechanism not fully robust for multi-edits in real prod, but works for assignment
      } finally {
        setIsPatching(false);
      }
    }, 600); // 600ms debounce
  }, [kitId]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{kit.role.title}</h1>
          <p className="text-gray-500">{kit.source.company}</p>
        </div>
        <div className="flex items-center gap-4">
          {isPatching && <span className="text-sm text-gray-400 animate-pulse">Saving...</span>}
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
