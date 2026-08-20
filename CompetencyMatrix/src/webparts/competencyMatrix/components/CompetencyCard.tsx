import * as React from 'react';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { ICompetencyGroup, IPerson } from '../models';

export interface ICompetencyCardProps {
  group: ICompetencyGroup;
  accentColor: string;
  /** Lower-cased search term used to highlight matching people. Empty when no search is active. */
  highlightTerm: string;
  /** Formatted future start date per person key, for members who haven't started yet. */
  upcomingByKey: { [key: string]: string };
}

export const personPhotoUrl = (person: IPerson): string | undefined =>
  person.email
    ? `/_layouts/15/userphoto.aspx?size=S&accountname=${encodeURIComponent(person.email)}`
    : undefined;

const matchesPerson = (person: IPerson, term: string): boolean =>
  term.length > 0 &&
  (person.name.toLowerCase().indexOf(term) !== -1 ||
    (person.email || '').toLowerCase().indexOf(term) !== -1);

const CompetencyCard: React.FunctionComponent<ICompetencyCardProps> = ({
  group,
  accentColor,
  highlightTerm,
  upcomingByKey
}) => {
  const { competency, members } = group;
  const totalPeople = competency.leads.length + members.length;

  return (
    <div className={styles.card}>
      <div className={styles.cardAccent} style={{ backgroundColor: accentColor }} />
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{competency.title}</h2>
        <span
          className={styles.countPill}
          style={{ color: accentColor, backgroundColor: `${accentColor}1a` }}
        >
          {totalPeople} {totalPeople === 1 ? strings.PersonCountSuffix : strings.PeopleCountSuffix}
        </span>
      </div>
      {competency.description && <p className={styles.cardDescription}>{competency.description}</p>}

      <div className={styles.sectionLabel}>
        {competency.leads.length === 1 ? strings.LeadSectionLabel : strings.LeadsSectionLabel}
      </div>
      {competency.leads.length === 0 ? (
        <div className={`${styles.emptySection} ${styles.leadEmpty}`}>{strings.NoLeadText}</div>
      ) : (
        <div className={styles.leadSection}>
          {competency.leads.map((lead, index) => (
            <div
              key={lead.email || `${lead.name}-${index}`}
              className={`${styles.personaWrapper} ${
                matchesPerson(lead, highlightTerm) ? styles.highlighted : ''
              }`}
            >
              <Persona
                text={lead.name}
                secondaryText={lead.email}
                size={PersonaSize.size40}
                imageUrl={personPhotoUrl(lead)}
                initialsColor={undefined}
              />
            </div>
          ))}
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.sectionLabel}>
        {strings.TeamSectionLabel} · {members.length}
      </div>
      {members.length === 0 ? (
        <div className={styles.emptySection}>{strings.NoMembersText}</div>
      ) : (
        <div className={styles.memberGrid}>
          {members.map((member, index) => {
            const upcoming = upcomingByKey[(member.email || member.name).toLowerCase()];
            return (
              <div
                key={member.email || `${member.name}-${index}`}
                className={`${styles.personaWrapper} ${
                  matchesPerson(member, highlightTerm) ? styles.highlighted : ''
                }`}
              >
                <Persona
                  text={member.name}
                  size={PersonaSize.size32}
                  imageUrl={personPhotoUrl(member)}
                />
                {upcoming && (
                  <span className={styles.upcomingBadge}>
                    {strings.UpcomingBadgePrefix} {upcoming}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CompetencyCard;
