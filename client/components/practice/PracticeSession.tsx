"use client";

import { useState, useEffect, useCallback } from "react";
import type { Flashcard } from "@ai-interview-prep/types";
import { ArrowLeft, Brain, RotateCcw } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface PracticeStats {
  total_cards: number;
  cards_seen: number;
  cards_unseen: number;
  average_confidence: number;
}

export default function PracticeSession({
  flashcards,
  stats,
  kitId,
}: {
  flashcards: Flashcard[];
  stats: PracticeStats;
  kitId: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    if (isFinished || flashcards.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if they are typing in an input somewhere (unlikely in this view, but safe)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.code === "Space" || e.code === "Enter") && !isFlipped) {
        e.preventDefault();
        setIsFlipped(true);
      } else if (isFlipped) {
        if (e.key === "1") handleRate(1);
        else if (e.key === "2") handleRate(2);
        else if (e.key === "3") handleRate(3);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, isFlipped, isFinished, flashcards.length]);

  const handleRate = useCallback(async (confidence: 1 | 2 | 3) => {
    const card = flashcards[currentIndex];
    
    // Fire and forget POST to record progress — auth cookie automatically included
    apiFetch(`/kits/${kitId}/practice`, {
      method: "POST",
      body: JSON.stringify({ flashcard_id: card.id, confidence }),
    }).catch(err => console.error("Failed to record rating", err));

    setIsFlipped(false);
    setSessionCount(prev => prev + 1);

    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, flashcards, kitId]);

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Brain size={48} className="text-gray-300" />
        <h2 className="text-2xl font-bold">No flashcards found.</h2>
        <p className="text-gray-500 max-w-md">
          This kit doesn't have any flashcards yet. Go back to the builder to regenerate or add some manually.
        </p>
        <Link href={`/kits/${kitId}`} className="text-blue-600 hover:underline">
          Back to Builder
        </Link>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
          <Brain size={32} />
        </div>
        <h2 className="text-3xl font-bold">Session Complete!</h2>
        <p className="text-gray-600">
          You reviewed <span className="font-bold text-black">{sessionCount}</span> cards this session.
        </p>
        
        <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-md">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Total Seen</div>
            <div className="text-2xl font-bold">{Math.min(stats.cards_seen + sessionCount, stats.total_cards)} / {stats.total_cards}</div>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Avg Confidence</div>
            <div className="text-2xl font-bold">{stats.average_confidence > 0 ? stats.average_confidence.toFixed(1) : "-"} / 3.0</div>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <Link href={`/kits/${kitId}`} className="px-6 py-2.5 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200">
            Exit to Builder
          </Link>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-black text-white font-medium rounded-lg hover:bg-gray-800 flex items-center gap-2"
          >
            <RotateCcw size={18} /> Review Again
          </button>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 flex flex-col items-center">
      {/* Header & Progress */}
      <div className="w-full flex items-center justify-between mb-4">
        <Link href={`/kits/${kitId}`} className="text-gray-500 hover:text-black flex items-center gap-2 transition-colors">
          <ArrowLeft size={20} /> Back
        </Link>
        <div className="text-sm font-medium text-gray-500">
          Card {currentIndex + 1} of {flashcards.length}
        </div>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div 
          className="bg-black h-2 rounded-full transition-all duration-300" 
          style={{ width: `${((currentIndex) / flashcards.length) * 100}%` }}
        />
      </div>

      {/* Flashcard Area - 3D Flip */}
      <div 
        className="relative w-full aspect-[3/2] cursor-pointer group perspective-1000"
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? "rotate-y-180" : ""}`}>
          
          {/* Front */}
          <div className="absolute inset-0 w-full h-full backface-hidden bg-white border-2 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-semibold tracking-widest text-blue-500 uppercase absolute top-6">Front</span>
            <h3 className="text-2xl md:text-3xl font-medium text-gray-800 leading-relaxed">
              {currentCard.front}
            </h3>
            {!isFlipped && (
              <p className="absolute bottom-6 text-gray-400 text-sm animate-pulse">
                Press Space or Click to reveal
              </p>
            )}
          </div>

          {/* Back */}
          <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gray-50 border-2 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center overflow-y-auto">
            <span className="text-sm font-semibold tracking-widest text-orange-500 uppercase absolute top-6">Back</span>
            <div className="text-xl md:text-2xl text-gray-700 leading-relaxed max-w-prose">
              {currentCard.back}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={`transition-all duration-300 transform w-full ${isFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <p className="text-center text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">How confident were you?</p>
        <div className="grid grid-cols-3 gap-4">
          <button 
            onClick={() => handleRate(1)}
            className="flex flex-col items-center justify-center gap-1 py-4 px-6 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
          >
            <span className="text-lg font-bold">Again</span>
            <span className="text-xs opacity-70">Press 1</span>
          </button>
          <button 
            onClick={() => handleRate(2)}
            className="flex flex-col items-center justify-center gap-1 py-4 px-6 rounded-xl border-2 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
          >
            <span className="text-lg font-bold">Good</span>
            <span className="text-xs opacity-70">Press 2</span>
          </button>
          <button 
            onClick={() => handleRate(3)}
            className="flex flex-col items-center justify-center gap-1 py-4 px-6 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            <span className="text-lg font-bold">Easy</span>
            <span className="text-xs opacity-70">Press 3</span>
          </button>
        </div>
      </div>

    </div>
  );
}
