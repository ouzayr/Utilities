export interface IPerson {
  name: string;
  email?: string;
}

export interface ICompetency {
  id: number;
  title: string;
  description?: string;
  leads: IPerson[];
  managers: IPerson[];
}

export interface IStaffCompetencyRef {
  id: number;
  title: string;
}

export interface IStaffMember {
  id: number;
  person: IPerson;
  competencies: IStaffCompetencyRef[];
  startDate?: Date;
  endDate?: Date;
}

export interface IPersonSuggestion {
  loginName: string;
  name: string;
  email?: string;
}

export interface ICompetencyGroup {
  competency: ICompetency;
  members: IPerson[];
}

export type PersonRole = 'lead' | 'manager' | 'member';

export interface IPersonMatchEntry {
  competencyId: number;
  title: string;
  role: PersonRole;
}

export interface IPersonMatch {
  person: IPerson;
  entries: IPersonMatchEntry[];
  startDate?: Date;
}

export interface IProfileDetail {
  label: string;
  value: string;
}

export interface IUserProfile {
  jobTitle?: string;
  department?: string;
  mobilePhone?: string;
  businessPhone?: string;
  officeLocation?: string;
  manager?: {
    name: string;
    email?: string;
    jobTitle?: string;
  };
  /** Everything else worth showing, rendered under "additional details". */
  details: IProfileDetail[];
  /** Where the data came from, so the UI can explain an empty profile. */
  source: 'graph' | 'sharepoint' | 'none';
}
