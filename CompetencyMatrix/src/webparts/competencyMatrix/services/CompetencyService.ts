import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/fields';
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
  /** Name of the multi-person "Lead" field on the competencies list. */
  leadField: string;
  /** Name of the person "Manager" field on the competencies list. */
  managerField: string;
  /** Name of an optional description field on the competencies list. */
  competencyDescriptionField?: string;
  /** Display title of the list that holds one item per team member. */
  staffListTitle: string;
  /** Name of the person field on the staff list (e.g. Resource). */
  staffPersonField: string;
  /** Name of the lookup field on the staff list pointing to the competencies list. */
  competencyLookupField: string;
  /** Name of the start date field on the staff list. */
  startDateField: string;
  /** Name of the end date field on the staff list. */
  endDateField: string;
  /** Display title of the list that grants access to onboarding/offboarding. */
  rbacListTitle: string;
  /** Name of the person field on the RBAC list. */
  rbacUserField: string;
  /** Name of the yes/no field on the RBAC list that enables the feature. */
  rbacFlagField: string;
}

interface IFieldInfo {
  InternalName: string;
  Title: string;
}

const PAGE_SIZE = 2000;

export class CompetencyService {
  /** Internal field names per list title, resolved once per list. */
  private fieldCache: { [listTitle: string]: IFieldInfo[] } = {};
  /** Resolved internal names of the staff date fields. */
  private resolvedStartField: string | undefined;
  private resolvedEndField: string | undefined;

  constructor(private readonly sp: SPFI, private readonly config: ICompetencyServiceConfig) {}

  public async getCompetencies(): Promise<ICompetency[]> {
    const listTitle = this.config.competenciesListTitle.trim();
    const list = this.sp.web.lists.getByTitle(listTitle);
    const fields = await this.getFields(listTitle);

    const leadField = this.resolveField(fields, this.config.leadField, 'Lead');
    const managerField = this.resolveField(fields, this.config.managerField, 'Manager');
    const descField = this.config.competencyDescriptionField
      ? this.resolveField(fields, this.config.competencyDescriptionField)
      : undefined;

    const select: string[] = ['Id', 'Title'];
    const expand: string[] = [];
    [leadField, managerField].forEach((field) => {
      if (field) {
        select.push(`${field}/Title`, `${field}/EMail`);
        expand.push(field);
      }
    });
    if (descField) {
      select.push(descField);
    }

    let query = list.items.select(...select);
    if (expand.length > 0) {
      query = query.expand(...expand);
    }
    const items = await this.getAllItems(query);

    return items
      .map((item): ICompetency => ({
        id: item.Id,
        title: item.Title || '',
        description: descField ? item[descField] || undefined : undefined,
        leads: leadField ? this.normalizePersons(item[leadField]) : [],
        managers: managerField ? this.normalizePersons(item[managerField]) : []
      }))
      .filter((competency) => competency.title.length > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  public async getStaff(): Promise<IStaffMember[]> {
    const listTitle = this.config.staffListTitle.trim();
    const list = this.sp.web.lists.getByTitle(listTitle);
    const fields = await this.getFields(listTitle);

    const personField = this.resolveField(fields, this.config.staffPersonField, 'Resource') || 'Resource';
    const lookupField =
      this.resolveField(fields, this.config.competencyLookupField, 'Competency') || 'Competency';
    this.resolvedStartField = this.resolveField(fields, this.config.startDateField, 'Start Date');
    this.resolvedEndField = this.resolveField(fields, this.config.endDateField, 'End Date');

    const select: string[] = [
      'Id',
      `${personField}/Title`,
      `${personField}/EMail`,
      `${lookupField}/Id`,
      `${lookupField}/Title`
    ];
    if (this.resolvedStartField) {
      select.push(this.resolvedStartField);
    }
    if (this.resolvedEndField) {
      select.push(this.resolvedEndField);
    }

    const items = await this.getAllItems(
      list.items.select(...select).expand(personField, lookupField)
    );

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
      const listTitle = (this.config.rbacListTitle || 'Features RBAC').trim();
      const list = this.sp.web.lists.getByTitle(listTitle);
      const fields = await this.getFields(listTitle);
      const userField = this.resolveField(fields, this.config.rbacUserField, 'User') || 'User';
      const flagField = this.resolveField(fields, this.config.rbacFlagField, 'OnBoarding') || 'OnBoarding';

      const me: any = await this.sp.web.currentUser.select('Id', 'Email')();
      const items = await this.getAllItems(
        list.items.select('Id', flagField, `${userField}/Id`, `${userField}/EMail`).expand(userField)
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

  /**
   * Creates a single staff item holding every selected competency. Falls back to
   * one item per competency when the lookup column only accepts a single value.
   */
  public async onboardStaff(loginName: string, competencyIds: number[], startDate: Date): Promise<void> {
    const listTitle = this.config.staffListTitle.trim();
    const list = this.sp.web.lists.getByTitle(listTitle);
    const fields = await this.getFields(listTitle);
    const personField = this.resolveField(fields, this.config.staffPersonField, 'Resource') || 'Resource';
    const lookupField =
      this.resolveField(fields, this.config.competencyLookupField, 'Competency') || 'Competency';
    const startField =
      this.resolvedStartField || this.resolveField(fields, this.config.startDateField, 'Start Date');

    const ensured: any = await this.sp.web.ensureUser(loginName);
    // PnPjs v3 wraps the result in .data; v4 returns the user info directly.
    const userId: number = (ensured && ensured.data && ensured.data.Id) || ensured.Id;

    const base: any = { [`${personField}Id`]: userId };
    if (startField) {
      base[startField] = startDate.toISOString();
    }

    // Multi-value lookups take { results: [...] }; some configurations accept a
    // plain array. Single-value columns reject both, so fall back to one item each.
    const payloads = [
      { ...base, [`${lookupField}Id`]: { results: competencyIds } },
      { ...base, [`${lookupField}Id`]: competencyIds }
    ];

    for (const payload of payloads) {
      try {
        await list.items.add(payload);
        return;
      } catch {
        /* try the next shape */
      }
    }

    for (const competencyId of competencyIds) {
      await list.items.add({ ...base, [`${lookupField}Id`]: competencyId });
    }
  }

  /** Stamps the end date on the given staff items. */
  public async offboardStaff(itemIds: number[], endDate: Date): Promise<void> {
    const listTitle = this.config.staffListTitle.trim();
    const list = this.sp.web.lists.getByTitle(listTitle);
    const fields = await this.getFields(listTitle);
    const endField =
      this.resolvedEndField || this.resolveField(fields, this.config.endDateField, 'End Date');
    if (!endField) {
      throw new Error(`End date field "${this.config.endDateField}" was not found.`);
    }
    for (const itemId of itemIds) {
      await list.items.getById(itemId).update({ [endField]: endDate.toISOString() });
    }
  }

  /** Internal names and titles of a list's fields, fetched once per list. */
  private async getFields(listTitle: string): Promise<IFieldInfo[]> {
    if (this.fieldCache[listTitle]) {
      return this.fieldCache[listTitle];
    }
    try {
      const fields: IFieldInfo[] = await this.sp.web.lists
        .getByTitle(listTitle)
        .fields.select('InternalName', 'Title')();
      this.fieldCache[listTitle] = fields || [];
    } catch {
      this.fieldCache[listTitle] = [];
    }
    return this.fieldCache[listTitle];
  }

  /**
   * Resolves a configured field name to its internal name. Matches the internal
   * name, the encoded form ("Start Date" -> Start_x0020_Date) and the display title,
   * so the property pane accepts either form.
   */
  private resolveField(
    fields: IFieldInfo[],
    configured: string | undefined,
    fallback?: string
  ): string | undefined {
    const candidates = [configured, fallback]
      .map((value) => (value || '').trim())
      .filter((value) => value.length > 0);

    for (const candidate of candidates) {
      const encoded = candidate.replace(/ /g, '_x0020_');
      const lower = candidate.toLowerCase();

      const byInternal = fields.filter(
        (field) => field.InternalName === candidate || field.InternalName === encoded
      )[0];
      if (byInternal) {
        return byInternal.InternalName;
      }
      const byTitle = fields.filter((field) => (field.Title || '').toLowerCase() === lower)[0];
      if (byTitle) {
        return byTitle.InternalName;
      }
      // No field metadata available (e.g. the fields call failed) - trust the config.
      if (fields.length === 0) {
        return candidate.indexOf(' ') !== -1 ? encoded : candidate;
      }
    }
    return undefined;
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
