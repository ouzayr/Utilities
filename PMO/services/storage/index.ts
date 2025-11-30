// Data service factory
// Switch between LocalStorage and API implementations here

import LocalStorageService from './LocalStorageService';
import ApiService from './ApiService';
import { IDataService } from './IDataService';

// Configuration - change this to switch between implementations
const USE_API = process.env.NEXT_PUBLIC_USE_API === 'true';

// Export the appropriate service based on configuration
const dataService: IDataService = USE_API ? ApiService : LocalStorageService;

export { dataService, DATA_KEYS } from './IDataService';
export type { IDataService } from './IDataService';
export { LocalStorageService, ApiService };
export default dataService;
