"use client";

import { useParams } from "next/navigation";

import { RescueWorkspace } from "@/components/rescue/RescueWorkspace";

export default function RescuePage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = typeof params.incidentId === "string" ? params.incidentId : "";
  if (incidentId === "") {
    return null;
  }
  return <RescueWorkspace incidentId={incidentId} />;
}
