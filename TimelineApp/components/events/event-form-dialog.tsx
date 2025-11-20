'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { MainEvent, Category, SubEvent, Media } from '@/types';
import { apiService } from '@/services/api.service';
import { useAppStore } from '@/lib/store';
import { Plus, Trash2, Upload, Youtube } from 'lucide-react';

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: MainEvent | null;
  categories: Category[];
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  categories,
}: EventFormDialogProps) {
  const { data: session } = useSession();
  const { addEvent, updateEvent } = useAppStore();

  const [title, setTitle] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<Media[]>([]);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDateFrom(event.dateFrom.split('T')[0]);
      setDateTo(event.dateTo.split('T')[0]);
      setCategoryId(event.categoryId);
      setDescription(event.description);
      setMedia(event.media || []);
      setSubEvents(event.subEvents || []);
    } else {
      // Reset form
      setTitle('');
      setDateFrom('');
      setDateTo('');
      setCategoryId(categories[0]?.id || '');
      setDescription('');
      setMedia([]);
      setSubEvents([]);
    }
  }, [event, categories, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    setLoading(true);

    try {
      const eventData = {
        userId: session.user.id,
        title,
        dateFrom: new Date(dateFrom).toISOString(),
        dateTo: new Date(dateTo).toISOString(),
        categoryId,
        description,
        media,
        subEvents,
      };

      if (event) {
        // Update existing event
        const response = await apiService.updateEvent(event.id, eventData);
        if (response.success && response.data) {
          updateEvent(response.data);
          onOpenChange(false);
        }
      } else {
        // Create new event
        const response = await apiService.createEvent(eventData);
        if (response.success && response.data) {
          addEvent(response.data);
          onOpenChange(false);
        }
      }
    } catch (error) {
      console.error('Failed to save event:', error);
      alert('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleAddYouTube = () => {
    if (!youtubeUrl) return;

    const newMedia: Media = {
      id: `media-${Date.now()}`,
      type: 'youtube',
      url: youtubeUrl,
      uploadedAt: new Date().toISOString(),
    };

    setMedia([...media, newMedia]);
    setYoutubeUrl('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newMedia: Media = {
          id: `media-${Date.now()}-${Math.random()}`,
          type: 'image',
          url: e.target?.result as string,
          uploadedAt: new Date().toISOString(),
        };
        setMedia((prev) => [...prev, newMedia]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMedia(media.filter((m) => m.id !== mediaId));
  };

  const handleAddSubEvent = () => {
    const newSubEvent: SubEvent = {
      id: `sub-${Date.now()}`,
      title: '',
      date: dateFrom || new Date().toISOString().split('T')[0],
      description: '',
      media: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSubEvents([...subEvents, newSubEvent]);
  };

  const handleUpdateSubEvent = (index: number, field: keyof SubEvent, value: any) => {
    const updated = [...subEvents];
    updated[index] = { ...updated[index], [field]: value };
    setSubEvents(updated);
  };

  const handleRemoveSubEvent = (index: number) => {
    setSubEvents(subEvents.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create New Event'}</DialogTitle>
          <DialogDescription>
            {event ? 'Update your event details' : 'Add a new moment to your timeline'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From *</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To *</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Describe your event..."
            />
          </div>

          {/* Media */}
          <div className="space-y-2">
            <Label>Media</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </Button>
              <Input
                placeholder="YouTube URL"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={handleAddYouTube}>
                <Youtube className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>

            {/* Media Preview */}
            {media.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="relative">
                    {m.type === 'image' ? (
                      <img
                        src={m.url}
                        alt="Uploaded"
                        className="h-24 w-full rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded bg-muted">
                        <Youtube className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 h-6 w-6"
                      onClick={() => handleRemoveMedia(m.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub Events */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sub-Events</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSubEvent}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Sub-Event
              </Button>
            </div>

            {subEvents.map((subEvent, index) => (
              <div key={subEvent.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <Input
                    placeholder="Sub-event title"
                    value={subEvent.title}
                    onChange={(e) =>
                      handleUpdateSubEvent(index, 'title', e.target.value)
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSubEvent(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  type="date"
                  value={subEvent.date.split('T')[0]}
                  onChange={(e) =>
                    handleUpdateSubEvent(
                      index,
                      'date',
                      new Date(e.target.value).toISOString()
                    )
                  }
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
