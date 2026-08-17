import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { SearchBox } from '@fluentui/react/lib/SearchBox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { ICompetencyMatrixProps } from './ICompetencyMatrixProps';
import CompetencyCard from './CompetencyCard';
import { ICompetency, ICompetencyGroup, IStaffMember } from '../models';

const ALL_COMPETENCIES_KEY = -1;

const CompetencyMatrix: React.FunctionComponent<ICompetencyMatrixProps> = (props) => {
  const { service, title } = props;

  const [competencies, setCompetencies] = useState<ICompetency[]>([]);
  const [staff, setStaff] = useState<IStaffMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<number>(ALL_COMPETENCIES_KEY);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        const [loadedCompetencies, loadedStaff] = await Promise.all([
          service.getCompetencies(),
          service.getStaff()
        ]);
        if (!cancelled) {
          setCompetencies(loadedCompetencies);
          setStaff(loadedStaff);
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(`${strings.LoadErrorText} ${message}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load().catch(() => {
      /* handled inside load */
    });

    return () => {
      cancelled = true;
    };
  }, [service]);

  const groups = useMemo((): ICompetencyGroup[] => {
    return competencies.map((competency) => {
      const belongs = (member: IStaffMember): boolean =>
        member.competencies.some((c) => c.id === competency.id);
      return {
        competency,
        leaders: staff.filter((member) => member.isLeader && belongs(member)),
        members: staff.filter((member) => !member.isLeader && belongs(member))
      };
    });
  }, [competencies, staff]);

  const term = searchTerm.trim().toLowerCase();

  const matchedPeople = useMemo((): IStaffMember[] => {
    if (!term) {
      return [];
    }
    return staff.filter(
      (member) =>
        member.name.toLowerCase().indexOf(term) !== -1 ||
        (member.email || '').toLowerCase().indexOf(term) !== -1
    );
  }, [staff, term]);

  const visibleGroups = useMemo((): ICompetencyGroup[] => {
    let result = groups;
    if (selectedCompetencyId !== ALL_COMPETENCIES_KEY) {
      result = result.filter((group) => group.competency.id === selectedCompetencyId);
    }
    if (term) {
      const matchedIds: { [id: number]: boolean } = {};
      matchedPeople.forEach((member) =>
        member.competencies.forEach((c) => {
          matchedIds[c.id] = true;
        })
      );
      result = result.filter(
        (group) =>
          group.competency.title.toLowerCase().indexOf(term) !== -1 ||
          matchedIds[group.competency.id]
      );
    }
    return result;
  }, [groups, selectedCompetencyId, term, matchedPeople]);

  const dropdownOptions = useMemo((): IDropdownOption[] => {
    const options: IDropdownOption[] = [
      { key: ALL_COMPETENCIES_KEY, text: strings.AllCompetenciesOption }
    ];
    competencies.forEach((competency) =>
      options.push({ key: competency.id, text: competency.title })
    );
    return options;
  }, [competencies]);

  return (
    <section className={styles.competencyMatrix}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{title || strings.DefaultTitle}</h1>
          <p className={styles.subtitle}>
            {competencies.length} {strings.CompetenciesCountLabel} · {staff.length}{' '}
            {strings.StaffCountLabel}
          </p>
        </div>
        <div className={styles.searchBox}>
          <SearchBox
            placeholder={strings.SearchPlaceholder}
            value={searchTerm}
            onChange={(_, newValue) => setSearchTerm(newValue || '')}
            onClear={() => setSearchTerm('')}
          />
        </div>
        <div className={styles.filterDropdown}>
          <Dropdown
            label={strings.FilterLabel}
            options={dropdownOptions}
            selectedKey={selectedCompetencyId}
            onChange={(_, option) =>
              setSelectedCompetencyId(option ? (option.key as number) : ALL_COMPETENCIES_KEY)
            }
          />
        </div>
      </div>

      {loading && (
        <div className={styles.statusContainer}>
          <Spinner size={SpinnerSize.large} label={strings.LoadingText} />
        </div>
      )}

      {!loading && error && (
        <MessageBar messageBarType={MessageBarType.error} isMultiline={true}>
          {error}
        </MessageBar>
      )}

      {!loading && !error && term.length > 0 && matchedPeople.length > 0 && (
        <div className={styles.personResults}>
          {matchedPeople.map((member) => (
            <div key={member.id} className={styles.personResultRow}>
              <span className={styles.personName}>{member.name}</span>
              {' — '}
              {member.competencies.length === 0 ? (
                <em>{strings.NoCompetencyForPersonText}</em>
              ) : (
                member.competencies.map((c) => (
                  <span
                    key={c.id}
                    className={`${styles.personCompetency} ${
                      member.isLeader ? styles.leaderChip : ''
                    }`}
                  >
                    {c.title}
                    {member.isLeader ? ` · ${strings.LeaderBadgeText}` : ''}
                  </span>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && visibleGroups.length === 0 && (
        <div className={styles.emptyState}>
          {term ? strings.NoSearchResultsText : strings.NoCompetenciesText}
        </div>
      )}

      {!loading && !error && visibleGroups.length > 0 && (
        <div className={styles.grid}>
          {visibleGroups.map((group) => (
            <CompetencyCard key={group.competency.id} group={group} highlightTerm={term} />
          ))}
        </div>
      )}
    </section>
  );
};

export default CompetencyMatrix;
