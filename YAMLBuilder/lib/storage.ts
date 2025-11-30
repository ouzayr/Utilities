import { SavedYAML, YAMLBlock } from './types';

const STORAGE_KEY = 'yaml-builder-saves';

export function saveToLocalStorage(name: string, blocks: YAMLBlock[]): SavedYAML {
  const saves = getAllSaves();
  const existingSave = saves.find(s => s.name === name);

  const savedYAML: SavedYAML = {
    id: existingSave?.id || generateId(),
    name,
    data: blocks,
    createdAt: existingSave?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedSaves = existingSave
    ? saves.map(s => s.id === existingSave.id ? savedYAML : s)
    : [...saves, savedYAML];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSaves));
  return savedYAML;
}

export function getAllSaves(): SavedYAML[] {
  if (typeof window === 'undefined') return [];

  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Error parsing saved data:', error);
    return [];
  }
}

export function loadFromLocalStorage(id: string): SavedYAML | null {
  const saves = getAllSaves();
  return saves.find(s => s.id === id) || null;
}

export function deleteFromLocalStorage(id: string): void {
  const saves = getAllSaves();
  const updatedSaves = saves.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSaves));
}

export function clearAllSaves(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function generateId(): string {
  return `yaml-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
