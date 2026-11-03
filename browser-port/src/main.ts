type PESection = {
  name: string;
  virtualAddress: number;
  virtualSize: number;
  rawOffset: number;
  rawSize: number;
  characteristics: number;
};

type ImportItem = { library: string; symbols: string[] };

type PEReport = {
  machine: number;
  sections: PESection[];
  entryRva: number;
  entryFileOffset: number | null;
  imageBase: number;
  bits: 32 | 64;
  imports: ImportItem[];
  strings: string[];
};

const byId = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required UI element: ${id}`);
  return node as T;
};

const statusNode = byId<HTMLDivElement>('status');
const reportNode = byId<HTMLPreElement>('report');
const reportTitle = byId<HTMLHeadingElement>('report-title');
const pickExeButton = byId<HTMLButtonElement>('pick-exe');
const pickFolderButton = byId<HTMLButtonElement>('pick-folder');
const copyButton = byId<HTMLButtonElement>('copy-report');

let latestReport = '';

function setStatus(message: string): void {
  statusNode.textContent = message;
}

function ensureRange(view: DataView, offset: number, size: number, label: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > view.byteLength) {
    throw new Error(`Invalid or truncated executable while reading ${label}.`);
  }
}

function readAscii(view: DataView, offset: number, length: number): string {
  ensureRange(view, offset, length, 'text field');
  let result = '';
  for (let i = 0; i < length; i++) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    result += code >= 32 && code <= 126 ? String.fromCharCode(code) : '.';
  }
  return result.trim();
}

function readCString(view: DataView, offset: number, limit = 512): string {
  if (offset < 0 || offset >= view.byteLength) return '';
  let result = '';
  const end = Math.min(view.byteLength, offset + limit);
  for (let i = offset; i < end; i++) {
    const byte = view.getUint8(i);
    if (byte === 0) break;
    if (byte < 32 || byte > 126) return '';
    result += String.fromCharCode(byte);
  }
  return result;
}

function parsePE(buffer: ArrayBuffer): PEReport {
  const view = new DataView(buffer);
  ensureRange(view, 0, 64, 'DOS header');
  if (view.getUint16(0, true) !== 0x5a4d) throw new Error('This file does not have an MZ executable header.');

  const peOffset = view.getUint32(0x3c, true);
  ensureRange(view, peOffset, 24, 'PE header');
  if (view.getUint32(peOffset, true) !== 0x00004550) throw new Error('The PE signature is missing.');

  const machine = view.getUint16(peOffset + 4, true);
  const sectionCount = view.getUint16(peOffset + 6, true);
  const optionalSize = view.getUint16(peOffset + 20, true);
  const optionalOffset = peOffset + 24;
  ensureRange(view, optionalOffset, optionalSize, 'optional header');

  const magic = view.getUint16(optionalOffset, true);
  const bits: 32 | 64 = magic === 0x10b ? 32 : magic === 0x20b ? 64 : 0 as never;
  if (bits !== 32 && bits !== 64) throw new Error(`Unsupported PE optional-header format: 0x${magic.toString(16)}.`);

  const entryRva = view.getUint32(optionalOffset + 16, true);
  const imageBase = bits === 32
    ? view.getUint32(optionalOffset + 28, true)
    : Number(view.getBigUint64(optionalOffset + 24, true));
  const directoryBase = optionalOffset + (bits === 32 ? 96 : 112);
  const numberOfDirectoriesOffset = optionalOffset + (bits === 32 ? 92 : 108);
  const directoryCount = optionalSize >= (numberOfDirectoriesOffset - optionalOffset + 4)
    ? view.getUint32(numberOfDirectoriesOffset, true)
    : 0;

  const sectionTable = optionalOffset + optionalSize;
  ensureRange(view, sectionTable, sectionCount * 40, 'section table');
  const sections: PESection[] = [];

  for (let i = 0; i < sectionCount; i++) {
    const offset = sectionTable + i * 40;
    sections.push({
      name: readAscii(view, offset, 8),
      virtualSize: view.getUint32(offset + 8, true),
      virtualAddress: view.getUint32(offset + 12, true),
      rawSize: view.getUint32(offset + 16, true),
      rawOffset: view.getUint32(offset + 20, true),
      characteristics: view.getUint32(offset + 36, true),
    });
  }

  const rvaToOffset = (rva: number): number | null => {
    for (const section of sections) {
      const span = Math.max(section.virtualSize, section.rawSize);
      if (rva >= section.virtualAddress && rva < section.virtualAddress + span) {
        const offset = section.rawOffset + (rva - section.virtualAddress);
        return offset < buffer.byteLength ? offset : null;
      }
    }
    const sizeOfHeaders = optionalSize >= 64 ? view.getUint32(optionalOffset + 60, true) : 0;
    return rva < sizeOfHeaders && rva < buffer.byteLength ? rva : null;
  };

  const entryFileOffset = rvaToOffset(entryRva);
  const imports: ImportItem[] = [];
  if (directoryCount > 1 && optionalSize >= (directoryBase - optionalOffset + 16)) {
    const importRva = view.getUint32(directoryBase + 8, true);
    const importSize = view.getUint32(directoryBase + 12, true);
    const importOffset = rvaToOffset(importRva);
    if (importRva && importSize && importOffset !== null) {
      const descriptorLimit = Math.min(200, Math.floor(importSize / 20));
      for (let i = 0; i < descriptorLimit; i++) {
        const descriptor = importOffset + i * 20;
        if (descriptor + 20 > buffer.byteLength) break;
        const originalThunk = view.getUint32(descriptor, true);
        const nameRva = view.getUint32(descriptor + 12, true);
        const firstThunk = view.getUint32(descriptor + 16, true);
        if (!originalThunk && !nameRva && !firstThunk) break;
        const nameOffset = rvaToOffset(nameRva);
        const library = nameOffset === null ? '(unmapped import)' : readCString(view, nameOffset);
        const thunkRva = originalThunk || firstThunk;
        const thunkOffset = rvaToOffset(thunkRva);
        const symbols: string[] = [];
        if (thunkOffset !== null) {
          const width = bits === 32 ? 4 : 8;
          const maxSymbols = 250;
          for (let j = 0; j < maxSymbols; j++) {
            const itemOffset = thunkOffset + j * width;
            if (itemOffset + width > buffer.byteLength) break;
            const ordinalOrName = bits === 32
              ? view.getUint32(itemOffset, true)
              : view.getBigUint64(itemOffset, true);
            if (ordinalOrName === 0 || ordinalOrName === 0n) break;
            const ordinalFlag = bits === 32 ? 0x80000000 : 0x8000000000000000n;
            const isOrdinal = bits === 32
              ? ((Number(ordinalOrName) & Number(ordinalFlag)) !== 0)
              : ((ordinalOrName & (ordinalFlag as bigint)) !== 0n);
            if (isOrdinal) {
              symbols.push(`ordinal #${Number(ordinalOrName) & 0xffff}`);
              continue;
            }
            const nameRvaValue = Number(ordinalOrName);
            const hintNameOffset = rvaToOffset(nameRvaValue);
            if (hintNameOffset === null || hintNameOffset + 2 >= buffer.byteLength) break;
            const symbol = readCString(view, hintNameOffset + 2);
            if (!symbol) break;
            symbols.push(symbol);
          }
        }
        imports.push({ library: library || '(unknown library)', symbols });
      }
    }
  }

  const strings: string[] = [];
  const match = /(renderware|rwengine|direct3d|d3d9|san andreas|gta|cgame|cworld|cvehicle|cped|cphysical|cstream|handling|script|anim|audio|securom|rockstar)/i;
  let current = '';
  let currentOffset = 0;
  for (let i = 0; i < view.byteLength; i++) {
    const code = view.getUint8(i);
    if (code >= 32 && code <= 126) {
      if (!current) currentOffset = i;
      if (current.length < 240) current += String.fromCharCode(code);
    } else {
      if (current.length >= 5 && match.test(current)) {
        strings.push(`0x${currentOffset.toString(16).padStart(8, '0')}  ${current}`);
      }
      current = '';
      if (strings.length >= 250) break;
    }
  }

  return { machine, sections, entryRva, entryFileOffset, imageBase, bits, imports, strings };
}

function hexWindow(view: DataView, offset: number, length: number): string {
  if (offset < 0 || offset >= view.byteLength) return '(entry point is not backed by file data)';
  const bytes: string[] = [];
  for (let i = offset; i < Math.min(view.byteLength, offset + length); i++) {
    bytes.push(view.getUint8(i).toString(16).padStart(2, '0'));
  }
  return bytes.join(' ');
}

function formatPEReport(fileName: string, fileSize: number, buffer: ArrayBuffer, pe: PEReport): string {
  const machineName = pe.machine === 0x14c ? 'Intel x86' : pe.machine === 0x8664 ? 'AMD64 x64' : `Unknown (0x${pe.machine.toString(16)})`;
  const view = new DataView(buffer);
  const sectionLines = pe.sections.map(section => {
    const flags = [
      section.characteristics & 0x20000000 ? 'EXECUTE' : '',
      section.characteristics & 0x40000000 ? 'READ' : '',
      section.characteristics & 0x80000000 ? 'WRITE' : '',
    ].filter(Boolean).join('/');
    return `  ${section.name.padEnd(9)} RVA=0x${section.virtualAddress.toString(16).padStart(8, '0')}  virtual=0x${section.virtualSize.toString(16).padStart(7, '0')}  raw=0x${section.rawOffset.toString(16).padStart(8, '0')}+0x${section.rawSize.toString(16).padStart(7, '0')}  ${flags}`;
  });
  const importLines = pe.imports.map(item =>
    `  ${item.library}\n${item.symbols.slice(0, 45).map(symbol => `    - ${symbol}`).join('\n')}${item.symbols.length > 45 ? `\n    ... ${item.symbols.length - 45} more` : ''}`
  );
  const entryBytes = pe.entryFileOffset === null ? '(not mapped)' : hexWindow(view, pe.entryFileOffset, 64);
  return [
    `FILE: ${fileName}`,
    `SIZE: ${fileSize.toLocaleString()} bytes`,
    `FORMAT: PE32 / ${pe.bits}-bit`,
    `MACHINE: ${machineName}`,
    `IMAGE BASE: 0x${pe.imageBase.toString(16)}`,
    `ENTRY POINT RVA: 0x${pe.entryRva.toString(16).padStart(8, '0')}`,
    `ENTRY POINT FILE OFFSET: ${pe.entryFileOffset === null ? 'unmapped' : `0x${pe.entryFileOffset.toString(16)}`}`,
    '',
    'SECTIONS:',
    ...sectionLines,
    '',
    'IMPORTED LIBRARIES AND SYMBOLS:',
    ...(importLines.length ? importLines : ['  (No import directory found or it could not be mapped.)']),
    '',
    'ENTRY-POINT BYTES (raw bytes only; not disassembled):',
    `  ${entryBytes}`,
    '',
    'SELECTED PRINTABLE STRINGS:',
    ...(pe.strings.length ? pe.strings.map(line => `  ${line}`) : ['  (No matching strings found.)']),
    '',
    'ANALYSIS LIMIT: this is PE structure/import/string inspection, not function-level x86 reverse engineering.',
    'No game code was executed. No file contents were uploaded or stored.'
  ].join('\n');
}

async function inspectExecutable(file: File): Promise<void> {
  setStatus('Reading executable locally…');
  pickExeButton.disabled = true;
  try {
    const buffer = await file.arrayBuffer();
    const pe = parsePE(buffer);
    latestReport = formatPEReport(file.name, file.size, buffer, pe);
    reportNode.textContent = latestReport;
    reportTitle.textContent = 'Executable structure inspected';
    copyButton.disabled = false;
    setStatus('Static PE inspection complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    latestReport = `Inspection failed for ${file.name}:\n${message}`;
    reportNode.textContent = latestReport;
    reportTitle.textContent = 'Executable could not be inspected';
    copyButton.disabled = false;
    setStatus('Inspection error');
  } finally {
    pickExeButton.disabled = false;
  }
}

type ReadonlyFileHandle = { getFile(): Promise<File> };
type ReadonlyDirectoryHandle = {
  getDirectoryHandle(name: string): Promise<ReadonlyDirectoryHandle>;
  getFileHandle(name: string): Promise<ReadonlyFileHandle>;
};

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options: { multiple?: boolean; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<ReadonlyFileHandle[]>;
  showDirectoryPicker?: (options: { mode: 'read' }) => Promise<ReadonlyDirectoryHandle>;
};

async function inspectGameFolder(): Promise<void> {
  const browserWindow = window as FilePickerWindow;
  if (!browserWindow.showDirectoryPicker) {
    throw new Error('This browser does not support the folder picker. Use a current Chrome or Brave browser on localhost or HTTPS.');
  }

  pickFolderButton.disabled = true;
  setStatus('Waiting for folder permission…');
  try {
    const root = await browserWindow.showDirectoryPicker({ mode: 'read' });
    const checks: { path: string; status: string }[] = [];

    const checkFile = async (path: string, parts: string[]): Promise<void> => {
      try {
        let directory = root;
        for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
        const fileHandle = await directory.getFileHandle(parts[parts.length - 1]);
        const file = await fileHandle.getFile();
        checks.push({ path, status: `FOUND — ${file.size.toLocaleString()} bytes` });
      } catch {
        checks.push({ path, status: 'not found at this path' });
      }
    };

    const checkDirectory = async (path: string, parts: string[]): Promise<void> => {
      try {
        let directory = root;
        for (const part of parts) directory = await directory.getDirectoryHandle(part);
        checks.push({ path, status: 'FOUND' });
      } catch {
        checks.push({ path, status: 'not found at this path' });
      }
    };

    await Promise.all([
      checkFile('gta_sa.exe', ['gta_sa.exe']),
      checkFile('models/gta3.img', ['models', 'gta3.img']),
      checkFile('models/gta_int.img', ['models', 'gta_int.img']),
      checkFile('models/player.img', ['models', 'player.img']),
      checkFile('data/handling.cfg', ['data', 'handling.cfg']),
      checkFile('data/script/main.scm', ['data', 'script', 'main.scm']),
      checkFile('data/script/script.img', ['data', 'script', 'script.img']),
      checkDirectory('anim/', ['anim']),
      checkDirectory('audio/', ['audio']),
    ]);

    latestReport = [
      'GAME FOLDER STRUCTURE CHECK',
      'Folder permission requested as read-only.',
      'Only expected file names and file sizes were checked; binary game assets were not opened.',
      '',
      ...checks.map(check => `${check.status.padEnd(34)} ${check.path}`),
      '',
      'This confirms only that paths exist. It does not yet validate file formats or reverse-engineer their contents.',
      'The folder handle is not stored for later use.'
    ].join('\n');
    reportNode.textContent = latestReport;
    reportTitle.textContent = 'Game folder structure checked';
    copyButton.disabled = false;
    setStatus('Folder scan complete');
  } finally {
    pickFolderButton.disabled = false;
  }
}

pickExeButton.addEventListener('click', async () => {
  const browserWindow = window as FilePickerWindow;
  try {
    if (browserWindow.showOpenFilePicker) {
      const [handle] = await browserWindow.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'GTA San Andreas executable', accept: { 'application/octet-stream': ['.exe'] } }]
      });
      const file = await handle.getFile();
      await inspectExecutable(file);
    } else {
      const fallback = document.createElement('input');
      fallback.type = 'file';
      fallback.accept = '.exe,application/octet-stream';
      fallback.addEventListener('change', () => {
        const file = fallback.files?.[0];
        if (file) void inspectExecutable(file);
      }, { once: true });
      fallback.click();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      setStatus('File selection cancelled');
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    reportNode.textContent = message;
    reportTitle.textContent = 'Could not open executable';
    setStatus('File picker error');
  }
});

pickFolderButton.addEventListener('click', async () => {
  try {
    await inspectGameFolder();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      setStatus('Folder selection cancelled');
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    reportNode.textContent = message;
    reportTitle.textContent = 'Could not inspect folder';
    setStatus('Folder picker error');
  }
});

copyButton.addEventListener('click', async () => {
  if (!latestReport) return;
  try {
    await navigator.clipboard.writeText(latestReport);
    setStatus('Report copied');
  } catch {
    setStatus('Clipboard unavailable — select and copy the report manually');
  }
});

setStatus('Ready — no files accessed');
