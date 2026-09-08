import { MSGraphClientFactory, MSGraphClientV3 } from '@microsoft/sp-http';
import { SPFI } from '@pnp/sp';
import '@pnp/sp/profiles';
import { IUserProfile, IProfileDetail, IPerson } from '../models';

/**
 * Reads a person's Entra ID (Azure AD) profile.
 *
 * Microsoft Graph is the primary source and needs the User.Read.All permission
 * approved in the SharePoint admin center (API access). Until that is approved -
 * or if the call fails - the SharePoint user profile store is used instead, which
 * needs no extra consent but exposes fewer properties.
 */

/** Graph properties requested for every person. */
const GRAPH_SELECT = [
  'displayName',
  'givenName',
  'surname',
  'mail',
  'userPrincipalName',
  'jobTitle',
  'department',
  'companyName',
  'officeLocation',
  'mobilePhone',
  'businessPhones',
  'streetAddress',
  'city',
  'state',
  'postalCode',
  'country',
  'employeeId',
  'employeeType',
  'preferredLanguage',
  'usageLocation',
  'faxNumber',
  'otherMails'
].join(',');

/** Labels for the "additional details" list, in the order they should appear. */
const GRAPH_DETAIL_LABELS: Array<{ key: string; label: string }> = [
  { key: 'companyName', label: 'Company' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'employeeType', label: 'Employee type' },
  { key: 'givenName', label: 'First name' },
  { key: 'surname', label: 'Last name' },
  { key: 'userPrincipalName', label: 'User principal name' },
  { key: 'otherMails', label: 'Other email' },
  { key: 'faxNumber', label: 'Fax' },
  { key: 'streetAddress', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postalCode', label: 'Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'usageLocation', label: 'Usage location' },
  { key: 'preferredLanguage', label: 'Preferred language' }
];

/** SharePoint user-profile properties used when Graph is unavailable. */
const SP_DETAIL_LABELS: Array<{ key: string; label: string }> = [
  { key: 'SPS-JobTitle', label: 'Job title' },
  { key: 'Department', label: 'Department' },
  { key: 'SPS-Department', label: 'Department path' },
  { key: 'Office', label: 'Office' },
  { key: 'SPS-Location', label: 'Location' },
  { key: 'WorkEmail', label: 'Email' },
  { key: 'SPS-HireDate', label: 'Hire date' },
  { key: 'SPS-Skills', label: 'Skills' },
  { key: 'SPS-PastProjects', label: 'Past projects' },
  { key: 'SPS-Interests', label: 'Interests' },
  { key: 'SPS-School', label: 'Schools' },
  { key: 'AboutMe', label: 'About' }
];

const toText = (value: any): string => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== undefined && entry !== null && entry !== '').join(', ');
  }
  return String(value);
};

/** "i:0#.f|membership|someone@contoso.com" -> "someone@contoso.com" */
const emailFromLoginName = (loginName: string): string | undefined => {
  if (!loginName) {
    return undefined;
  }
  const parts = loginName.split('|');
  const candidate = parts[parts.length - 1];
  return candidate && candidate.indexOf('@') !== -1 ? candidate : undefined;
};

export class ProfileService {
  private cache: { [email: string]: Promise<IUserProfile> } = {};
  private graphClient: Promise<MSGraphClientV3> | undefined;

  constructor(
    private readonly sp: SPFI,
    private readonly graphFactory: MSGraphClientFactory | undefined
  ) {}

  /** Cached per person for the lifetime of the web part. */
  public getProfile(person: IPerson): Promise<IUserProfile> {
    const email = (person.email || '').toLowerCase();
    if (!email) {
      return Promise.resolve({ details: [], source: 'none' });
    }
    if (!this.cache[email]) {
      this.cache[email] = this.loadProfile(person.email as string).catch(
        (): IUserProfile => ({ details: [], source: 'none' })
      );
    }
    return this.cache[email];
  }

  private async loadProfile(email: string): Promise<IUserProfile> {
    try {
      return await this.loadFromGraph(email);
    } catch {
      // Graph permission not approved yet, or the user is not in the directory.
      try {
        return await this.loadFromSharePoint(email);
      } catch {
        return { details: [], source: 'none' };
      }
    }
  }

  private async getGraphClient(): Promise<MSGraphClientV3> {
    if (!this.graphFactory) {
      throw new Error('Microsoft Graph is not available in this context.');
    }
    if (!this.graphClient) {
      this.graphClient = this.graphFactory.getClient('3');
    }
    return this.graphClient;
  }

  private async loadFromGraph(email: string): Promise<IUserProfile> {
    const client = await this.getGraphClient();
    const path = `/users/${encodeURIComponent(email)}`;
    const user: any = await client.api(path).select(GRAPH_SELECT).get();

    let manager: IUserProfile['manager'];
    try {
      const managerResponse: any = await client
        .api(`${path}/manager`)
        .select('displayName,mail,jobTitle,userPrincipalName')
        .get();
      if (managerResponse && managerResponse.displayName) {
        manager = {
          name: managerResponse.displayName,
          email: managerResponse.mail || managerResponse.userPrincipalName,
          jobTitle: managerResponse.jobTitle
        };
      }
    } catch {
      // 404 simply means no manager is set in the directory.
    }

    const businessPhones: string[] = Array.isArray(user.businessPhones) ? user.businessPhones : [];

    const details: IProfileDetail[] = [];
    GRAPH_DETAIL_LABELS.forEach(({ key, label }) => {
      const value = toText(user[key]);
      if (value) {
        details.push({ label, value });
      }
    });
    if (businessPhones.length > 1) {
      details.push({ label: 'Other work phones', value: businessPhones.slice(1).join(', ') });
    }

    return {
      jobTitle: user.jobTitle || undefined,
      department: user.department || undefined,
      mobilePhone: user.mobilePhone || undefined,
      businessPhone: businessPhones[0] || undefined,
      officeLocation: user.officeLocation || undefined,
      manager,
      details,
      source: 'graph'
    };
  }

  private async loadFromSharePoint(email: string): Promise<IUserProfile> {
    const loginName = `i:0#.f|membership|${email}`;
    const profile: any = await this.sp.profiles.getPropertiesFor(loginName);

    const properties: { [key: string]: string } = {};
    const raw: any[] = (profile && profile.UserProfileProperties) || [];
    raw.forEach((entry) => {
      if (entry && entry.Key) {
        properties[entry.Key] = toText(entry.Value);
      }
    });

    const managerLogin = properties.Manager || '';
    const managerEmail = emailFromLoginName(managerLogin);
    const manager = managerEmail
      ? { name: managerEmail.split('@')[0].replace(/[._]/g, ' '), email: managerEmail }
      : undefined;

    const jobTitle = properties['SPS-JobTitle'] || properties.Title || undefined;

    const details: IProfileDetail[] = [];
    SP_DETAIL_LABELS.forEach(({ key, label }) => {
      const value = properties[key];
      if (value) {
        details.push({ label, value });
      }
    });

    return {
      jobTitle,
      department: properties.Department || undefined,
      mobilePhone: properties.CellPhone || undefined,
      businessPhone: properties.WorkPhone || undefined,
      officeLocation: properties.Office || properties['SPS-Location'] || undefined,
      manager,
      details,
      source: 'sharepoint'
    };
  }
}
