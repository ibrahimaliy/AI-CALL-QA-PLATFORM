"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileCheck2,
  LayoutDashboard,
  PhoneCall,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ClipboardCheck,
  Sliders,
} from "lucide-react";

import { features } from "@/lib/config/features";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  qaOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { name: "Scorecards", href: "/scorecards", icon: FileCheck2, badge: "v1.0", qaOnly: true },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calls", href: "/calls", icon: PhoneCall },
  { name: "QA Reviews", href: "/reviews", icon: ClipboardCheck, badge: "Phase 5A", qaOnly: true },
  { name: "AI Calibration", href: "/reports/ai-calibration", icon: Sliders, qaOnly: true },
  { name: "Agents", href: "/agents", icon: Users },
  { name: "Reports", href: "/reports", icon: BarChart3, qaOnly: true },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navItems = allNavItems.filter((item) => {
    if (item.qaOnly && !features.aiQa) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-slate-100">
      {/* Top Enterprise Banner / Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090e1c]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
                <Sparkles className="w-5 h-5 text-cyan-100" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    CallAudit<span className="text-cyan-400">AI</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                    Enterprise
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Autonomous Quality Assurance Platform
                </p>
              </div>
            </div>

            {/* Middle: Organization & Campaign Badge */}
            <div className="hidden md:flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400">Org:</span>
                <span className="font-medium text-slate-200">Smile Telecom</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Campaign:</span>
                <span className="font-medium text-cyan-300">Inbound Support</span>
              </div>
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg ${
                features.aiQa
                  ? "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
                  : "bg-cyan-950/40 border border-cyan-800/50 text-cyan-300"
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="font-medium">
                  {features.aiQa ? "Scorecard Active (100 pts)" : "Transcription Testing Mode (AI QA Disabled)"}
                </span>
              </div>
            </div>

            {/* Right: Auditor Profile & Session */}
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200">
                  Ayinde Andrea
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-end space-x-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  <span>QA Auditor / Supervisor</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white font-bold text-sm flex items-center justify-center border border-white/20 shadow-md">
                AA
              </div>
            </div>
          </div>

          {/* Sub Navigation Bar */}
          <nav className="flex space-x-1 py-2 overflow-x-auto no-scrollbar border-t border-slate-800/40">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isActive
                          ? "bg-cyan-400/20 text-cyan-200"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-[#080d1a] py-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          <div>
            AI Call Quality Assurance Platform • Configured according to Official QA Specification & Workbook
          </div>
          <div className="flex items-center space-x-3 text-slate-400">
            <span>Deterministic Scoring: <strong className="text-emerald-400 font-mono">100 / 100 pts</strong></span>
            <span>•</span>
            <span>Pass Threshold: <strong className="text-cyan-400 font-mono">71%</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
