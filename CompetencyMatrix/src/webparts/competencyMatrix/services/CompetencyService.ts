import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import { ICompetency, IStaffMember, IStaffCompetencyRef, IPerson } from '../models';

export interface ICompetencyServiceConfig {
  /** Display title of the list that holds one item per competency. */
  competenciesListTitle: string;
  /** Internal name of the multi-person "Lead" field on the competencies list. */
  leadField: string;
  /** Internal name of an optional description field on the competencies list. */
  competencyDescriptionField?: string;
  /** Display title of the list that holds one item per team member. */
  staffListTitle: string;
  /** Internal name of the person field on the staff list (e.g. Resource). */
  staffPersonField: string;
  /** Internal name of the lookup field on the staff list pointing to the competencies list. */
  competencyLookupField: string;
}

const PAGE_SIZE = 2000;

export class CompetencyService {
  constructor(private readonly sp: SPFI, private readonly config: ICompetencyServiceConfig) {}

  public async getCompetencies(): Promise<ICompetency[]> {
    const list = this.sp.web.lists.getByTitle(this.config.competenciesListTitle.trim());
    const leadField = (this.config.leadField || 'Lead').trim();
    const descField = (this.config.competencyDescriptionField || '').trim();

    const buildQuery = (withDesc: boolean, withLead: boolean): { select: string[]; expand: string[] } => {
      const select: string[] = ['Id', 'Title'];
      const expand: string[] = [];
      if (withDesc && descField) {
        select.push(descField);
      }
      if (withLead) {
        select.push(`${leadField}/Title`, `${leadField}/EMail`);
        expand.push(leadField);
      }
      return { select, expand };
    };

    // Degrade gracefully when the optional/renamed fields don't match the list:
    // full query, then without description, then without lead.
    const attempts: Array<{ withDesc: boolean; withLead: boolean }> = [
      { withDesc: true, withLead: true },
      { withDesc: false, withLead: true },
      { withDesc: false, withLead: false }
    ];

    let items: any[] | undefined;
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        const q = buildQuery(attempt.withDesc, attempt.withLead);
        let query = list.items.select(...q.select);
        if (q.expand.length > 0) {
          query = query.expand(...q.expand);
        }
        items = await this.getAllItems(query);
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!items) {
      throw lastError;
    }

    return items
      .map((item): ICompetency => ({
        id: item.Id,
        title: item.Title || '',
        description: descField ? item[descField] || undefined : undefined,
        leads: this.normalizePersons(item[leadField])
      }))
      .filter((competency) => competency.title.length > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  public async getStaff(): Promise<IStaffMember[]> {
    const list = this.sp.web.lists.getByTitle(this.config.staffListTitle.trim());
    const personField = (this.config.staffPersonField || 'Resource').trim();
    const lookupField = (this.config.competencyLookupField || 'Competency').trim();

    const items = await this.getAllItems(
      list.items
        .select(
          'Id',
          `${personField}/Title`,
          `${personField}/EMail`,
          `${lookupField}/Id`,
          `${lookupField}/Title`
        )
        .expand(personField, lookupField)
    );

    return items
      .map((item): IStaffMember => {
        const persons = this.normalizePersons(item[personField]);
        return {
          id: item.Id,
          person: persons.length > 0 ? persons[0] : { name: '' },
          competencies: this.normalizeLookup(item[lookupField])
        };
      })
      .filter((member) => member.person.name.length > 0)
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }

  /** Person fields return an object for single-value and an array for multi-value fields. */
  private normalizePersons(value: any): IPerson[] {
    if (!value) {
      return [];
    }
    const raw: any[] = Array.isArray(value) ? value : [value];
    return raw
      .filter((entry) => entry && entry.Title)
      .map((entry): IPerson => ({ name: entry.Title, email: entry.EMail || undefined }));
  }

  /** Lookup values come back as an object for single lookups and an array for multi-lookups. */
  private normalizeLookup(value: any): IStaffCompetencyRef[] {
    if (!value) {
      return [];
    }
    const raw: any[] = Array.isArray(value) ? value : [value];
    return raw
      .filter((entry) => entry && typeof entry.Id === 'number')
      .map((entry) => ({ id: entry.Id, title: entry.Title || '' }));
  }

  private async getAllItems(query: any): Promise<any[]> {
    const results: any[] = [];
    for await (const page of query.top(PAGE_SIZE)) {
      results.push(...page);
    }
    return results;
  }
}
