"use client";

import { MissionBar } from "@/components/MissionBar";
import { MissionProvider } from "@/components/MissionContext";
import type { ReactNode } from "react";

export function MissionShell({ children }: { children: ReactNode }) {
  return (
    <MissionProvider>
      <div className="min-h-screen">
        <MissionBar />
        <main>{children}</main>
      </div>
    </MissionProvider>
  );
}
