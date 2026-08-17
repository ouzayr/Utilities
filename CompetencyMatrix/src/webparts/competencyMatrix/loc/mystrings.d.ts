declare interface ICompetencyMatrixWebPartStrings {
  PropertyPaneDescription: string;
  GeneralGroupName: string;
  CompetenciesGroupName: string;
  StaffGroupName: string;
  TitleFieldLabel: string;
  CompetenciesListFieldLabel: string;
  CompetencyDescriptionFieldLabel: string;
  StaffListFieldLabel: string;
  StaffNameFieldLabel: string;
  StaffNameIsPersonLabel: string;
  StaffNameIsPersonOn: string;
  StaffNameIsPersonOff: string;
  CompetencyLookupFieldLabel: string;
  RoleFieldLabel: string;
  LeaderRoleValueLabel: string;
  OptionalFieldDescription: string;
  DefaultTitle: string;
  SearchPlaceholder: string;
  FilterLabel: string;
  AllCompetenciesOption: string;
  LoadingText: string;
  LoadErrorText: string;
  LeadersSectionLabel: string;
  StaffSectionLabel: string;
  NoLeadersText: string;
  NoStaffText: string;
  NoCompetenciesText: string;
  NoSearchResultsText: string;
  NoCompetencyForPersonText: string;
  LeaderBadgeText: string;
  CompetenciesCountLabel: string;
  StaffCountLabel: string;
}

declare module 'CompetencyMatrixWebPartStrings' {
  const strings: ICompetencyMatrixWebPartStrings;
  export = strings;
}
