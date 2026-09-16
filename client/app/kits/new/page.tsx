"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, FileJson, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

export default function CreateKitPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single mode state
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(7);

  // Bulk mode state
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const data = await apiFetch<{ kitId: string; status: string }>("/kits", {
        method: "POST",
        body: JSON.stringify({ jd, company_url: companyUrl, days }),
      });
      router.push(`/kits/${data.kitId}`);
    } catch (err: any) {
      setError(err.message || "Failed to create kit");
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const text = await file.text();
      const entries = JSON.parse(text);

      if (!Array.isArray(entries)) {
        throw new Error("JSON must be an array of objects.");
      }

      // Basic validation
      for (const entry of entries) {
        if (!entry.jd || !entry.company_url) {
          throw new Error("All entries must have 'jd' and 'company_url'.");
        }
      }

      setBulkProgress({ current: 0, total: entries.length });

      // Staggered loop
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        await apiFetch("/kits", {
          method: "POST",
          body: JSON.stringify({
            jd: entry.jd,
            company_url: entry.company_url,
            days: entry.days || 7,
          }),
        });

        setBulkProgress({ current: i + 1, total: entries.length });
        
        // 2-second stagger to respect LLM rate limits across workers
        if (i < entries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Done
      router.push("/kits");
      
    } catch (err: any) {
      setError(err.message || "Failed to parse JSON.");
      setIsSubmitting(false);
      setBulkProgress(null);
    }
    
    // Clear input
    e.target.value = "";
  };

  return (
    <main className="min-h-screen bg-gray-50 pt-12 pb-20 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div>
          <Link href="/kits" className="inline-flex items-center gap-2 text-gray-500 hover:text-black mb-4 font-medium transition-colors">
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Create New Kit</h1>
          <p className="text-gray-500 mt-1">Generate a custom interview prep kit from a job description.</p>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b bg-gray-50/50">
            <button 
              onClick={() => setMode("single")}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode === "single" ? "text-black border-b-2 border-black bg-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            >
              Single Kit
            </button>
            <button 
              onClick={() => setMode("bulk")}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode === "bulk" ? "text-black border-b-2 border-black bg-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            >
              Bulk Upload
            </button>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            {mode === "single" ? (
              <form onSubmit={handleSubmitSingle} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Company URL</label>
                  <input 
                    type="url" 
                    required
                    placeholder="https://company.com"
                    value={companyUrl}
                    onChange={e => setCompanyUrl(e.target.value)}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black px-4 py-2.5 bg-gray-50 border focus:bg-white transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-2">We'll crawl this site to extract company context and culture.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Job Description</label>
                  <textarea 
                    required
                    placeholder="Paste the full job description here..."
                    value={jd}
                    onChange={e => setJd(e.target.value)}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black px-4 py-3 bg-gray-50 border focus:bg-white transition-colors h-48 resize-none font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Study Days Available</label>
                  <input 
                    type="number" 
                    min="1" max="100"
                    required
                    value={days}
                    onChange={e => setDays(parseInt(e.target.value))}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black px-4 py-2.5 bg-gray-50 border focus:bg-white transition-colors"
                  />
                </div>

                <div className="pt-4 border-t">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-black text-white py-3.5 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-colors shadow-sm"
                  >
                    {isSubmitting ? (
                      <><Loader2 size={18} className="animate-spin" /> Starting Generation...</>
                    ) : (
                      "Generate Interview Kit"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                
                {bulkProgress ? (
                  <div className="space-y-4 w-full max-w-sm">
                    <Loader2 size={48} className="animate-spin mx-auto text-blue-500" />
                    <h3 className="text-xl font-bold">Submitting Bulk Generation</h3>
                    <p className="text-gray-500 font-medium">
                      Submitted {bulkProgress.current} of {bulkProgress.total} kits...
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2 border-4 border-blue-100">
                      <FileJson size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Upload JSON List</h3>
                    <p className="text-gray-500 max-w-sm">
                      Upload an array of job roles to generate multiple kits sequentially. <br/><br/>
                      <code className="text-xs bg-gray-100 text-pink-600 px-2 py-1 rounded block mt-2 text-left">
                        {`[\n  {\n    "jd": "...",\n    "company_url": "..."\n  }\n]`}
                      </code>
                    </p>
                    <div className="pt-4 relative">
                      <input 
                        type="file" 
                        accept="application/json"
                        onChange={handleBulkUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                      <button className="bg-black text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 flex items-center gap-2 shadow-sm pointer-events-none">
                        <Upload size={18} /> Select JSON File
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
