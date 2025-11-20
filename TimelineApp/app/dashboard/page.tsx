'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/lib/store';
import { apiService } from '@/services/api.service';
import { Timeline } from '@/components/timeline/timeline';
import { EventFormDialog } from '@/components/events/event-form-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { MainEvent } from '@/types';

export default function DashboardPage() {
  const { data: session } = useSession();
  const {
    events,
    categories,
    setEvents,
    setCategories,
    selectedEvent,
    setSelectedEvent,
    filters,
    setFilters,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [showEventDialog, setShowEventDialog] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!session?.user?.id) return;

      setLoading(true);
      try {
        // Load categories
        const categoriesResponse = await apiService.getCategories(session.user.id);
        if (categoriesResponse.success && categoriesResponse.data) {
          setCategories(categoriesResponse.data);
        }

        // Load events
        const eventsResponse = await apiService.getEvents(session.user.id);
        if (eventsResponse.success && eventsResponse.data) {
          setEvents(eventsResponse.data);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [session, setEvents, setCategories]);

  const handleEventClick = (event: MainEvent) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setShowEventDialog(true);
  };

  // Filter events
  const filteredEvents = events.filter((event) => {
    // Filter by category
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(event.categoryId)) {
      return false;
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query)
      );
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Timeline</h1>
              <p className="text-sm text-muted-foreground">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button onClick={handleCreateEvent}>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </div>

          {/* Search and filters */}
          <div className="mt-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ searchQuery: e.target.value })}
                className="pl-9"
              />
            </div>
            {/* TODO: Add category filter dropdown */}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="container mx-auto px-6 py-8">
        <Timeline
          events={filteredEvents}
          categories={categories}
          onEventClick={handleEventClick}
        />
      </div>

      {/* Event Form Dialog */}
      <EventFormDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        event={selectedEvent}
        categories={categories}
      />
    </div>
  );
}
