import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchBox } from '@fluentui/react/lib/SearchBox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { PersonaSize } from '@fluentui/react/lib/Persona';
import { PrimaryButton, DefaultButton, IconButton } from '@fluentui/react/lib/Button';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { ICompetencyMatrixProps } from './ICompetencyMatrixProps';
import CompetencyCard, { ClickablePerson } from './CompetencyCard';
import PersonDetailsModal, { roleLabel } from './PersonDetailsModal';
import OnboardPanel from './OnboardPanel';
import OffboardPanel from './OffboardPanel';
import { downloadWorkbook } from '../services/ExcelExport';
import {
  ICompetency,
  ICompetencyGroup,
  IPerson,
  IPersonMatch,
  IStaffMember,
  PersonRole
} from '../models';

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
  const { service, profileService, title } = props;

  const [competencies, setCompetencies] = useState<ICompetency[]>([]);
  const [staff, setStaff] = useState<IStaffMember[]>([]);
  const [canManage, setCanManage] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<number>(ALL_COMPETENCIES_KEY);
  const [openPanel, setOpenPanel] = useState<'onboard' | 'offboard' | undefined>(undefined);
  const [selectedPersonKey, setSelectedPersonKey] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState<number>(0);
  const hasLoadedOnce = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      // Only the first load blanks the view; refreshes update in place.
      if (hasLoadedOnce.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
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
          hasLoadedOnce.current = true;
          setLoading(false);
          setRefreshing(false);
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
      // Leads and managers are shown in their own sections, never again under Team.
      const featured: { [key: string]: boolean } = {};
      competency.leads.forEach((lead) => {
        featured[personKey(lead)] = true;
      });
      competency.managers.forEach((manager) => {
        featured[personKey(manager)] = true;
      });

      const seen: { [key: string]: boolean } = {};
      const members: IPerson[] = [];
      activeStaff.forEach((member) => {
        if (!member.competencies.some((c) => c.id === competency.id)) {
          return;
        }
        const key = personKey(member.person);
        if (featured[key] || seen[key]) {
          return;
        }
        seen[key] = true;
        members.push(member.person);
      });
      return { competency, members };
    });
  }, [competencies, activeStaff]);

  /** Every person with the competencies they belong to and the role they hold in each. */
  const peopleIndex = useMemo((): { [key: string]: IPersonMatch } => {
    const index: { [key: string]: IPersonMatch } = {};

    const addEntry = (
      person: IPerson,
      competencyId: number,
      competencyTitle: string,
      role: PersonRole,
      startDate?: Date
    ): void => {
      const key = personKey(person);
      if (!index[key]) {
        index[key] = { person, entries: [], startDate };
      }
      if (startDate && !index[key].startDate) {
        index[key].startDate = startDate;
      }
      const existing = index[key].entries.filter((entry) => entry.competencyId === competencyId)[0];
      if (existing) {
        // Lead outranks manager, which outranks plain membership.
        if (role === 'lead' || (role === 'manager' && existing.role === 'member')) {
          existing.role = role;
        }
        return;
      }
      index[key].entries.push({ competencyId, title: competencyTitle, role });
    };

    competencies.forEach((competency) => {
      competency.leads.forEach((lead) => addEntry(lead, competency.id, competency.title, 'lead'));
      competency.managers.forEach((manager) =>
        addEntry(manager, competency.id, competency.title, 'manager')
      );
    });
    activeStaff.forEach((member) =>
      member.competencies.forEach((c) =>
        addEntry(member.person, c.id, c.title, 'member', member.startDate)
      )
    );

    return index;
  }, [competencies, activeStaff]);

  const totalPeople = useMemo((): number => Object.keys(peopleIndex).length, [peopleIndex]);

  const term = searchTerm.trim().toLowerCase();

  const personMatches = useMemo((): IPersonMatch[] => {
    if (!term) {
      return [];
    }
    return Object.keys(peopleIndex)
      .map((key) => peopleIndex[key])
      .filter((match) => matchesPerson(match.person, term))
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [peopleIndex, term]);

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

  /** One row per person per competency: Competency, Role, Name, Email. */
  const exportGroups = useCallback(
    (groupsToExport: ICompetencyGroup[], fileSuffix: string): void => {
      const rows: string[][] = [
        [strings.ExportHeaderCompetency, strings.ExportHeaderRole, strings.ExportHeaderName, strings.ExportHeaderEmail]
      ];

      groupsToExport.forEach((group) => {
        const push = (person: IPerson, role: PersonRole): void => {
          rows.push([group.competency.title, roleLabel(role), person.name, person.email || '']);
        };
        group.competency.leads.forEach((lead) => push(lead, 'lead'));
        group.competency.managers.forEach((manager) => push(manager, 'manager'));
        group.members.forEach((member) => push(member, 'member'));
      });

      const stamp = new Date().toISOString().slice(0, 10);
      downloadWorkbook(rows, `Competency Matrix - ${fileSuffix} - ${stamp}.xlsx`, {
        sheetName: strings.ExportSheetName,
        widths: [34, 16, 28, 34]
      });
    },
    []
  );

  const exportMenuProps = useMemo(
    () => ({
      items: [
        {
          key: 'current',
          text: `${strings.ExportCurrentViewText} (${visibleGroups.length})`,
          iconProps: { iconName: 'FilterSolid' },
          disabled: visibleGroups.length === 0,
          onClick: () => {
            exportGroups(visibleGroups, strings.ExportSelectionSuffix);
          }
        },
        {
          key: 'all',
          text: `${strings.ExportAllText} (${groups.length})`,
          iconProps: { iconName: 'Table' },
          disabled: groups.length === 0,
          onClick: () => {
            exportGroups(groups, strings.ExportAllSuffix);
          }
        }
      ]
    }),
    [visibleGroups, groups, exportGroups]
  );

  const onActionSuccess = (message: string): void => {
    setOpenPanel(undefined);
    setNotice(message);
    setReloadToken((token) => token + 1);
  };

  const onPersonClick = useCallback((person: IPerson): void => {
    setSelectedPersonKey(personKey(person));
  }, []);

  const selectedMatch = selectedPersonKey ? peopleIndex[selectedPersonKey] : undefined;

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
          {refreshing ? (
            <Spinner className={styles.refreshSpinner} size={SpinnerSize.small} />
          ) : (
            <IconButton
              className={styles.refreshButton}
              iconProps={{ iconName: 'Refresh' }}
              title={strings.RefreshButtonText}
              ariaLabel={strings.RefreshButtonText}
              onClick={() => setReloadToken((token) => token + 1)}
              disabled={loading}
            />
          )}
          <DefaultButton
            text={strings.ExportButtonText}
            iconProps={{ iconName: 'ExcelDocument' }}
            menuProps={exportMenuProps}
            disabled={loading || groups.length === 0}
          />
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
              {personMatches.length}{' '}
              {personMatches.length === 1 ? strings.MatchFoundLabel : strings.MatchesFoundLabel}
            </div>
            {personMatches.map((match) => (
              <div key={personKey(match.person)} className={styles.matchRow}>
                <div className={styles.matchPersona}>
                  <ClickablePerson
                    person={match.person}
                    size={PersonaSize.size40}
                    showSecondaryText={true}
                    onClick={onPersonClick}
                  />
                </div>
                <div className={styles.matchChips}>
                  {match.entries.map((entry) => (
                    <span key={`${entry.role}-${entry.competencyId}`} className={styles.chip}>
                      <span
                        className={styles.chipDot}
                        style={{ backgroundColor: accentForTitle(entry.title) }}
                      />
                      {entry.title}
                      {entry.role !== 'member' && (
                        <span className={styles.chipLead}>{roleLabel(entry.role)}</span>
                      )}
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
                onPersonClick={onPersonClick}
              />
            ))}
          </div>
        )}
      </div>

      {selectedMatch && (
        <PersonDetailsModal
          match={selectedMatch}
          profileService={profileService}
          accentForTitle={accentForTitle}
          onDismiss={() => setSelectedPersonKey(undefined)}
        />
      )}

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
