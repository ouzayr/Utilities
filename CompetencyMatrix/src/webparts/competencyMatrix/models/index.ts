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
