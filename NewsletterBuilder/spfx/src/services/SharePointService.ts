import { SPHttpClient, SPHttpClientResponse, ISPHttpClientOptions } from '@microsoft/sp-http';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IFieldDef {
  internalName: string;
  xml: string;
}

export interface INewsletterFile {
  name: string;
  serverRelativeUrl: string;
  title: string;
  modified: string;
  modifiedBy: string;
}

export interface IScheduleItem {
  Id?: number;
  Title: string;
  NLNewsletterFile: string;
  NLMailPackageUrl: string;
  NLEmailSubject: string;
  NLScheduledSend: string;
  NLToRecipients: string;
  NLCcRecipients: string;
  NLBccRecipients: string;
  NLRecipientGroupIds: string;
  NLSendFrom: string;
  NLImportance: string;
  NLSendStatus: string;
  NLSentOn?: string;
  NLStatusMessage?: string;
  Author?: { Title: string };
}

export interface IProvisionResult {
  libraryCreated: boolean;
  listCreated: boolean;
  fieldsAdded: string[];
  libraryRootUrl: string;
  listUrl: string;
}

const NEWSLETTER_SUFFIX = '.newsletter.json';

/** Columns added to the newsletter document library. */
const LIBRARY_FIELDS: IFieldDef[] = [
  { internalName: 'NLNewsletterTitle', xml: '<Field Type="Text" Name="NLNewsletterTitle" StaticName="NLNewsletterTitle" DisplayName="Newsletter title" MaxLength="255" />' },
  { internalName: 'NLEmailSubject', xml: '<Field Type="Text" Name="NLEmailSubject" StaticName="NLEmailSubject" DisplayName="Email subject" MaxLength="255" />' },
  { internalName: 'NLFileKind', xml: '<Field Type="Choice" Name="NLFileKind" StaticName="NLFileKind" DisplayName="Newsletter file kind" Format="Dropdown"><CHOICES><CHOICE>Newsletter</CHOICE><CHOICE>Email HTML</CHOICE><CHOICE>Mail package</CHOICE></CHOICES></Field>' },
  { internalName: 'NLAppVersion', xml: '<Field Type="Text" Name="NLAppVersion" StaticName="NLAppVersion" DisplayName="Builder version" MaxLength="50" />' }
];

/** Columns added to the schedule list. Power Automate reads these. */
const SCHEDULE_FIELDS: IFieldDef[] = [
  { internalName: 'NLNewsletterFile', xml: '<Field Type="Text" Name="NLNewsletterFile" StaticName="NLNewsletterFile" DisplayName="Newsletter file" MaxLength="255" />' },
  { internalName: 'NLMailPackageUrl', xml: '<Field Type="Text" Name="NLMailPackageUrl" StaticName="NLMailPackageUrl" DisplayName="Mail package URL" MaxLength="255" />' },
  { internalName: 'NLEmailSubject', xml: '<Field Type="Text" Name="NLEmailSubject" StaticName="NLEmailSubject" DisplayName="Email subject" MaxLength="255" />' },
  { internalName: 'NLScheduledSend', xml: '<Field Type="DateTime" Name="NLScheduledSend" StaticName="NLScheduledSend" DisplayName="Scheduled send (UTC stored)" Format="DateTime" Required="TRUE" />' },
  { internalName: 'NLToRecipients', xml: '<Field Type="Note" Name="NLToRecipients" StaticName="NLToRecipients" DisplayName="To (emails ; separated)" NumLines="3" RichText="FALSE" />' },
  { internalName: 'NLCcRecipients', xml: '<Field Type="Note" Name="NLCcRecipients" StaticName="NLCcRecipients" DisplayName="Cc (emails ; separated)" NumLines="2" RichText="FALSE" />' },
  { internalName: 'NLBccRecipients', xml: '<Field Type="Note" Name="NLBccRecipients" StaticName="NLBccRecipients" DisplayName="Bcc (emails ; separated)" NumLines="2" RichText="FALSE" />' },
  { internalName: 'NLRecipientGroupIds', xml: '<Field Type="Note" Name="NLRecipientGroupIds" StaticName="NLRecipientGroupIds" DisplayName="Recipient group IDs (; separated)" NumLines="2" RichText="FALSE" />' },
  { internalName: 'NLSendFrom', xml: '<Field Type="Text" Name="NLSendFrom" StaticName="NLSendFrom" DisplayName="Send from (shared mailbox, optional)" MaxLength="255" />' },
  { internalName: 'NLImportance', xml: '<Field Type="Choice" Name="NLImportance" StaticName="NLImportance" DisplayName="Importance" Format="Dropdown"><Default>normal</Default><CHOICES><CHOICE>low</CHOICE><CHOICE>normal</CHOICE><CHOICE>high</CHOICE></CHOICES></Field>' },
  { internalName: 'NLSendStatus', xml: '<Field Type="Choice" Name="NLSendStatus" StaticName="NLSendStatus" DisplayName="Send status" Format="Dropdown" Indexed="TRUE"><Default>Scheduled</Default><CHOICES><CHOICE>Draft</CHOICE><CHOICE>Scheduled</CHOICE><CHOICE>Sending</CHOICE><CHOICE>Sent</CHOICE><CHOICE>Failed</CHOICE><CHOICE>Cancelled</CHOICE></CHOICES></Field>' },
  { internalName: 'NLSentOn', xml: '<Field Type="DateTime" Name="NLSentOn" StaticName="NLSentOn" DisplayName="Sent on" Format="DateTime" />' },
  { internalName: 'NLStatusMessage', xml: '<Field Type="Note" Name="NLStatusMessage" StaticName="NLStatusMessage" DisplayName="Status message" NumLines="3" RichText="FALSE" />' }
];

function q(s: string): string {
  // OData string literal inside a URL: double single quotes, then URL-encode
  return encodeURIComponent(s.replace(/'/g, "''"));
}

export class SharePointService {
  private _libRoot: string = '';
  private _libId: string = '';
  private _listId: string = '';
  private _listUrl: string = '';

  public constructor(
    private readonly _http: SPHttpClient,
    private readonly _webUrl: string,
    public libraryTitle: string,
    public scheduleListTitle: string
  ) { }

  public get libraryRootUrl(): string { return this._libRoot; }
  public get scheduleListUrl(): string { return this._listUrl; }

  /* ------------------------------------------------------------- http */

  private async _get(url: string): Promise<any> {
    const r = await this._http.get(this._webUrl + url, SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' } });
    if (!r.ok) throw await this._error(r);
    return r.json();
  }

  private async _getText(url: string): Promise<string> {
    const r = await this._http.get(this._webUrl + url, SPHttpClient.configurations.v1, { headers: { Accept: '*/*' } });
    if (!r.ok) throw await this._error(r);
    return r.text();
  }

  private async _post(url: string, body?: any, extraHeaders?: Record<string, string>, raw?: boolean): Promise<any> {
    const opts: ISPHttpClientOptions = {
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': raw ? 'text/plain' : 'application/json;odata=nometadata',
        ...(extraHeaders || {})
      },
      body: body === undefined ? undefined : (raw ? body : JSON.stringify(body))
    };
    const r = await this._http.post(this._webUrl + url, SPHttpClient.configurations.v1, opts);
    if (!r.ok) throw await this._error(r);
    if (r.status === 204) return undefined;
    const t = await r.text();
    return t ? JSON.parse(t) : undefined;
  }

  private async _error(r: SPHttpClientResponse): Promise<Error> {
    let msg = r.status + ' ' + r.statusText;
    try {
      const j = await r.json();
      msg = (j && (j['odata.error'] ? j['odata.error'].message.value : (j.error && (j.error.message.value || j.error.message)))) || msg;
    } catch { /* not json */ }
    const e = new Error(msg) as Error & { status?: number };
    e.status = r.status;
    return e;
  }

  /* ------------------------------------------------------- provisioning */

  /** Make sure the library and the schedule list exist with all required columns. Creates what is missing. */
  public async ensureProvisioned(): Promise<IProvisionResult> {
    const res: IProvisionResult = { libraryCreated: false, listCreated: false, fieldsAdded: [], libraryRootUrl: '', listUrl: '' };

    const lib = await this._ensureList(this.libraryTitle, 101, 'Newsletters created with Newsletter Builder (.newsletter.json = editable source, .html = rendered email, .mail.json = package used by Power Automate).');
    res.libraryCreated = lib.created;
    this._libId = lib.id;
    this._libRoot = lib.rootUrl;
    res.fieldsAdded.push(...await this._ensureFields(lib.id, LIBRARY_FIELDS));

    const list = await this._ensureList(this.scheduleListTitle, 100, 'Scheduled newsletter sends. Processed by a Power Automate flow (see Newsletter Builder docs).');
    res.listCreated = list.created;
    this._listId = list.id;
    this._listUrl = list.rootUrl;
    res.fieldsAdded.push(...await this._ensureFields(list.id, SCHEDULE_FIELDS));

    res.libraryRootUrl = this._libRoot;
    res.listUrl = this._listUrl;
    return res;
  }

  /** Resolve the library and list without creating anything (auto-provision turned off). */
  public async ensureProvisionedReadOnly(): Promise<void> {
    const sel = '?$select=Id,RootFolder/ServerRelativeUrl&$expand=RootFolder';
    const lib = await this._get(`/_api/web/lists/getByTitle('${q(this.libraryTitle)}')${sel}`);
    const list = await this._get(`/_api/web/lists/getByTitle('${q(this.scheduleListTitle)}')${sel}`);
    this._libId = lib.Id; this._libRoot = lib.RootFolder.ServerRelativeUrl;
    this._listId = list.Id; this._listUrl = list.RootFolder.ServerRelativeUrl;
  }

  private async _ensureList(title: string, template: number, description: string): Promise<{ id: string; rootUrl: string; created: boolean }> {
    try {
      const l = await this._get(`/_api/web/lists/getByTitle('${q(title)}')?$select=Id,RootFolder/ServerRelativeUrl&$expand=RootFolder`);
      return { id: l.Id, rootUrl: l.RootFolder.ServerRelativeUrl, created: false };
    } catch (e) {
      if ((e as any).status !== 404) throw e;
    }
    const created = await this._post('/_api/web/lists', {
      Title: title,
      BaseTemplate: template,
      Description: description,
      AllowContentTypes: true,
      ContentTypesEnabled: false
    });
    const l2 = await this._get(`/_api/web/lists(guid'${created.Id}')?$select=Id,RootFolder/ServerRelativeUrl&$expand=RootFolder`);
    if (template === 101) {
      // keep version history so overwritten newsletters can be restored
      await this._post(`/_api/web/lists(guid'${created.Id}')`, { EnableVersioning: true }, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }).catch(() => undefined);
    }
    return { id: created.Id, rootUrl: l2.RootFolder.ServerRelativeUrl, created: true };
  }

  private async _ensureFields(listId: string, fields: IFieldDef[]): Promise<string[]> {
    const existing = await this._get(`/_api/web/lists(guid'${listId}')/fields?$select=InternalName&$top=500`);
    const names: Record<string, boolean> = {};
    (existing.value as { InternalName: string }[]).forEach(f => { names[f.InternalName] = true; });
    const added: string[] = [];
    for (const f of fields) {
      if (names[f.internalName]) continue;
      // Options: 8 = AddFieldInternalNameHint (use Name as internal name), 16 = AddFieldToDefaultView
      await this._post(`/_api/web/lists(guid'${listId}')/fields/CreateFieldAsXml`, { parameters: { SchemaXml: f.xml, Options: 8 | 16 } });
      added.push(f.internalName);
    }
    return added;
  }

  /* ----------------------------------------------------------- files */

  public async listNewsletters(): Promise<INewsletterFile[]> {
    const data = await this._get(
      `/_api/web/GetFolderByServerRelativePath(decodedurl='${q(this._libRoot)}')/Files` +
      `?$select=Name,ServerRelativeUrl,TimeLastModified,ModifiedBy/Title,ListItemAllFields/NLNewsletterTitle&$expand=ModifiedBy,ListItemAllFields&$top=5000`);
    return (data.value as any[])
      .filter(f => String(f.Name).toLowerCase().endsWith(NEWSLETTER_SUFFIX))
      .map(f => ({
        name: f.Name,
        serverRelativeUrl: f.ServerRelativeUrl,
        title: (f.ListItemAllFields && f.ListItemAllFields.NLNewsletterTitle) || f.Name.slice(0, -NEWSLETTER_SUFFIX.length),
        modified: f.TimeLastModified,
        modifiedBy: f.ModifiedBy ? f.ModifiedBy.Title : ''
      }))
      .sort((a, b) => (a.modified < b.modified ? 1 : -1));
  }

  public readFile(serverRelativeUrl: string): Promise<string> {
    return this._getText(`/_api/web/GetFileByServerRelativePath(decodedurl='${q(serverRelativeUrl)}')/$value`);
  }

  public async fileExists(fileName: string): Promise<boolean> {
    try {
      await this._get(`/_api/web/GetFileByServerRelativePath(decodedurl='${q(this._libRoot + '/' + fileName)}')?$select=Name`);
      return true;
    } catch (e) {
      if ((e as any).status === 404) return false;
      throw e;
    }
  }

  public async uploadFile(fileName: string, content: string, fields: Record<string, string>): Promise<string> {
    const f = await this._post(
      `/_api/web/GetFolderByServerRelativePath(decodedurl='${q(this._libRoot)}')/Files/AddUsingPath(decodedurl='${q(fileName)}',overwrite=true)`,
      content, undefined, true);
    const url: string = f.ServerRelativeUrl;
    const formValues = Object.keys(fields).map(k => ({ FieldName: k, FieldValue: fields[k] || '' }));
    if (formValues.length) {
      const r = await this._post(`/_api/web/GetFileByServerRelativePath(decodedurl='${q(url)}')/ListItemAllFields/ValidateUpdateListItem`,
        { formValues, bNewDocumentUpdate: false });
      const errs = ((r && r.value) || []).filter((v: any) => v.HasException);
      if (errs.length) console.warn('[Newsletter Builder] metadata update issues', errs);
    }
    return url;
  }

  public async recycleFile(serverRelativeUrl: string): Promise<void> {
    await this._post(`/_api/web/GetFileByServerRelativePath(decodedurl='${q(serverRelativeUrl)}')/recycle()`);
  }

  /* -------------------------------------------------------- schedules */

  public async createSchedule(item: IScheduleItem): Promise<number> {
    const r = await this._post(`/_api/web/lists(guid'${this._listId}')/items`, item);
    return r.Id;
  }

  public async listSchedules(): Promise<IScheduleItem[]> {
    const sel = ['Id', 'Title', 'NLNewsletterFile', 'NLMailPackageUrl', 'NLEmailSubject', 'NLScheduledSend', 'NLToRecipients', 'NLCcRecipients', 'NLBccRecipients',
      'NLRecipientGroupIds', 'NLSendFrom', 'NLImportance', 'NLSendStatus', 'NLSentOn', 'NLStatusMessage', 'Author/Title'];
    const data = await this._get(`/_api/web/lists(guid'${this._listId}')/items?$select=${sel.join(',')}&$expand=Author&$orderby=NLScheduledSend desc&$top=200`);
    return data.value;
  }

  public async updateScheduleStatus(id: number, status: string, message?: string): Promise<void> {
    await this._post(`/_api/web/lists(guid'${this._listId}')/items(${id})`, { NLSendStatus: status, NLStatusMessage: message || '' }, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
  }
}

export const FILE_SUFFIX = {
  newsletter: NEWSLETTER_SUFFIX,
  html: '.email.html',
  mail: '.mail.json'
};
