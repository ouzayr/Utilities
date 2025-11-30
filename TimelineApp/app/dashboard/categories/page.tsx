'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/lib/store';
import { apiService } from '@/services/api.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export default function CategoriesPage() {
  const { data: session } = useSession();
  const { categories, setCategories, deleteCategory } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      if (!session?.user?.id) return;

      setLoading(true);
      try {
        const response = await apiService.getCategories(session.user.id);
        if (response.success && response.data) {
          setCategories(response.data);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [session, setCategories]);

  const handleDelete = async (categoryId: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const response = await apiService.deleteCategory(categoryId);
      if (response.success) {
        deleteCategory(categoryId);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

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
              <h1 className="text-2xl font-bold">Categories</h1>
              <p className="text-sm text-muted-foreground">
                Manage your event categories
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Category
            </Button>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => {
            const IconComponent = (LucideIcons[
              category.icon as keyof typeof LucideIcons
            ] as any) || LucideIcons.Calendar;

            return (
              <Card key={category.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg"
                      style={{ backgroundColor: category.color }}
                    >
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <CardTitle className="mt-4">{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.color}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
