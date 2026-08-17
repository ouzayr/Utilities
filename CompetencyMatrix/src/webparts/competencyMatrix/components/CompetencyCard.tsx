import * as React from 'react';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { ICompetencyGroup, IStaffMember } from '../models';

export interface ICompetencyCardProps {
  group: ICompetencyGroup;
  /** Lower-cased search term used to highlight matching people. Empty when no search is active. */
  highlightTerm: string;
}

const matchesPerson = (member: IStaffMember, term: string): boolean =>
  term.length > 0 &&
  (member.name.toLowerCase().indexOf(term) !== -1 ||
    (member.email || '').toLowerCase().indexOf(term) !== -1);

const PersonList: React.FunctionComponent<{
  people: IStaffMember[];
  highlightTerm: string;
  emptyText: string;
}> = ({ people, highlightTerm, emptyText }) => {
  if (people.length === 0) {
    return <div className={styles.emptySection}>{emptyText}</div>;
  }
  return (
    <div className={styles.peopleList}>
      {people.map((person) => (
        <div
          key={person.id}
          className={`${styles.personaWrapper} ${
            matchesPerson(person, highlightTerm) ? styles.highlighted : ''
          }`}
        >
          <Persona
            text={person.name}
            secondaryText={person.role || person.email}
            size={PersonaSize.size32}
          />
        </div>
      ))}
    </div>
  );
};

const CompetencyCard: React.FunctionComponent<ICompetencyCardProps> = ({ group, highlightTerm }) => (
  <div className={styles.card}>
    <h2 className={styles.cardTitle}>{group.competency.title}</h2>
    {group.competency.description && (
      <p className={styles.cardDescription}>{group.competency.description}</p>
    )}

    <div className={styles.sectionLabel}>
      {strings.LeadersSectionLabel} ({group.leaders.length})
    </div>
    <PersonList people={group.leaders} highlightTerm={highlightTerm} emptyText={strings.NoLeadersText} />

    <div className={styles.sectionLabel}>
      {strings.StaffSectionLabel} ({group.members.length})
    </div>
    <PersonList people={group.members} highlightTerm={highlightTerm} emptyText={strings.NoStaffText} />
  </div>
);

export default CompetencyCard;
