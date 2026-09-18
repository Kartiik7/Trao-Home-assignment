"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Target, Activity, AlertCircle, CheckCircle2 } from "lucide-react";

export default function WeakSpotsSection({ kitId }: { kitId: string }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchWeakSpots() {
      try {
        const data = await apiFetch<any>(`/kits/${kitId}/weak-spots`);
        setReport(data);
      } catch (err) {
        console.error("Failed to fetch weak spots", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchWeakSpots();
  }, [kitId]);

  if (loading) {
    return <div className="text-sm text-gray-500 animate-pulse bg-white p-6 rounded-xl border shadow-sm">Loading weak spots...</div>;
  }

  if (error || !report) {
    return <div className="text-sm text-red-500 bg-white p-6 rounded-xl border shadow-sm">Failed to load weak spots report.</div>;
  }

  const { weak_requirements, unpracticed_must_count, overall_readiness_pct } = report;

  // Empty state: if total times practiced across all requirements is 0
  const totalPracticed = weak_requirements.reduce((acc: number, req: any) => acc + req.times_practiced, 0);

  if (totalPracticed === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center text-center space-y-4 py-12">
        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
          <Target size={32} />
        </div>
        <h3 className="text-xl font-bold">You haven't practiced yet!</h3>
        <p className="text-gray-500 max-w-sm">
          Once you complete a practice session, this section will highlight your weak spots so you know exactly what to focus on next.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Activity size={20} className="text-purple-500" /> Overall Readiness
          </h3>
          <p className="text-sm text-gray-500">Based on confidence ratings for Must-Have requirements</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-3xl font-black text-gray-900">{overall_readiness_pct}%</div>
            {unpracticed_must_count > 0 && (
              <div className="text-xs text-orange-600 font-medium">{unpracticed_must_count} must-haves unpracticed</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Ranked Weak Spots</h4>
        <div className="space-y-3">
          {weak_requirements.slice(0, 5).map((req: any, i: number) => (
            <div key={req.requirement_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:border-gray-300 transition-colors gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${req.priority === "must" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {req.priority}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{req.kind}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{req.text}</p>
              </div>
              
              <div className="flex-shrink-0 flex items-center justify-end sm:w-48">
                {req.avg_confidence === null ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    <AlertCircle size={14} /> Not yet practiced
                  </span>
                ) : (
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {req.avg_confidence.toFixed(1)} <span className="text-sm font-normal text-gray-400">/ 3.0</span>
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                      Avg Confidence
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {weak_requirements.length > 5 && (
            <div className="text-center text-xs text-gray-400 pt-2">
              Showing top 5 weakest requirements
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
