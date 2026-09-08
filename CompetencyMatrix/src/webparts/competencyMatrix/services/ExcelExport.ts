/**
 * Minimal XLSX writer. An .xlsx file is a ZIP archive of XML parts, so the few
 * parts Excel needs are written by hand and stored uncompressed - that keeps the
 * export dependency-free instead of pulling a spreadsheet library into the bundle.
 */

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const encodeUtf8 = (text: string): Uint8Array => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }
  // Fallback for older hosts: percent-encoding round trip.
  const binary = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

interface IZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
}

class ByteWriter {
  private chunks: number[] = [];

  public get length(): number {
    return this.chunks.length;
  }

  public u16(value: number): void {
    this.chunks.push(value & 0xff, (value >>> 8) & 0xff);
  }

  public u32(value: number): void {
    this.chunks.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  }

  public bytes(data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.chunks.push(data[i]);
    }
  }

  public toUint8Array(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

/** Builds a ZIP archive using stored (uncompressed) entries. */
const zip = (files: Array<{ name: string; content: string }>, now: Date): Uint8Array => {
  const dosTime =
    ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

  const entries: IZipEntry[] = files.map((file) => {
    const data = encodeUtf8(file.content);
    return { name: file.name, data, crc: crc32(data) };
  });

  const out = new ByteWriter();
  const offsets: number[] = [];

  entries.forEach((entry) => {
    const nameBytes = encodeUtf8(entry.name);
    offsets.push(out.length);
    out.u32(0x04034b50); // local file header
    out.u16(20); // version needed
    out.u16(0x0800); // UTF-8 names
    out.u16(0); // stored
    out.u16(dosTime);
    out.u16(dosDate);
    out.u32(entry.crc);
    out.u32(entry.data.length);
    out.u32(entry.data.length);
    out.u16(nameBytes.length);
    out.u16(0);
    out.bytes(nameBytes);
    out.bytes(entry.data);
  });

  const centralStart = out.length;
  entries.forEach((entry, index) => {
    const nameBytes = encodeUtf8(entry.name);
    out.u32(0x02014b50); // central directory header
    out.u16(20); // version made by
    out.u16(20); // version needed
    out.u16(0x0800);
    out.u16(0);
    out.u16(dosTime);
    out.u16(dosDate);
    out.u32(entry.crc);
    out.u32(entry.data.length);
    out.u32(entry.data.length);
    out.u16(nameBytes.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk
    out.u16(0); // internal attrs
    out.u32(0); // external attrs
    out.u32(offsets[index]);
    out.bytes(nameBytes);
  });
  const centralEnd = out.length;

  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(entries.length);
  out.u16(entries.length);
  out.u32(centralEnd - centralStart);
  out.u32(centralStart);
  out.u16(0);

  return out.toUint8Array();
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Control characters are illegal in XML 1.0 and make Excel reject the file.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

const columnName = (index: number): string => {
  let name = '';
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
};

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF0078D4"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border/></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

const workbookXml = (sheetName: string): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
  '</workbook>';

const sheetXml = (rows: string[][], widths: number[]): string => {
  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const body = rows
    .map((row, rowIndex) => {
      const styleAttr = rowIndex === 0 ? ' s="1"' : '';
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnName(colIndex)}${rowIndex + 1}`;
          if (value === undefined || value === null || value === '') {
            return `<c r="${ref}"${styleAttr}/>`;
          }
          return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(
            String(value)
          )}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const lastColumn = columnName(Math.max(1, widths.length) - 1);
  const dimension = `A1:${lastColumn}${Math.max(1, rows.length)}`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="${dimension}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${body}</sheetData>` +
    `<autoFilter ref="${dimension}"/>` +
    '</worksheet>'
  );
};

export interface IWorkbookOptions {
  sheetName: string;
  /** Column widths in characters; defaults to 24 per column. */
  widths?: number[];
}

/** Builds an .xlsx file (first row treated as the header) as raw bytes. */
export const buildWorkbook = (rows: string[][], options: IWorkbookOptions): Uint8Array => {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 1);
  const widths: number[] = [];
  for (let i = 0; i < columnCount; i++) {
    widths.push((options.widths && options.widths[i]) || 24);
  }

  return zip(
    [
      { name: '[Content_Types].xml', content: CONTENT_TYPES },
      { name: '_rels/.rels', content: ROOT_RELS },
      { name: 'xl/workbook.xml', content: workbookXml(options.sheetName) },
      { name: 'xl/_rels/workbook.xml.rels', content: WORKBOOK_RELS },
      { name: 'xl/styles.xml', content: STYLES },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml(rows, widths) }
    ],
    new Date()
  );
};

/** Builds the workbook and hands it to the browser as a download. */
export const downloadWorkbook = (
  rows: string[][],
  fileName: string,
  options: IWorkbookOptions
): void => {
  const bytes = buildWorkbook(rows, options);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const navigatorAny = window.navigator as any;
  if (navigatorAny.msSaveOrOpenBlob) {
    navigatorAny.msSaveOrOpenBlob(blob, fileName);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
