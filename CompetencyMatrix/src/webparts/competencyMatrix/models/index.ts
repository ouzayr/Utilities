export interface IPerson {
  name: string;
  email?: string;
}

export interface ICompetency {
  id: number;
  title: string;
  description?: string;
  leads: IPerson[];
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

export interface IPersonMatchEntry {
  competencyId: number;
  title: string;
  isLead: boolean;
}

export interface IPersonMatch {
  person: IPerson;
  entries: IPersonMatchEntry[];
}
