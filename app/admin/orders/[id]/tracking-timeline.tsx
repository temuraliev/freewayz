"use client";

interface TrackingEvent {
  date?: string;
  status?: string;
  description?: string;
  location?: string;
}

interface Props {
  events: TrackingEvent[];
  trackingStatus?: string;
}

export function TrackingTimeline({ events, trackingStatus }: Props) {
  if (!events || events.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-medium">
        Трекинг{" "}
        {trackingStatus && (
          <span className="ml-1 text-xs text-muted-foreground">({trackingStatus})</span>
        )}
      </h3>
      <div className="relative border-l-2 border-border pl-4">
        {events.map((ev, i) => (
          <div key={i} className="relative mb-4 last:mb-0">
            <div className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background" />
            <div className="text-sm font-medium">
              {ev.description || ev.status || "Update"}
            </div>
            {ev.location && (
              <div className="text-xs text-muted-foreground">{ev.location}</div>
            )}
            {ev.date && (
              <div className="text-xs text-muted-foreground">
                {new Date(ev.date).toLocaleString("ru-RU")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
