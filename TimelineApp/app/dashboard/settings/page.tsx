'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MediaUploadConfig } from '@/types';

export default function SettingsPage() {
  const [config, setConfig] = useState<MediaUploadConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadConfig = () => {
      try {
        const mediaConfig = apiService.getMediaConfig();
        setConfig(mediaConfig);
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      apiService.updateMediaConfig(config);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
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
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your timeline app preferences
          </p>
        </div>
      </div>

      {/* Settings Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Media Upload Settings</CardTitle>
              <CardDescription>
                Configure limits and restrictions for media uploads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxImageSize">
                  Max Image Size (bytes)
                </Label>
                <Input
                  id="maxImageSize"
                  type="number"
                  value={config.maxImageSize}
                  onChange={(e) =>
                    setConfig({ ...config, maxImageSize: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Current: {(config.maxImageSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxImagesPerEvent">
                  Max Images Per Event
                </Label>
                <Input
                  id="maxImagesPerEvent"
                  type="number"
                  value={config.maxImagesPerEvent}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      maxImagesPerEvent: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowedFormats">
                  Allowed Image Formats (comma-separated)
                </Label>
                <Input
                  id="allowedFormats"
                  type="text"
                  value={config.allowedImageFormats.join(', ')}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      allowedImageFormats: e.target.value
                        .split(',')
                        .map((f) => f.trim()),
                    })
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="allowYouTube"
                  type="checkbox"
                  checked={config.allowYouTube}
                  onChange={(e) =>
                    setConfig({ ...config, allowYouTube: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="allowYouTube">Allow YouTube Embeds</Label>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
