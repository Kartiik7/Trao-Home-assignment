"use client";

import { useState } from "react";
import type { Kit, Question } from "@ai-interview-prep/types";
import { MetaBadge } from "./KitBuilder";
import { RefreshCw, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function QuestionsSection({
  kit,
  kitId,
  onUpdate,
  onKitMerged,
}: {
  kit: Kit;
  kitId: string;
  onUpdate: (q: Question[]) => void;
  onKitMerged: (k: Kit) => void;
}) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Question["category"]>("technical");

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const data = await apiFetch<{ kit: any }>(`/kits/${kitId}/regenerate`, {
        method: "POST",
        body: JSON.stringify({ section: "questions", category: activeCategory }),
      });
      onKitMerged(data.kit.kit_data);
    } catch (err) {
      alert("Failed to regenerate questions.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleTextChange = (id: string, field: "prompt" | "answer_outline", value: string) => {
    const updated = kit.questions.map(q => q.id === id ? { ...q, [field]: value } : q);
    onUpdate(updated);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this question?")) return;
    const updated = kit.questions.filter(q => q.id !== id);
    onUpdate(updated);
  };

  const handleCategoryChange = (id: string, newCategory: Question["category"]) => {
    const updated = kit.questions.map(q => 
      q.id === id 
        ? { ...q, category: newCategory, _meta: { origin: "edited", pinned: true } } 
        : q
    );
    onUpdate(updated);
  };

  const filtered = kit.questions.filter(q => q.category === activeCategory);

  const handleReorder = (id: string, direction: "up" | "down") => {
    const currentFilteredIndex = filtered.findIndex(q => q.id === id);
    if (currentFilteredIndex === -1) return;
    
    const targetFilteredIndex = direction === "up" ? currentFilteredIndex - 1 : currentFilteredIndex + 1;
    if (targetFilteredIndex < 0 || targetFilteredIndex >= filtered.length) return;
    
    const currentGlobalIndex = kit.questions.findIndex(q => q.id === id);
    const targetGlobalIndex = kit.questions.findIndex(q => q.id === filtered[targetFilteredIndex].id);
    
    const updated = [...kit.questions];
    const temp = updated[currentGlobalIndex];
    updated[currentGlobalIndex] = updated[targetGlobalIndex];
    updated[targetGlobalIndex] = temp;
    
    onUpdate(updated);
  };

  const handleAddManual = () => {
    const newQ: Question = {
      id: "q_" + Date.now(),
      category: activeCategory,
      difficulty: 1,
      prompt: "New question prompt...",
      answer_outline: "Answer outline...",
      requirement_ids: [], // User would select these in a real modal
      _meta: { origin: "manual", pinned: true },
    };
    onUpdate([...kit.questions, newQ]);
  };



  return (
    <div className="space-y-4 bg-white p-6 rounded-xl border shadow-sm">
      <div className="flex flex-wrap gap-2 items-center justify-between border-b pb-4">
        <div className="flex gap-2">
          {["technical", "behavioural", "system-design", "company-fit"].map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c as any)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                activeCategory === c ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c.replace("-", " ")}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleAddManual}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <Plus size={14} /> Add Manual
          </button>
          <button 
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
            Regenerate Unpinned
          </button>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        {filtered.map(q => (
          <div key={q.id} className="border rounded-lg p-4 space-y-3 group hover:border-blue-200 transition-colors bg-gray-50/50">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <textarea 
                  className="w-full font-medium text-lg text-gray-900 bg-transparent border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-1 resize-none"
                  value={q.prompt}
                  onChange={(e) => handleTextChange(q.id, "prompt", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <MetaBadge meta={q._meta} />
                <select
                  value={q.category}
                  onChange={(e) => handleCategoryChange(q.id, e.target.value as Question["category"])}
                  className="text-xs bg-gray-100 border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
                >
                  <option value="technical">Technical</option>
                  <option value="behavioural">Behavioural</option>
                  <option value="system-design">System Design</option>
                  <option value="company-fit">Company Fit</option>
                </select>
                <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleReorder(q.id, "up")}
                    className="p-1 text-gray-400 hover:text-black hover:bg-gray-200 rounded transition-colors"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => handleReorder(q.id, "down")}
                    className="p-1 text-gray-400 hover:text-black hover:bg-gray-200 rounded transition-colors"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <button 
                  onClick={() => handleDelete(q.id)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all ml-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Answer Outline</label>
              <textarea 
                  className="w-full text-gray-700 bg-transparent border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-1 text-sm resize-none"
                  value={q.answer_outline}
                  onChange={(e) => handleTextChange(q.id, "answer_outline", e.target.value)}
                  rows={3}
                />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No questions in this category.
          </div>
        )}
      </div>
    </div>
  );
}
