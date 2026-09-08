import { CompetencyService } from '../services/CompetencyService';
import { ProfileService } from '../services/ProfileService';

export interface ICompetencyMatrixProps {
  title: string;
  service: CompetencyService;
  profileService: ProfileService;
  isDarkTheme: boolean;
}
