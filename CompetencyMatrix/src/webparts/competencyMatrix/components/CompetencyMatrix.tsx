import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { SearchBox } from '@fluentui/react/lib/SearchBox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { ICompetencyMatrixProps } from './ICompetencyMatrixProps';
import CompetencyCard, { personPhotoUrl } from './CompetencyCard';
import OnboardPanel from './OnboardPanel';
import OffboardPanel from './OffboardPanel';
import { ICompetency, ICompetencyGroup, IPerson, IPersonMatch, IStaffMember } from '../models';

const ALL_COMPETENCIES_KEY = -1;

// Fluent UI shared colors - each competency gets a stable accent derived from its title.
const ACCENT_COLORS: string[] = [
  '#0078d4', // blue
  '#038387', // teal
  '#8764b8', // purple
  '#ca5010', // orange
  '#407855', // green
  '#a4262c', // red
  '#986f0b', // gold
  '#8e562e' // brown
];

const accentForTitle = (title: string): string => {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
};

const personKey = (person: IPerson): string => (person.email || person.name).toLowerCase();

const matchesPerson = (person: IPerson, term: string): boolean =>
  person.name.toLowerCase().indexOf(term) !== -1 ||
  (person.email || '').toLowerCase().indexOf(term) !== -1;

const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const CompetencyMatrix: React.FunctionComponent<ICompetencyMatrixProps> = (props) => {
  const { service, title } = props;

  const [competencies, setCompetencies] = useState<ICompetency[]>([]);
  const [staff, setStaff] = useState<IStaffMember[]>([]);
  const [canManage, setCanManage] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<number>(ALL_COMPETENCIES_KEY);
  const [openPanel, setOpenPanel] = useState<'onboard' | 'offboard' | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        const [loadedCompetencies, loadedStaff, loadedCanManage] = await Promise.all([
          service.getCompetencies(),
          service.getStaff(),
          service.canManageStaff()
        ]);
        if (!cancelled) {
          setCompetencies(loadedCompetencies);
          setStaff(loadedStaff);
          setCanManage(loadedCanManage);
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
  }, [service, reloadToken]);

  // People whose End Date has passed are offboarded and disappear from the matrix.
  const activeStaff = useMemo((): IStaffMember[] => {
    const today = startOfToday();
    return staff.filter((member) => !member.endDate || member.endDate >= today);
  }, [staff]);

  // Members with a future Start Date get a "from <date>" badge.
  const upcomingByKey = useMemo((): { [key: string]: string } => {
    const today = startOfToday();
    const result: { [key: string]: string } = {};
    activeStaff.forEach((member) => {
      if (member.startDate && member.startDate > today) {
        result[personKey(member.person)] = member.startDate.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short'
        });
      }
    });
    return result;
  }, [activeStaff]);

  const groups = useMemo((): ICompetencyGroup[] => {
    return competencies.map((competency) => {
      const leadKeys: { [key: string]: boolean } = {};
      competency.leads.forEach((lead) => {
        leadKeys[personKey(lead)] = true;
      });
      const seen: { [key: string]: boolean } = {};
      const members: IPerson[] = [];
      activeStaff.forEach((member) => {
        if (!member.competencies.some((c) => c.id === competency.id)) {
          return;
        }
        const key = personKey(member.person);
        // A lead may also appear in Team Structure - show them once, in the lead slot.
        if (leadKeys[key] || seen[key]) {
          return;
        }
        seen[key] = true;
        members.push(member.person);
      });
      return { competency, members };
    });
  }, [competencies, activeStaff]);

  const totalPeople = useMemo((): number => {
    const seen: { [key: string]: boolean } = {};
    let count = 0;
    const add = (person: IPerson): void => {
      const key = personKey(person);
      if (!seen[key]) {
        seen[key] = true;
        count++;
      }
    };
    competencies.forEach((competency) => competency.leads.forEach(add));
    activeStaff.forEach((member) => add(member.person));
    return count;
  }, [competencies, activeStaff]);

  const term = searchTerm.trim().toLowerCase();

  const personMatches = useMemo((): IPersonMatch[] => {
    if (!term) {
      return [];
    }
    const matches: { [key: string]: IPersonMatch } = {};
    const order: string[] = [];

    const addEntry = (person: IPerson, competencyId: number, competencyTitle: string, isLead: boolean): void => {
      if (!matchesPerson(person, term)) {
        return;
      }
      const key = personKey(person);
      if (!matches[key]) {
        matches[key] = { person, entries: [] };
        order.push(key);
      }
      const existing = matches[key].entries.filter((entry) => entry.competencyId === competencyId)[0];
      if (existing) {
        existing.isLead = existing.isLead || isLead;
        return;
      }
      matches[key].entries.push({ competencyId, title: competencyTitle, isLead });
    };

    competencies.forEach((competency) =>
      competency.leads.forEach((lead) => addEntry(lead, competency.id, competency.title, true))
    );
    activeStaff.forEach((member) =>
      member.competencies.forEach((c) => addEntry(member.person, c.id, c.title, false))
    );

    return order.map((key) => matches[key]);
  }, [competencies, activeStaff, term]);

  const visibleGroups = useMemo((): ICompetencyGroup[] => {
    let result = groups;
    if (selectedCompetencyId !== ALL_COMPETENCIES_KEY) {
      result = result.filter((group) => group.competency.id === selectedCompetencyId);
    }
    if (term) {
      const matchedIds: { [id: number]: boolean } = {};
      personMatches.forEach((match) =>
        match.entries.forEach((entry) => {
          matchedIds[entry.competencyId] = true;
        })
      );
      result = result.filter(
        (group) =>
          group.competency.title.toLowerCase().indexOf(term) !== -1 ||
          matchedIds[group.competency.id]
      );
    }
    return result;
  }, [groups, selectedCompetencyId, term, personMatches]);

  const dropdownOptions = useMemo((): IDropdownOption[] => {
    const options: IDropdownOption[] = [
      { key: ALL_COMPETENCIES_KEY, text: strings.AllCompetenciesOption }
    ];
    competencies.forEach((competency) =>
      options.push({ key: competency.id, text: competency.title })
    );
    return options;
  }, [competencies]);

  const onActionSuccess = (message: string): void => {
    setOpenPanel(undefined);
    setNotice(message);
    setReloadToken((token) => token + 1);
  };

  return (
    <section className={styles.competencyMatrix}>
      <div className={styles.toolbar}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{title || strings.DefaultTitle}</h1>
          <div className={styles.stats}>
            <span className={styles.statPill}>
              <b>{competencies.length}</b> {strings.CompetenciesCountLabel}
            </span>
            <span className={styles.statPill}>
              <b>{totalPeople}</b> {strings.PeopleCountLabel}
            </span>
          </div>
        </div>
        <div className={styles.controls}>
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
              ariaLabel={strings.FilterLabel}
              options={dropdownOptions}
              selectedKey={selectedCompetencyId}
              onChange={(_, option) =>
                setSelectedCompetencyId(option ? (option.key as number) : ALL_COMPETENCIES_KEY)
              }
            />
          </div>
          {canManage && (
            <div className={styles.manageButtons}>
              <PrimaryButton
                text={strings.OnboardButtonText}
                iconProps={{ iconName: 'AddFriend' }}
                onClick={() => setOpenPanel('onboard')}
                disabled={loading}
              />
              <DefaultButton
                text={strings.OffboardButtonText}
                iconProps={{ iconName: 'UserRemove' }}
                onClick={() => setOpenPanel('offboard')}
                disabled={loading}
              />
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className={styles.notice}>
          <MessageBar
            messageBarType={MessageBarType.success}
            onDismiss={() => setNotice(undefined)}
          >
            {notice}
          </MessageBar>
        </div>
      )}

      <div className={styles.content}>
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

        {!loading && !error && term.length > 0 && personMatches.length > 0 && (
          <div className={styles.searchSummary}>
            <div className={styles.summaryHeading}>
              {personMatches.length} {personMatches.length === 1 ? strings.MatchFoundLabel : strings.MatchesFoundLabel}
            </div>
            {personMatches.map((match) => (
              <div key={personKey(match.person)} className={styles.matchRow}>
                <div className={styles.matchPersona}>
                  <Persona
                    text={match.person.name}
                    secondaryText={match.person.email}
                    size={PersonaSize.size40}
                    imageUrl={personPhotoUrl(match.person)}
                  />
                </div>
                <div className={styles.matchChips}>
                  {match.entries.map((entry) => (
                    <span key={entry.competencyId} className={styles.chip}>
                      <span
                        className={styles.chipDot}
                        style={{ backgroundColor: accentForTitle(entry.title) }}
                      />
                      {entry.title}
                      {entry.isLead && <span className={styles.chipLead}>{strings.LeadBadgeText}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && visibleGroups.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>
              {term ? strings.NoSearchResultsTitle : strings.NoCompetenciesTitle}
            </p>
            <p className={styles.emptyText}>
              {term ? strings.NoSearchResultsText : strings.NoCompetenciesText}
            </p>
          </div>
        )}

        {!loading && !error && visibleGroups.length > 0 && (
          <div className={styles.grid}>
            {visibleGroups.map((group) => (
              <CompetencyCard
                key={group.competency.id}
                group={group}
                accentColor={accentForTitle(group.competency.title)}
                highlightTerm={term}
                upcomingByKey={upcomingByKey}
              />
            ))}
          </div>
        )}
      </div>

      {openPanel === 'onboard' && (
        <OnboardPanel
          service={service}
          competencies={competencies}
          onDismiss={() => setOpenPanel(undefined)}
          onSuccess={onActionSuccess}
        />
      )}

      {openPanel === 'offboard' && (
        <OffboardPanel
          service={service}
          staff={activeStaff}
          onDismiss={() => setOpenPanel(undefined)}
          onSuccess={onActionSuccess}
        />
      )}
    </section>
  );
};

export default CompetencyMatrix;
