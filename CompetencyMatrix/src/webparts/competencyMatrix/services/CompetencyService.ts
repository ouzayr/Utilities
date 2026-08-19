import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/site-users/web';
import '@pnp/sp/profiles';
import {
  ICompetency,
  IStaffMember,
  IStaffCompetencyRef,
  IPerson,
  IPersonSuggestion
} from '../models';

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
  /** Name of the start date field on the staff list (display or internal). */
  startDateField: string;
  /** Name of the end date field on the staff list (display or internal). */
  endDateField: string;
  /** Display title of the list that grants access to onboarding/offboarding. */
  rbacListTitle: string;
  /** Internal name of the person field on the RBAC list. */
  rbacUserField: string;
  /** Internal name of the yes/no field on the RBAC list that enables the feature. */
  rbacFlagField: string;
}

const PAGE_SIZE = 2000;

export class CompetencyService {
  /** Resolved internal names of the date fields, discovered on the first staff read. */
  private resolvedStartField: string | undefined;
  private resolvedEndField: string | undefined;
  /** Whether the competency lookup accepts multiple values, discovered on the first write. */
  private lookupIsMulti: boolean | undefined;

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

    const baseSelect = [
      'Id',
      `${personField}/Title`,
      `${personField}/EMail`,
      `${lookupField}/Id`,
      `${lookupField}/Title`
    ];

    // "Start Date" created through the SharePoint UI gets internal name
    // Start_x0020_Date - try the likely internal-name variants, then no dates at all.
    const startVariants = this.fieldNameVariants(this.config.startDateField || 'Start Date');
    const endVariants = this.fieldNameVariants(this.config.endDateField || 'End Date');
    const attempts: Array<{ start?: string; end?: string }> = [];
    const variantCount = Math.max(startVariants.length, endVariants.length);
    for (let i = 0; i < variantCount; i++) {
      attempts.push({
        start: startVariants[Math.min(i, startVariants.length - 1)],
        end: endVariants[Math.min(i, endVariants.length - 1)]
      });
    }
    attempts.push({});

    let items: any[] | undefined;
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        const select = [...baseSelect];
        if (attempt.start) {
          select.push(attempt.start);
        }
        if (attempt.end) {
          select.push(attempt.end);
        }
        items = await this.getAllItems(
          list.items.select(...select).expand(personField, lookupField)
        );
        this.resolvedStartField = attempt.start;
        this.resolvedEndField = attempt.end;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!items) {
      throw lastError;
    }

    return items
      .map((item): IStaffMember => {
        const persons = this.normalizePersons(item[personField]);
        return {
          id: item.Id,
          person: persons.length > 0 ? persons[0] : { name: '' },
          competencies: this.normalizeLookup(item[lookupField]),
          startDate: this.resolvedStartField ? this.parseDate(item[this.resolvedStartField]) : undefined,
          endDate: this.resolvedEndField ? this.parseDate(item[this.resolvedEndField]) : undefined
        };
      })
      .filter((member) => member.person.name.length > 0)
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }

  /**
   * True when the current user has an entry in the Features RBAC list with the
   * onboarding flag set. Any failure (missing list, no access) means no access.
   */
  public async canManageStaff(): Promise<boolean> {
    try {
      const userField = (this.config.rbacUserField || 'User').trim();
      const flagField = (this.config.rbacFlagField || 'OnBoarding').trim();
      const list = this.sp.web.lists.getByTitle((this.config.rbacListTitle || 'Features RBAC').trim());

      const me: any = await this.sp.web.currentUser.select('Id', 'Email')();
      const items = await this.getAllItems(
        list.items
          .select('Id', flagField, `${userField}/Id`, `${userField}/EMail`)
          .expand(userField)
      );

      return items.some((item) => {
        if (!item[flagField]) {
          return false;
        }
        const raw = item[userField];
        const users: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return users.some(
          (user) =>
            user &&
            (user.Id === me.Id ||
              (user.EMail && me.Email && user.EMail.toLowerCase() === me.Email.toLowerCase()))
        );
      });
    } catch {
      return false;
    }
  }

  /** People-picker style search over the tenant's users. */
  public async searchPeople(query: string): Promise<IPersonSuggestion[]> {
    const results: any[] = await (this.sp.profiles as any).clientPeoplePickerSearchUser({
      AllowEmailAddresses: true,
      AllowMultipleEntities: false,
      MaximumEntitySuggestions: 10,
      PrincipalSource: 15,
      PrincipalType: 1,
      QueryString: query
    });
    return (results || []).map((entry): IPersonSuggestion => ({
      loginName: entry.Key,
      name: entry.DisplayText || entry.Key,
      email: (entry.EntityData && entry.EntityData.Email) || undefined
    }));
  }

  /** Creates one staff item per selected competency for the given person. */
  public async onboardStaff(loginName: string, competencyIds: number[], startDate: Date): Promise<void> {
    const list = this.sp.web.lists.getByTitle(this.config.staffListTitle.trim());
    const personField = (this.config.staffPersonField || 'Resource').trim();
    const lookupField = (this.config.competencyLookupField || 'Competency').trim();

    const ensured: any = await this.sp.web.ensureUser(loginName);
    // PnPjs v3 wraps the result in .data; v4 returns the user info directly.
    const userId: number = (ensured && ensured.data && ensured.data.Id) || ensured.Id;

    const startField =
      this.resolvedStartField || this.fieldNameVariants(this.config.startDateField || 'Start Date')[0];

    const base: any = { [`${personField}Id`]: userId };
    if (startField) {
      base[startField] = startDate.toISOString();
    }

    for (const competencyId of competencyIds) {
      await this.addStaffItem(list, base, lookupField, competencyId);
    }
  }

  /** Stamps the end date on the given staff items. */
  public async offboardStaff(itemIds: number[], endDate: Date): Promise<void> {
    const endField =
      this.resolvedEndField || this.fieldNameVariants(this.config.endDateField || 'End Date')[0];
    if (!endField) {
      throw new Error(`End date field "${this.config.endDateField}" was not found.`);
    }
    const list = this.sp.web.lists.getByTitle(this.config.staffListTitle.trim());
    for (const itemId of itemIds) {
      await list.items.getById(itemId).update({ [endField]: endDate.toISOString() });
    }
  }

  /** Single-value lookups take CompetencyId: n, multi-value take CompetencyId: [n]. */
  private async addStaffItem(list: any, base: any, lookupField: string, competencyId: number): Promise<void> {
    if (this.lookupIsMulti !== true) {
      try {
        await list.items.add({ ...base, [`${lookupField}Id`]: competencyId });
        this.lookupIsMulti = false;
        return;
      } catch (e) {
        if (this.lookupIsMulti === false) {
          throw e;
        }
      }
    }
    await list.items.add({ ...base, [`${lookupField}Id`]: [competencyId] });
    this.lookupIsMulti = true;
  }

  /** Likely internal-name variants for a field configured by display name. */
  private fieldNameVariants(name: string): string[] {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return [];
    }
    if (trimmed.indexOf(' ') !== -1) {
      return [trimmed.replace(/ /g, '_x0020_'), trimmed.replace(/ /g, '')];
    }
    return [trimmed];
  }

  private parseDate(value: any): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
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
