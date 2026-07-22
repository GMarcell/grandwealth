"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Menu, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <main className="flex-1 bg-background lg:ml-64">
        {/* Mobile header with hamburger */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsMobileOpen(true)}
            className="min-w-11 min-h-11"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="font-bold">GrandWealth</span>
          </div>
        </div>
        <div className="p-3 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
