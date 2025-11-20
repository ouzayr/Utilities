'use client';

import { MainEvent, Category } from '@/types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface TimelineItemProps {
  event: MainEvent;
  category?: Category;
  onClick: () => void;
}

export function TimelineItem({ event, category, onClick }: TimelineItemProps) {
  const IconComponent = category?.icon
    ? (LucideIcons[category.icon as keyof typeof LucideIcons] as any)
    : LucideIcons.Calendar;

  const dateFrom = new Date(event.dateFrom);
  const dateTo = new Date(event.dateTo);
  const isSameDay = format(dateFrom, 'yyyy-MM-dd') === format(dateTo, 'yyyy-MM-dd');

  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-6 top-10 h-full w-0.5 bg-border" />

      {/* Icon */}
      <div
        className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-4 border-background"
        style={{ backgroundColor: category?.color || '#6b7280' }}
      >
        {IconComponent && <IconComponent className="h-6 w-6 text-white" />}
      </div>

      {/* Content */}
      <Card className="flex-1 cursor-pointer transition-shadow hover:shadow-md" onClick={onClick}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">{event.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSameDay
                  ? format(dateFrom, 'PPP')
                  : `${format(dateFrom, 'PPP')} - ${format(dateTo, 'PPP')}`}
              </p>
              {category && (
                <span
                  className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: category.color }}
                >
                  {category.name}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        {event.description && (
          <CardContent>
            <div
              className="line-clamp-3 text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: event.description }}
            />
            {event.subEvents.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {event.subEvents.length} sub-event{event.subEvents.length !== 1 ? 's' : ''}
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
