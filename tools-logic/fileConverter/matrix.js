const AUDIO = new Set(['mp3', 'wav', 'aac', 'flac', 'ogg', 'oga', 'm4a']);
const VIDEO = new Set(['mp4', 'avi', 'mkv', 'mov', 'webm']);

export function normalizeExt(ext) {
  const e = (ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'jpeg') return 'jpg';
  if (e === 'tif') return 'tiff';
  if (e === 'oga') return 'ogg';
  if (e === 'htm') return 'html';
  if (e === 'markdown') return 'md';
  if (e === 'heif') return 'heic';
  return e;
}

function labelForCategory(cat) {
  const L = {
    pdf: 'PDF',
    docx: 'Word (.docx)',
    doc: 'Word (.doc)',
    txt: 'Plain text',
    html: 'HTML',
    md: 'Markdown',
    odt: 'OpenDocument Text',
    raster: 'Image',
    gif: 'GIF',
    heic: 'HEIC',
    audio: 'Audio',
    video: 'Video',
    csv: 'CSV',
    tsv: 'TSV',
    json: 'JSON',
    xml: 'XML',
    xlsx: 'Excel (.xlsx)',
    xls: 'Excel (.xls)',
  };
  return L[cat] || cat;
}

/** @param {File} file */
export function detectInputKind(file) {
  const name = (file.name || 'file').toLowerCase();
  const rawExt = name.includes('.') ? normalizeExt(name.slice(name.lastIndexOf('.') + 1)) : '';

  if (!rawExt) {
    return { error: 'File needs an extension (e.g. .pdf, .docx).' };
  }

  if (rawExt === 'pdf') return { category: 'pdf', ext: 'pdf', label: labelForCategory('pdf') };
  if (rawExt === 'docx') return { category: 'docx', ext: 'docx', label: labelForCategory('docx') };
  if (rawExt === 'doc') return { category: 'doc', ext: 'doc', label: labelForCategory('doc') };
  if (rawExt === 'txt') return { category: 'txt', ext: 'txt', label: labelForCategory('txt') };
  if (rawExt === 'html') return { category: 'html', ext: 'html', label: labelForCategory('html') };
  if (rawExt === 'md') return { category: 'md', ext: 'md', label: labelForCategory('md') };
  if (rawExt === 'odt') return { category: 'odt', ext: 'odt', label: labelForCategory('odt') };
  if (rawExt === 'gif') return { category: 'gif', ext: 'gif', label: labelForCategory('gif') };
  if (rawExt === 'heic') return { category: 'heic', ext: 'heic', label: labelForCategory('heic') };
  if (rawExt === 'csv') return { category: 'csv', ext: 'csv', label: labelForCategory('csv') };
  if (rawExt === 'tsv') return { category: 'tsv', ext: 'tsv', label: labelForCategory('tsv') };
  if (rawExt === 'json') return { category: 'json', ext: 'json', label: labelForCategory('json') };
  if (rawExt === 'xml') return { category: 'xml', ext: 'xml', label: labelForCategory('xml') };
  if (rawExt === 'xlsx') return { category: 'xlsx', ext: 'xlsx', label: labelForCategory('xlsx') };
  if (rawExt === 'xls') return { category: 'xls', ext: 'xls', label: labelForCategory('xls') };

  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'].includes(rawExt)) {
    const e = rawExt === 'jpeg' ? 'jpg' : rawExt === 'tif' ? 'tiff' : rawExt;
    return { category: 'raster', ext: e, label: `${labelForCategory('raster')} (.${e})` };
  }

  if (AUDIO.has(rawExt)) {
    const e = rawExt === 'oga' ? 'ogg' : rawExt;
    return { category: 'audio', ext: e, label: `${labelForCategory('audio')} (.${e})` };
  }

  if (VIDEO.has(rawExt)) {
    return { category: 'video', ext: rawExt, label: `${labelForCategory('video')} (.${rawExt})` };
  }

  return { error: 'Sorry — this kind of file is not supported here yet.' };
}

const PDF_TARGETS = [
  { id: 'docx', label: 'Word (.docx)', hint: 'Wording is copied; spacing and design may look different.' },
  { id: 'txt', label: 'Plain text (.txt)' },
  { id: 'html', label: 'HTML (.html)', hint: 'Easy to open in a web browser.' },
  { id: 'jpg_zip', label: 'JPEG — one file per page (.zip)' },
  { id: 'png_zip', label: 'PNG — one file per page (.zip)' },
];

const DOCX_TARGETS = [
  { id: 'pdf', label: 'PDF (.pdf)' },
  { id: 'txt', label: 'Plain text (.txt)' },
  { id: 'html', label: 'HTML (.html)' },
];

const DOC_TARGETS = [
  {
    id: 'docx',
    label: 'Word (.docx)',
    hint: 'Older Word files sometimes need to be re-saved as .docx in Word first.',
  },
  { id: 'pdf', label: 'PDF (.pdf)' },
  { id: 'txt', label: 'Plain text (.txt)' },
];

const TXT_TARGETS = [
  { id: 'pdf', label: 'PDF (.pdf)' },
  { id: 'docx', label: 'Word (.docx)' },
];

const HTML_TARGETS = [
  { id: 'pdf', label: 'PDF (.pdf)', hint: 'Looks like a printout of the page.' },
  { id: 'docx', label: 'Word (.docx)', hint: 'Headings and paragraphs only; fine details may shift.' },
  { id: 'txt', label: 'Plain text (.txt)' },
];

const MD_TARGETS = [
  { id: 'html', label: 'HTML (.html)' },
  { id: 'pdf', label: 'PDF (.pdf)', hint: 'Created from a preview of your notes.' },
];

const ODT_TARGETS = [
  { id: 'pdf', label: 'PDF (.pdf)' },
  { id: 'docx', label: 'Word (.docx)', hint: 'Main text is kept; fancy layout may simplify.' },
];

const GIF_TARGETS = [{ id: 'mp4', label: 'MP4 (.mp4)', hint: 'Turns the animation into a short video file.' }];

const HEIC_TARGETS = [
  { id: 'jpg', label: 'JPEG (.jpg)' },
  { id: 'png', label: 'PNG (.png)' },
];

const CSV_TARGETS = [
  { id: 'xlsx', label: 'Excel (.xlsx)' },
  { id: 'xls', label: 'Excel (.xls)' },
  { id: 'json', label: 'JSON (.json)' },
  { id: 'tsv', label: 'TSV (.tsv)' },
];

const TSV_TARGETS = [{ id: 'csv', label: 'CSV (.csv)' }];

const JSON_TARGETS = [
  { id: 'xml', label: 'XML (.xml)' },
  { id: 'csv', label: 'CSV (.csv)', hint: 'Works best with a simple table-style list.' },
];

const XML_TARGETS = [
  { id: 'json', label: 'JSON (.json)' },
  { id: 'csv', label: 'CSV (.csv)', hint: 'Works when the file has repeating rows of similar data.' },
];

const XLSX_TARGETS = [
  { id: 'csv', label: 'CSV (.csv)', hint: 'First sheet.' },
  { id: 'xls', label: 'Excel (.xls)' },
];

const XLS_TARGETS = [
  { id: 'csv', label: 'CSV (.csv)', hint: 'First sheet.' },
  { id: 'xlsx', label: 'Excel (.xlsx)' },
];

const RASTER_OUT = [
  { id: 'png', label: 'PNG (.png)' },
  { id: 'jpg', label: 'JPEG (.jpg)' },
  { id: 'webp', label: 'WebP (.webp)' },
  { id: 'bmp', label: 'BMP (.bmp)' },
  { id: 'tiff', label: 'TIFF (.tif)' },
  { id: 'pdf', label: 'PDF (.pdf)', hint: 'One page with your picture on it.' },
];

const AUDIO_LABELS = {
  mp3: 'MP3 (.mp3)',
  wav: 'WAV (.wav)',
  aac: 'AAC (.aac)',
  flac: 'FLAC (.flac)',
  ogg: 'OGG (.ogg)',
  m4a: 'M4A (.m4a)',
};

const VIDEO_LABELS = {
  mp4: 'MP4 (.mp4)',
  avi: 'AVI (.avi)',
  mkv: 'MKV (.mkv)',
  mov: 'MOV (.mov)',
  webm: 'WebM (.webm)',
};

/** @param {{ category: string, ext: string }} detected */
export function getConversionTargets(detected) {
  const { category, ext } = detected;

  switch (category) {
    case 'pdf':
      return PDF_TARGETS;
    case 'docx':
      return DOCX_TARGETS;
    case 'doc':
      return DOC_TARGETS;
    case 'txt':
      return TXT_TARGETS;
    case 'html':
      return HTML_TARGETS;
    case 'md':
      return MD_TARGETS;
    case 'odt':
      return ODT_TARGETS;
    case 'gif':
      return GIF_TARGETS;
    case 'heic':
      return HEIC_TARGETS;
    case 'csv':
      return CSV_TARGETS;
    case 'tsv':
      return TSV_TARGETS;
    case 'json':
      return JSON_TARGETS;
    case 'xml':
      return XML_TARGETS;
    case 'xlsx':
      return XLSX_TARGETS;
    case 'xls':
      return XLS_TARGETS;
    case 'raster': {
      const self = ext === 'jpeg' ? 'jpg' : ext === 'tif' ? 'tiff' : ext;
      return RASTER_OUT.filter((t) => t.id !== self);
    }
    case 'audio': {
      const self = ext === 'oga' ? 'ogg' : ext;
      return Object.entries(AUDIO_LABELS)
        .filter(([k]) => k !== self)
        .map(([id, label]) => ({
          id: `audio_${id}`,
          label,
          hint: 'The first time may take a little longer.',
        }));
    }
    case 'video': {
      const self = ext;
      const out = [];
      for (const [id, label] of Object.entries(VIDEO_LABELS)) {
        if (id !== self) out.push({ id: `video_${id}`, label, hint: 'The first time may take a little longer.' });
      }
      out.push(
        { id: 'video_audio_mp3', label: 'Extract audio — MP3 (.mp3)', hint: 'Saves the sound only.' },
        { id: 'video_gif', label: 'GIF (.gif)', hint: 'A short looping clip.' },
        { id: 'video_frames_zip', label: 'Frame images — PNG (.zip)', hint: 'Still pictures taken from the video.' }
      );
      return out;
    }
    default:
      return [];
  }
}

