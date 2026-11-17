import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle,
  PropertyPaneButton,
  PropertyPaneButtonType,
  PropertyPaneLabel
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import styles from './NewsletterBuilderWebPart.module.scss';
import * as strings from 'NewsletterBuilderWebPartStrings';
import * as NLCore from '../../core/nl-core';
import * as NLEditor from '../../core/nl-editor';
import type { IEditorApi, IOpenResult, ISaveResult } from '../../core/nl-editor';
import { SharePointService, FILE_SUFFIX, type IScheduleItem, type INewsletterFile } from '../../services/SharePointService';
import { APP_VERSION } from '../../version';

export interface INewsletterBuilderWebPartProps {
  libraryTitle: string;
  scheduleListTitle: string;
  autoProvision: boolean;
  defaultTo: string;
  defaultCc: string;
  defaultBcc: string;
  defaultGroupIds: string;
  defaultFrom: string;
  defaultSendTime: string;
  height: number;
}

/** Graph sendMail rejects request bodies over 4 MB. Keep a margin. */
const MAX_MAIL_BYTES = 3.6 * 1024 * 1024;
const EMAIL_RE = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/;
function clear(el: HTMLElement): void { while (el.firstChild) el.removeChild(el.firstChild); }
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default class NewsletterBuilderWebPart extends BaseClientSideWebPart<INewsletterBuilderWebPartProps> {
  private _svc!: SharePointService;
  private _editor: IEditorApi | undefined;
  private _host: HTMLElement | undefined;
  private _ready: Promise<void> = Promise.resolve();
  private _readyError: Error | undefined;

  protected async onInit(): Promise<void> {
    await super.onInit();
    this._applyDefaults();
    this._svc = new SharePointService(this.context.spHttpClient, this.context.pageContext.web.absoluteUrl, this.properties.libraryTitle, this.properties.scheduleListTitle);
  }

  private _applyDefaults(): void {
    const p = this.properties;
    p.libraryTitle = (p.libraryTitle || 'Newsletters').trim();
    p.scheduleListTitle = (p.scheduleListTitle || 'Newsletter Schedule').trim();
    if (p.autoProvision === undefined) p.autoProvision = true;
    if (!p.defaultSendTime) p.defaultSendTime = '09:00';
    if (p.height === undefined || p.height === null) p.height = 900;
  }

  public render(): void {
    this._applyDefaults();
    const h = +this.properties.height;
    this.domElement.style.display = 'block';
    if (!this._host) {
      this._host = document.createElement('div');
      this._host.className = styles.host;
      this.domElement.innerHTML = '';
      this.domElement.appendChild(this._host);
      this._editor = NLEditor.create(this._host, {
        appName: 'Newsletter Builder',
        version: APP_VERSION,
        autosaveKey: 'nlb.sp.' + this.context.pageContext.web.id.toString(),
        footerNote: 'SharePoint · ' + this.properties.libraryTitle,
        provider: {
          openLabel: 'Open…',
          saveLabel: 'Save',
          locationLabel: 'SharePoint',
          showImportExport: true,
          open: (ed) => this._open(ed),
          save: (ed, o) => this._save(ed, o.saveAs)
        },
        actions: [
          { id: 'schedule', label: '🕑 Schedule send', title: 'Save and schedule this newsletter for sending by Power Automate', run: (ed) => { this._scheduleDialog(ed).catch(e => ed.toast(String(e.message || e), 'err')); } },
          { id: 'schedules', label: 'Schedules', title: 'View and cancel scheduled sends', run: (ed) => { this._schedulesDialog(ed).catch(e => ed.toast(String(e.message || e), 'err')); } }
        ]
      });
      this._provision(false);
    }
    this._host.style.height = h > 0 ? h + 'px' : 'calc(100vh - 160px)';
  }

  /* ------------------------------------------------------ provisioning */

  private _provision(force: boolean): void {
    const ed = this._editor!;
    this._svc.libraryTitle = this.properties.libraryTitle;
    this._svc.scheduleListTitle = this.properties.scheduleListTitle;
    this._readyError = undefined;
    ed.status('Connecting to SharePoint…');
    this._ready = (async () => {
      if (!this.properties.autoProvision && !force) {
        // still need ids/urls: ensureProvisioned only creates when missing, so call it but report a clear error if missing
        try { await this._svc.ensureProvisionedReadOnly(); ed.status(''); return; } catch (e) { this._fail(e as Error, 'The library or list does not exist and automatic creation is turned off.'); throw e; }
      }
      try {
        const r = await this._svc.ensureProvisioned();
        const created: string[] = [];
        if (r.libraryCreated) created.push('library "' + this.properties.libraryTitle + '"');
        if (r.listCreated) created.push('list "' + this.properties.scheduleListTitle + '"');
        if (created.length) ed.toast('Created ' + created.join(' and ') + ' on this site', 'ok');
        else if (r.fieldsAdded.length) ed.toast('Added missing columns: ' + r.fieldsAdded.join(', '), 'ok');
        ed.status('');
      } catch (e) {
        this._fail(e as Error, 'Could not check or create the newsletter library / schedule list. Site owner (Manage Lists) permission is needed the first time.');
        throw e;
      }
    })();
    this._ready.catch(() => undefined);
  }

  private _fail(e: Error, msg: string): void {
    this._readyError = e;
    const ed = this._editor!;
    ed.status('SharePoint storage unavailable - you can still Import/Export JSON files.');
    const bar = ed.h('div', { class: 'nlb-banner' },
      ed.h('span', { text: msg + ' (' + e.message + ')' }),
      ed.h('button', { text: 'Retry', onclick: () => { bar.remove(); this._provision(true); } }));
    ed.banner(bar);
  }

  private async _whenReady(): Promise<void> {
    await this._ready;
    if (this._readyError) throw this._readyError;
  }

  /* ---------------------------------------------------------- open */

  private async _open(ed: IEditorApi): Promise<IOpenResult | null> {
    await this._whenReady();
    const files = await this._svc.listNewsletters();
    return new Promise<IOpenResult | null>((resolve) => {
      let done = false;
      const finish = (v: IOpenResult | null): void => { if (!done) { done = true; resolve(v); } };
      const search = ed.h('input', { type: 'search', placeholder: 'Search newsletters…', style: { marginBottom: '10px' } }) as HTMLInputElement;
      const tbody = ed.h('tbody');
      const table = ed.h('table', { class: 'nlb-table' },
        ed.h('thead', null, ed.h('tr', null, ed.h('th', { text: 'Newsletter' }), ed.h('th', { text: 'Modified' }), ed.h('th', { text: 'By' }), ed.h('th'))), tbody);
      const holder: { m?: { close(): void } } = {};
      const paint = (): void => {
        tbody.innerHTML = '';
        const term = search.value.toLowerCase();
        const shown = files.filter(f => !term || (f.title + ' ' + f.name).toLowerCase().indexOf(term) >= 0);
        if (!shown.length) {
          tbody.appendChild(ed.h('tr', null, ed.h('td', { colspan: '4', class: 'nlb-empty', text: files.length ? 'No match.' : 'No newsletters saved in "' + this.properties.libraryTitle + '" yet.' })));
          return;
        }
        shown.forEach((f: INewsletterFile) => {
          const openIt = async (): Promise<void> => {
            try {
              const txt = await this._svc.readFile(f.serverRelativeUrl);
              if (holder.m) holder.m.close();
              finish({ doc: JSON.parse(txt), ref: f.serverRelativeUrl, name: f.name });
            } catch (e) { ed.toast('Could not open: ' + (e as Error).message, 'err'); }
          };
          const del = ed.h('button', { class: 'nlb-danger', text: 'Delete', onclick: async (ev: Event) => {
            ev.stopPropagation();
            if (!await ed.confirm('Delete newsletter?', 'Move "' + f.title + '" (and its generated email files) to the site recycle bin?', 'Delete')) return;
            const base = f.serverRelativeUrl.slice(0, -FILE_SUFFIX.newsletter.length);
            for (const u of [f.serverRelativeUrl, base + FILE_SUFFIX.html, base + FILE_SUFFIX.mail]) {
              await this._svc.recycleFile(u).catch(() => undefined);
            }
            files.splice(files.indexOf(f), 1);
            paint();
            ed.toast('Moved to recycle bin', 'ok');
          } });
          tbody.appendChild(ed.h('tr', { class: 'click', onclick: openIt },
            ed.h('td', null, ed.h('b', { text: f.title }), ed.h('div', { text: f.name, style: { color: '#6b7280', fontSize: '11px' } })),
            ed.h('td', { text: new Date(f.modified).toLocaleString() }),
            ed.h('td', { text: f.modifiedBy }),
            ed.h('td', { style: { textAlign: 'right' } }, del)));
        });
      };
      search.addEventListener('input', paint);
      paint();
      const libLink = ed.h('a', { href: this._svc.libraryRootUrl, target: '_blank', text: 'Open library in SharePoint ↗', style: { marginRight: 'auto', alignSelf: 'center' } });
      const handle = ed.modal({ title: 'Open newsletter from "' + this.properties.libraryTitle + '"', size: 'mid', body: [search, table], onClose: () => finish(null), actions: [{ label: 'Cancel' }] });
      holder.m = handle;
      const footer = handle.el.querySelector('.mf');
      if (footer) footer.insertBefore(libLink, footer.firstChild);
      setTimeout(() => search.focus(), 50);
    });
  }

  /* ---------------------------------------------------------- save */

  private _askName(ed: IEditorApi, suggested: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      let answered = false;
      const inp = ed.h('input', { type: 'text' }) as HTMLInputElement;
      inp.value = suggested;
      ed.modal({
        title: 'Save to SharePoint',
        body: [ed.h('div', { class: 'nlb-f' }, ed.h('label', { text: 'File name (saved in "' + this.properties.libraryTitle + '")' }), inp),
          ed.h('p', { class: 'nlb-hint', text: 'Three files are written: ' + FILE_SUFFIX.newsletter + ' (editable), ' + FILE_SUFFIX.html + ' (rendered email) and ' + FILE_SUFFIX.mail + ' (used by Power Automate).' })],
        onClose: () => { if (!answered) resolve(null); },
        actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
          const v = NLCore.util.slugify(inp.value);
          if (!v) return false;
          answered = true; resolve(v); return undefined;
        } }]
      });
      setTimeout(() => { inp.focus(); inp.select(); }, 50);
    });
  }

  private async _save(ed: IEditorApi, saveAs: boolean): Promise<ISaveResult | null> {
    await this._whenReady();
    const doc = ed.getDoc();
    const ref = ed.getRef();
    let base: string;
    if (ref && !saveAs && ref.toLowerCase().endsWith(FILE_SUFFIX.newsletter)) {
      base = ref.substring(ref.lastIndexOf('/') + 1).slice(0, -FILE_SUFFIX.newsletter.length);
    } else {
      const n = await this._askName(ed, NLCore.util.slugify(doc.title));
      if (!n) return null;
      base = n;
      if (await this._svc.fileExists(base + FILE_SUFFIX.newsletter)) {
        if (!await ed.confirm('Replace existing newsletter?', '"' + base + FILE_SUFFIX.newsletter + '" already exists. Replace it? (Previous versions stay in version history.)', 'Replace')) return null;
      }
    }
    const fields = { NLNewsletterTitle: doc.title || base, NLEmailSubject: doc.subject || '', NLAppVersion: APP_VERSION };
    const url = await this._svc.uploadFile(base + FILE_SUFFIX.newsletter, ed.serialize(), { ...fields, NLFileKind: 'Newsletter' });
    await this._svc.uploadFile(base + FILE_SUFFIX.html, ed.renderHtml(), { ...fields, NLFileKind: 'Email HTML' });
    await this._svc.uploadFile(base + FILE_SUFFIX.mail, JSON.stringify(ed.graphMessage()), { ...fields, NLFileKind: 'Mail package' });
    return { ref: url, name: base + FILE_SUFFIX.newsletter };
  }

  /* ------------------------------------------------------ scheduling */

  private _splitList(v: string): string[] {
    return String(v || '').split(/[;,\n]/).map(s => s.trim()).filter(Boolean);
  }

  private async _scheduleDialog(ed: IEditorApi): Promise<void> {
    await this._whenReady();
    const doc = ed.getDoc();
    const pkgSize = JSON.stringify(ed.graphMessage()).length;
    const p = this.properties;

    const field = (label: string, input: HTMLElement, hint?: string): HTMLElement =>
      ed.h('div', { class: 'nlb-f' }, ed.h('label', { text: label }), input, hint ? ed.h('div', { class: 'nlb-hint', style: { margin: '3px 0 0' }, text: hint }) : null);
    const mk = (tag: string, value: string, attrs?: Record<string, string>): HTMLInputElement => {
      const el = ed.h(tag, attrs || {}) as HTMLInputElement; el.value = value; return el;
    };

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const [hh, mm] = (/^\d{1,2}:\d{2}$/.test(p.defaultSendTime) ? p.defaultSendTime : '09:00').split(':');
    tomorrow.setHours(+hh, +mm, 0, 0);
    const pad = (n: number): string => (n < 10 ? '0' : '') + n;
    const localValue = tomorrow.getFullYear() + '-' + pad(tomorrow.getMonth() + 1) + '-' + pad(tomorrow.getDate()) + 'T' + pad(tomorrow.getHours()) + ':' + pad(tomorrow.getMinutes());

    const subject = mk('input', doc.subject || doc.title, { type: 'text' });
    const when = mk('input', localValue, { type: 'datetime-local' });
    const to = mk('textarea', p.defaultTo || '', { rows: '2', placeholder: 'name@company.com; team-dl@company.com' });
    const cc = mk('input', p.defaultCc || '', { type: 'text' });
    const bcc = mk('input', p.defaultBcc || '', { type: 'text' });
    const groups = mk('textarea', p.defaultGroupIds || '', { rows: '2', placeholder: '00000000-0000-0000-0000-000000000000' });
    const from = mk('input', p.defaultFrom || '', { type: 'text', placeholder: 'newsletter@company.com (optional)' });
    const importance = ed.h('select', null, ed.h('option', { value: 'normal', text: 'Normal' }), ed.h('option', { value: 'high', text: 'High' }), ed.h('option', { value: 'low', text: 'Low' })) as HTMLSelectElement;
    const err = ed.h('div', { style: { color: '#b91c1c', fontWeight: '600', minHeight: '18px' } });

    const sizeNote = ed.h('p', { class: 'nlb-hint', text: 'Email package size: ' + Math.round(pkgSize / 1024) + ' KB' + (pkgSize > MAX_MAIL_BYTES ? ' - TOO LARGE for Graph sendMail (4 MB). Reduce image count/size first.' : '') });
    if (pkgSize > MAX_MAIL_BYTES) sizeNote.style.color = '#b91c1c';

    ed.modal({
      title: 'Schedule send - ' + (doc.title || 'Untitled'),
      size: 'mid',
      sticky: true,
      body: [
        ed.h('p', { class: 'nlb-hint', style: { marginTop: '0' }, text: 'The newsletter is saved first, then a row is added to the "' + p.scheduleListTitle + '" list. Your Power Automate flow sends it at the scheduled time. Later edits saved before that time are included.' }),
        field('Email subject', subject),
        field('Send at (your local time)', when),
        field('To', to, 'Email addresses or distribution list / M365 group addresses, separated by ;'),
        field('Cc', cc), field('Bcc', bcc),
        field('Recipient group IDs (Entra ID / M365)', groups, 'Optional. The flow expands each group to its members.'),
        field('Send from (shared mailbox)', from, 'Optional. Leave empty to send as the flow owner. Requires Send As permission.'),
        field('Importance', importance),
        sizeNote, err
      ],
      actions: [
        { label: 'Cancel' },
        { label: 'Schedule', primary: true, onClick: (m) => {
          const toL = this._splitList(to.value), ccL = this._splitList(cc.value), bccL = this._splitList(bcc.value), gL = this._splitList(groups.value);
          const bad = toL.concat(ccL, bccL, this._splitList(from.value)).filter(x => !EMAIL_RE.test(x));
          const badG = gL.filter(x => !GUID_RE.test(x));
          const whenDate = new Date(when.value);
          let msg = '';
          if (!subject.value.trim()) msg = 'Subject is required.';
          else if (isNaN(whenDate.getTime())) msg = 'Pick a send date and time.';
          else if (!toL.length && !ccL.length && !bccL.length && !gL.length) msg = 'Add at least one recipient or group.';
          else if (bad.length) msg = 'Invalid email: ' + bad.join(', ');
          else if (badG.length) msg = 'Group IDs must be GUIDs: ' + badG.join(', ');
          else if (pkgSize > MAX_MAIL_BYTES) msg = 'Email is too large to send via Graph (max ~4 MB).';
          if (msg) { err.textContent = msg; return false; }
          err.textContent = 'Saving…';
          (async () => {
            if (whenDate.getTime() < Date.now() - 60000 && !await ed.confirm('Time is in the past', 'The chosen time is in the past - the flow will send it on its next run. Continue?', 'Continue')) { err.textContent = ''; return; }
            if (ed.isDirty() || !ed.getRef()) {
              await ed.save(false);
              if (ed.isDirty() || !ed.getRef()) { err.textContent = 'Save the newsletter first.'; return; }
            }
            const ref = ed.getRef()!;
            const base = ref.slice(0, -FILE_SUFFIX.newsletter.length);
            const item: IScheduleItem = {
              Title: ed.getDoc().title || 'Newsletter',
              NLNewsletterFile: ref,
              NLMailPackageUrl: base + FILE_SUFFIX.mail,
              NLEmailSubject: subject.value.trim(),
              NLScheduledSend: whenDate.toISOString(),
              NLToRecipients: toL.join('; '),
              NLCcRecipients: ccL.join('; '),
              NLBccRecipients: bccL.join('; '),
              NLRecipientGroupIds: gL.join('; '),
              NLSendFrom: from.value.trim(),
              NLImportance: importance.value,
              NLSendStatus: 'Scheduled'
            };
            await this._svc.createSchedule(item);
            m.close();
            ed.toast('Scheduled for ' + whenDate.toLocaleString(), 'ok');
          })().catch(e => { err.textContent = 'Failed: ' + (e as Error).message; });
          return false;
        } }
      ]
    });
  }

  private async _schedulesDialog(ed: IEditorApi): Promise<void> {
    await this._whenReady();
    const tbody = ed.h('tbody');
    const pillColor: Record<string, string> = { Scheduled: '#dbeafe', Sending: '#fef3c7', Sent: '#dcfce7', Failed: '#fee2e2', Cancelled: '#e5e7eb', Draft: '#f3f4f6' };
    const load = async (): Promise<void> => {
      tbody.innerHTML = '';
      tbody.appendChild(ed.h('tr', null, ed.h('td', { colspan: '6', class: 'nlb-empty', text: 'Loading…' })));
      const items = await this._svc.listSchedules();
      clear(tbody);
      if (!items.length) tbody.appendChild(ed.h('tr', null, ed.h('td', { colspan: '6', class: 'nlb-empty', text: 'Nothing scheduled yet.' })));
      items.forEach(it => {
        const st = it.NLSendStatus || 'Scheduled';
        const recip = [it.NLToRecipients, it.NLCcRecipients, it.NLBccRecipients].filter(Boolean).join('; ');
        const groupsN = this._splitList(it.NLRecipientGroupIds).length;
        const act = ed.h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } });
        if (st === 'Scheduled' || st === 'Draft') {
          act.appendChild(ed.h('button', { class: 'nlb-danger', text: 'Cancel', onclick: async () => {
            await this._svc.updateScheduleStatus(it.Id!, 'Cancelled', 'Cancelled from Newsletter Builder');
            ed.toast('Cancelled', 'ok'); await load();
          } }));
        } else if (st === 'Failed' || st === 'Cancelled') {
          act.appendChild(ed.h('button', { text: 'Re-queue', title: 'Set back to Scheduled (sends on next flow run if the time has passed)', onclick: async () => {
            await this._svc.updateScheduleStatus(it.Id!, 'Scheduled', '');
            ed.toast('Re-queued', 'ok'); await load();
          } }));
        }
        tbody.appendChild(ed.h('tr', null,
          ed.h('td', { text: it.NLScheduledSend ? new Date(it.NLScheduledSend).toLocaleString() : '' }),
          ed.h('td', null, ed.h('b', { text: it.Title }), ed.h('div', { text: it.NLEmailSubject, style: { color: '#6b7280', fontSize: '11px' } })),
          ed.h('td', { title: recip, text: (recip.length > 40 ? recip.slice(0, 40) + '…' : recip) + (groupsN ? ' +' + groupsN + ' group(s)' : '') }),
          ed.h('td', null, ed.h('span', { class: 'nlb-pill', style: { background: pillColor[st] || '#e5e7eb' }, text: st, title: it.NLStatusMessage || '' })),
          ed.h('td', { text: it.Author ? it.Author.Title : '' }),
          act));
      });
    };
    const table = ed.h('table', { class: 'nlb-table' },
      ed.h('thead', null, ed.h('tr', null, ['Send at', 'Newsletter', 'Recipients', 'Status', 'By', ''].map(t => ed.h('th', { text: t })))), tbody);
    ed.modal({
      title: 'Scheduled sends', size: 'wide',
      body: [ed.h('p', { class: 'nlb-hint', style: { marginTop: '0' } }, 'Stored in the "' + this.properties.scheduleListTitle + '" list. ', ed.h('a', { href: this._svc.scheduleListUrl, target: '_blank', text: 'Open list ↗' })), table],
      actions: [{ label: 'Refresh', onClick: () => { load().catch(e => ed.toast((e as Error).message, 'err')); return false; } }, { label: 'Close', primary: true }]
    });
    await load();
  }

  /* -------------------------------------------------- property pane */

  protected onPropertyPaneFieldChanged(propertyPath: string, oldValue: unknown, newValue: unknown): void {
    if ((propertyPath === 'libraryTitle' || propertyPath === 'scheduleListTitle') && oldValue !== newValue) {
      this._provision(false);
    }
    super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);
  }

  protected get disableReactivePropertyChanges(): boolean { return true; }

  protected onDispose(): void {
    if (this._editor) this._editor.destroy();
    super.onDispose();
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [{
        header: { description: strings.PropertyPaneDescription },
        groups: [
          {
            groupName: strings.StorageGroupName,
            groupFields: [
              PropertyPaneTextField('libraryTitle', { label: strings.LibraryTitleLabel }),
              PropertyPaneTextField('scheduleListTitle', { label: strings.ScheduleListTitleLabel }),
              PropertyPaneToggle('autoProvision', { label: strings.AutoProvisionLabel }),
              PropertyPaneButton('provisionNow', { text: strings.ProvisionNowLabel, buttonType: PropertyPaneButtonType.Normal, onClick: () => { this._provision(true); return ''; } }),
              PropertyPaneTextField('height', { label: strings.HeightLabel })
            ]
          },
          {
            groupName: strings.SendingGroupName,
            groupFields: [
              PropertyPaneTextField('defaultTo', { label: strings.DefaultToLabel, multiline: true }),
              PropertyPaneTextField('defaultCc', { label: strings.DefaultCcLabel }),
              PropertyPaneTextField('defaultBcc', { label: strings.DefaultBccLabel }),
              PropertyPaneTextField('defaultGroupIds', { label: strings.DefaultGroupIdsLabel, multiline: true }),
              PropertyPaneTextField('defaultFrom', { label: strings.DefaultFromLabel }),
              PropertyPaneTextField('defaultSendTime', { label: strings.DefaultSendTimeLabel })
            ]
          },
          {
            groupName: strings.AboutGroupName,
            groupFields: [
              PropertyPaneLabel('about', { text: 'Newsletter Builder v' + APP_VERSION + ' (editor core v' + NLCore.VERSION + ')' })
            ]
          }
        ]
      }]
    };
  }
}
