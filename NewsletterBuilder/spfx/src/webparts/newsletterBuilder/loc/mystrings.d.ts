declare interface INewsletterBuilderWebPartStrings {
  PropertyPaneDescription: string;
  StorageGroupName: string;
  SendingGroupName: string;
  AboutGroupName: string;
  LibraryTitleLabel: string;
  ScheduleListTitleLabel: string;
  AutoProvisionLabel: string;
  ProvisionNowLabel: string;
  DefaultToLabel: string;
  DefaultCcLabel: string;
  DefaultBccLabel: string;
  DefaultGroupIdsLabel: string;
  DefaultFromLabel: string;
  DefaultSendTimeLabel: string;
  HeightLabel: string;
}

declare module 'NewsletterBuilderWebPartStrings' {
  const strings: INewsletterBuilderWebPartStrings;
  export = strings;
}
