"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { LogOut, ChevronLeft } from "lucide-react";

interface NavHeaderProps {
  title?: string;
  backHref?: string;
  backLabel?: string;
}

export function NavHeader({ title, backHref, backLabel }: NavHeaderProps) {
  const { logout, user } = useAuth();

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {backHref && (
            <Link 
              href={backHref}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black transition-colors"
            >
              <ChevronLeft size={16} />
              {backLabel || "Back"}
            </Link>
          )}
          {title && (
            <>
              {backHref && <div className="w-px h-4 bg-gray-300" />}
              <span className="font-semibold text-gray-900">{title}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm font-medium text-gray-600 hidden sm:inline-block">
              {user.email}
            </span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors bg-gray-50 hover:bg-red-50 px-3 py-1.5 rounded-md"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
