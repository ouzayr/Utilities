import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import { ICompetency, IStaffMember, IStaffCompetencyRef } from '../models';

export interface ICompetencyServiceConfig {
  /** Display title of the list that holds one item per competency. */
  competenciesListTitle: string;
  /** Internal name of an optional description field on the competencies list. */
  competencyDescriptionField?: string;
  /** Display title of the list that holds one item per staff member. */
  staffListTitle: string;
  /** Internal name of the field holding the staff member's name. */
  staffNameField: string;
  /** True when the staff name field is a Person field (expanded), false for plain text. */
  staffNameIsPerson: boolean;
  /** Internal name of the lookup field on the staff list pointing to the competencies list. */
  competencyLookupField: string;
  /** Internal name of an optional choice/text field describing the person's role. */
  roleField?: string;
  /** Role value that marks a person as a competency leader (case-insensitive). */
  leaderRoleValue: string;
}

const PAGE_SIZE = 2000;

export class CompetencyService {
  constructor(private readonly sp: SPFI, private readonly config: ICompetencyServiceConfig) {}

  public async getCompetencies(): Promise<ICompetency[]> {
    const list = this.sp.web.lists.getByTitle(this.config.competenciesListTitle);
    const descField = (this.config.competencyDescriptionField || '').trim();

    let items: any[];
    if (descField) {
      try {
        items = await this.getAllItems(list.items.select('Id', 'Title', descField));
      } catch {
        // The description field may not exist on the list - fall back to the required fields only.
        items = await this.getAllItems(list.items.select('Id', 'Title'));
      }
    } else {
      items = await this.getAllItems(list.items.select('Id', 'Title'));
    }

    return items
      .map((item): ICompetency => ({
        id: item.Id,
        title: item.Title || '',
        description: descField ? item[descField] || undefined : undefined
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  public async getStaff(): Promise<IStaffMember[]> {
    const list = this.sp.web.lists.getByTitle(this.config.staffListTitle);
    const nameField = (this.config.staffNameField || 'Title').trim();
    const lookupField = (this.config.competencyLookupField || 'Competency').trim();
    const roleField = (this.config.roleField || '').trim();

    const buildQuery = (includeRole: boolean): { select: string[]; expand: string[] } => {
      const select: string[] = ['Id', `${lookupField}/Id`, `${lookupField}/Title`];
      const expand: string[] = [lookupField];
      if (this.config.staffNameIsPerson) {
        select.push(`${nameField}/Title`, `${nameField}/EMail`);
        expand.push(nameField);
      } else {
        select.push(nameField);
      }
      if (includeRole && roleField) {
        select.push(roleField);
      }
      return { select, expand };
    };

    let items: any[];
    try {
      const q = buildQuery(true);
      items = await this.getAllItems(list.items.select(...q.select).expand(...q.expand));
    } catch (roleError) {
      if (!roleField) {
        throw roleError;
      }
      // The role field may not exist on the list - fall back without it.
      const q = buildQuery(false);
      items = await this.getAllItems(list.items.select(...q.select).expand(...q.expand));
    }

    const leaderValue = (this.config.leaderRoleValue || 'Leader').trim().toLowerCase();

    return items
      .map((item): IStaffMember => {
        let name = '';
        let email: string | undefined;
        if (this.config.staffNameIsPerson) {
          const person = item[nameField];
          name = (person && person.Title) || '';
          email = (person && person.EMail) || undefined;
        } else {
          name = item[nameField] || '';
        }

        const role = this.normalizeRole(roleField ? item[roleField] : undefined);
        const isLeader = role
          .split(';')
          .some((value) => value.trim().toLowerCase() === leaderValue);

        return {
          id: item.Id,
          name,
          email,
          role: role || undefined,
          isLeader,
          competencies: this.normalizeLookup(item[lookupField])
        };
      })
      .filter((member) => member.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
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

  /** Choice fields return a string, multi-choice fields return an array of strings. */
  private normalizeRole(value: any): string {
    if (!value) {
      return '';
    }
    if (Array.isArray(value)) {
      return value.join(';');
    }
    return String(value);
  }

  private async getAllItems(query: any): Promise<any[]> {
    const results: any[] = [];
    for await (const page of query.top(PAGE_SIZE)) {
      results.push(...page);
    }
    return results;
  }
}
