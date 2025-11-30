'use client';

import { MainEvent, Category } from '@/types';
import { TimelineItem } from './timeline-item';

interface TimelineProps {
  events: MainEvent[];
  categories: Category[];
  onEventClick: (event: MainEvent) => void;
}

export function Timeline({ events, categories, onEventClick }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium text-muted-foreground">No events yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first event to start building your timeline
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {events.map((event) => {
        const category = categories.find((c) => c.id === event.categoryId);
        return (
          <TimelineItem
            key={event.id}
            event={event}
            category={category}
            onClick={() => onEventClick(event)}
          />
        );
      })}
    </div>
  );
}
