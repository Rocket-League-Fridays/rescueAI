"use client";

import { useParams } from "next/navigation";

import { LocateWorkspace } from "@/components/locate/LocateWorkspace";

// Client component + `useParams` on purpose: the map cannot server-render, and this avoids
// Next 15's async `params` promise entirely.
export default function LocatePage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = typeof params.incidentId === "string" ? params.incidentId : null;
  return <LocateWorkspace incidentId={incidentId} />;
}
