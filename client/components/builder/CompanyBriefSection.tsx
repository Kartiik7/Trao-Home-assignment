"use client";

import { useState } from "react";
import type { Kit, CompanyBrief } from "@ai-interview-prep/types";
import { MetaBadge } from "./KitBuilder";
import { RefreshCw } from "lucide-react";

export default function CompanyBriefSection({
  kit,
  kitId,
  onUpdate,
  onKitMerged,
}: {
  kit: Kit;
  kitId: string;
  onUpdate: (brief: CompanyBrief) => void;
  onKitMerged: (k: Kit) => void;
}) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const brief = kit.company_brief;

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch(`http://localhost:5000/kits/${kitId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "company_brief" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Regeneration failed");
      }
      const data = await res.json();
      onKitMerged(data.kit.kit_data);
    } catch (err: any) {
      alert(err.message || "Failed to regenerate brief.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleTextChange = (field: "summary" | "what_they_do", value: string) => {
    onUpdate({ ...brief, [field]: value });
  };

  return (
    <div className="space-y-4 bg-white p-6 rounded-xl border shadow-sm">
      <div className="flex justify-between items-center border-b pb-4">
        <h3 className="font-semibold text-lg flex items-center gap-3">
          Company Brief
          <MetaBadge meta={brief._meta} />
        </h3>
        <button 
          onClick={handleRegenerate}
          disabled={isRegenerating || brief._meta?.pinned}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title={brief._meta?.pinned ? "Cannot regenerate a pinned brief" : "Regenerate brief"}
        >
          <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
          Regenerate
        </button>
      </div>

      <div className="space-y-4 pt-2">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Summary</label>
          <textarea 
            className="w-full text-gray-800 bg-gray-50 hover:bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-3 transition-colors resize-none"
            value={brief.summary}
            onChange={(e) => handleTextChange("summary", e.target.value)}
            rows={4}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">What They Do</label>
          <textarea 
            className="w-full text-gray-800 bg-gray-50 hover:bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-3 transition-colors resize-none"
            value={brief.what_they_do}
            onChange={(e) => handleTextChange("what_they_do", e.target.value)}
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
