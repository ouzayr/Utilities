/* Minimal typings for the shared plain-JS editor (src/core/nl-editor.js). */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { INewsletterDoc, IGraphMessage } from './nl-core';

export interface IModalAction { label: string; primary?: boolean; danger?: boolean; onClick?: (m: IModalHandle) => boolean | void; }
export interface IModalHandle { el: HTMLElement; body: HTMLElement; close(): void; }
export interface IEditorApi {
  getDoc(): INewsletterDoc;
  setDoc(doc: INewsletterDoc, meta?: { ref?: string | null; name?: string | null; dirty?: boolean }): void;
  getRef(): string | null;
  getName(): string | null;
  isDirty(): boolean;
  renderHtml(): string;
  graphMessage(): IGraphMessage;
  serialize(): string;
  save(saveAs: boolean): Promise<void>;
  toast(msg: string, kind?: 'ok' | 'err'): void;
  status(msg: string): void;
  modal(o: { title: string; body: any; actions?: IModalAction[]; size?: 'mid' | 'wide'; onClose?: () => void; sticky?: boolean }): IModalHandle;
  confirm(title: string, msg: string, okLabel?: string): Promise<boolean>;
  h(tag: string, attrs?: any, ...children: any[]): HTMLElement;
  download(name: string, content: string | Blob, type?: string): void;
  banner(el: HTMLElement): void;
  destroy(): void;
}
export interface IOpenResult { doc: any; ref: string | null; name: string; }
export interface ISaveResult { ref: string | null; name: string; }
export interface IProvider {
  openLabel?: string;
  saveLabel?: string;
  locationLabel?: string;
  showImportExport?: boolean;
  open?: (editor: IEditorApi) => Promise<IOpenResult | null>;
  save?: (editor: IEditorApi, opt: { saveAs: boolean }) => Promise<ISaveResult | null>;
}
export interface IEditorOptions {
  appName?: string;
  version?: string;
  provider?: IProvider;
  actions?: { id: string; label: string; title?: string; primary?: boolean; run: (editor: IEditorApi) => void }[];
  autosaveKey?: string | null;
  footerNote?: string;
  initialTemplate?: string;
  warnOnUnload?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}
export declare function create(container: HTMLElement, options: IEditorOptions): IEditorApi;
export declare const VERSION: string;
