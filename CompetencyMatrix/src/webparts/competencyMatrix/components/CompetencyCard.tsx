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
  onPersonClick: (person: IPerson) => void;
}

export const personPhotoUrl = (person: IPerson): string | undefined =>
  person.email
    ? `/_layouts/15/userphoto.aspx?size=S&accountname=${encodeURIComponent(person.email)}`
    : undefined;

const matchesPerson = (person: IPerson, term: string): boolean =>
  term.length > 0 &&
  (person.name.toLowerCase().indexOf(term) !== -1 ||
    (person.email || '').toLowerCase().indexOf(term) !== -1);

/** A persona that behaves as a button so the details modal is keyboard reachable. */
export const ClickablePerson: React.FunctionComponent<{
  person: IPerson;
  size: PersonaSize;
  showSecondaryText?: boolean;
  highlighted?: boolean;
  badge?: string;
  onClick: (person: IPerson) => void;
}> = ({ person, size, showSecondaryText, highlighted, badge, onClick }) => (
  <div
    className={`${styles.personaWrapper} ${highlighted ? styles.highlighted : ''}`}
    role="button"
    tabIndex={0}
    aria-label={person.name}
    onClick={() => onClick(person)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(person);
      }
    }}
  >
    <Persona
      text={person.name}
      secondaryText={showSecondaryText ? person.email : undefined}
      size={size}
      imageUrl={personPhotoUrl(person)}
    />
    {badge && (
      <span className={styles.upcomingBadge}>
        {strings.UpcomingBadgePrefix} {badge}
      </span>
    )}
  </div>
);

const CompetencyCard: React.FunctionComponent<ICompetencyCardProps> = ({
  group,
  accentColor,
  highlightTerm,
  upcomingByKey,
  onPersonClick
}) => {
  const { competency, members } = group;
  const totalPeople = competency.leads.length + competency.managers.length + members.length;

  const renderPeopleSection = (
    label: string,
    people: IPerson[],
    emptyText: string,
    size: PersonaSize,
    showSecondaryText: boolean
  ): React.ReactNode => (
    <>
      <div className={styles.sectionLabel}>{label}</div>
      {people.length === 0 ? (
        <div className={`${styles.emptySection} ${styles.inlineEmpty}`}>{emptyText}</div>
      ) : (
        <div className={styles.leadSection}>
          {people.map((person, index) => (
            <ClickablePerson
              key={person.email || `${person.name}-${index}`}
              person={person}
              size={size}
              showSecondaryText={showSecondaryText}
              highlighted={matchesPerson(person, highlightTerm)}
              onClick={onPersonClick}
            />
          ))}
        </div>
      )}
    </>
  );

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

      {renderPeopleSection(
        competency.leads.length > 1 ? strings.LeadsSectionLabel : strings.LeadSectionLabel,
        competency.leads,
        strings.NoLeadText,
        PersonaSize.size40,
        true
      )}

      {renderPeopleSection(
        competency.managers.length > 1 ? strings.ManagersSectionLabel : strings.ManagerSectionLabel,
        competency.managers,
        strings.NoManagerText,
        PersonaSize.size40,
        true
      )}

      <div className={styles.divider} />

      <div className={styles.sectionLabel}>
        {strings.TeamSectionLabel} · {members.length}
      </div>
      {members.length === 0 ? (
        <div className={styles.emptySection}>{strings.NoMembersText}</div>
      ) : (
        <div className={styles.memberGrid}>
          {members.map((member, index) => (
            <ClickablePerson
              key={member.email || `${member.name}-${index}`}
              person={member}
              size={PersonaSize.size32}
              highlighted={matchesPerson(member, highlightTerm)}
              badge={upcomingByKey[(member.email || member.name).toLowerCase()]}
              onClick={onPersonClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CompetencyCard;
