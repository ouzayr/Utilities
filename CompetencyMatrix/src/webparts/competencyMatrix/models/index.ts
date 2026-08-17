export interface ICompetency {
  id: number;
  title: string;
  description?: string;
}

export interface IStaffCompetencyRef {
  id: number;
  title: string;
}

export interface IStaffMember {
  id: number;
  name: string;
  email?: string;
  role?: string;
  isLeader: boolean;
  competencies: IStaffCompetencyRef[];
}

export interface ICompetencyGroup {
  competency: ICompetency;
  leaders: IStaffMember[];
  members: IStaffMember[];
}
