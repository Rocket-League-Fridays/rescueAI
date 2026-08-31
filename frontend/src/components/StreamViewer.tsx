"use client";

interface StreamViewerProps {
  jobId?: string | null;
  hasVideo?: boolean;
}

export function StreamViewer({ jobId, hasVideo = false }: StreamViewerProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <FeedPanel
        title="Raw feed"
        emptyLabel={hasVideo ? "Video queued — decoder not wired yet" : "No raw video attached"}
        jobId={jobId}
      />
      <FeedPanel
        title="Processed overlay"
        emptyLabel="SAHI / YOLO overlay will render here"
        jobId={jobId}
      />
    </section>
  );
}

function FeedPanel({
  title,
  emptyLabel,
  jobId,
}: {
  title: string;
  emptyLabel: string;
  jobId?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-olive-700 bg-tactical-800">
      <header className="flex items-center justify-between border-b border-olive-800 px-3 py-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-olive-200">{title}</h3>
        <span className="font-mono text-[10px] text-olive-500">
          {jobId ? `JOB ${jobId.slice(0, 8)}` : "STANDBY"}
        </span>
      </header>
      <div className="flex aspect-video items-center justify-center bg-black/60">
        <p className="px-4 text-center font-mono text-xs text-olive-400">{emptyLabel}</p>
      </div>
    </div>
  );
}
