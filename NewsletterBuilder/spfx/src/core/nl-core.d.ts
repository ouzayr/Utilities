/* Minimal typings for the shared plain-JS core (src/core/nl-core.js). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface INewsletterDoc {
  id: string;
  title: string;
  subject: string;
  preheader: string;
  schemaVersion: number;
  appVersion: string;
  theme: any;
  sections: any[];
  [key: string]: any;
}
export interface IGraphMessage {
  subject: string;
  body: { contentType: string; content: string };
  attachments: any[];
}
export declare const VERSION: string;
export declare function render(doc: INewsletterDoc, opts?: { editor?: boolean }): string;
export declare function serialize(doc: INewsletterDoc): string;
export declare function normalizeDocument(raw: any): INewsletterDoc;
export declare function buildGraphMessage(doc: INewsletterDoc): IGraphMessage;
export declare const util: { slugify(s: string): string; esc(s: string): string; [k: string]: any };
