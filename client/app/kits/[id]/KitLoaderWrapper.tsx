"use client";

import { useState, useEffect } from "react";
import KitBuilder from "../../../components/builder/KitBuilder";
import { Loader2, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function KitLoaderWrapper({ initialKitDoc, kitId }: { initialKitDoc: any, kitId: string }) {
  const [kitDoc, setKitDoc] = useState(initialKitDoc);
  const [status, setStatus] = useState(initialKitDoc.status);
  const [errorMsg, setErrorMsg] = useState(initialKitDoc.error);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const { token } = useAuth(); // or grab from cookies if needed

  useEffect(() => {
    if (status === "ready" || status === "failed") return;

    // Polling logic
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/kits/${kitId}/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          
          if (data.status === "failed") {
            setErrorMsg(data.error);
          } else if (data.status === "ready") {
            // Fetch the full kit now that it's ready
            const fullRes = await fetch(`http://localhost:5000/kits/${kitId}`);
            if (fullRes.ok) {
              const fullData = await fullRes.json();
              setKitDoc(fullData.kit);
            }
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, kitId]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`http://localhost:5000/kits/${kitId}/retry`, {
        method: "POST"
      });
      if (res.ok) {
        setStatus("pending");
        setErrorMsg(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRetrying(false);
    }
  };

  if (status === "ready" && kitDoc.kit_data) {
    return <KitBuilder initialKit={kitDoc.kit_data} kitId={kitId} />;
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-6 max-w-lg mx-auto">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Generation Failed</h1>
        <div className="bg-white border border-red-200 text-red-700 p-4 rounded-lg text-sm font-mono text-left w-full shadow-sm overflow-auto">
          {errorMsg || "An unknown error occurred during pipeline execution."}
        </div>
        <div className="flex gap-4">
          <Link href="/kits" className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
            Back to Dashboard
          </Link>
          <button 
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-6 py-2.5 bg-black text-white font-medium rounded-lg hover:bg-gray-800 flex items-center gap-2"
          >
            {isRetrying ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-8 max-w-md mx-auto">
      <Link href="/kits" className="absolute top-8 left-8 flex items-center gap-2 text-gray-500 hover:text-black font-medium transition-colors">
        <ArrowLeft size={18} /> Dashboard
      </Link>
      
      <div className="relative flex items-center justify-center w-24 h-24">
        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <SparklesIcon className="text-gray-400 w-8 h-8 animate-pulse" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Building your kit...</h1>
        <p className="text-gray-500 mt-2 leading-relaxed">
          We are analyzing the job description, researching the company, and generating custom questions and flashcards. This usually takes about 90 seconds.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-4 w-full shadow-sm text-left">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin text-blue-500" />
          <span className="font-medium">Connecting to AI agents...</span>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  );
}
