export const recordFacts = [
  ['age', 'Idade'], ['date', 'Ocorrência'], ['occupation', 'Ocupação'],
  ['location', 'Local'], ['classification', 'Classificação preliminar']
];

// Older imports can store literal line breaks. Real paragraphs and their wording stay intact.
export function normalizeArchiveMarkdown(text) {
  const value = String(text ?? '').replace(/\r\n/g, '\n');
  return value.includes('\\n\\n### ') ? value.replace(/\\n/g, '\n') : value;
}

export function draftCaseRecords(markdown) {
  const parts = normalizeArchiveMarkdown(markdown).split(/^\s*---\s*$/m);
  const entries = [];
  let end = parts.length;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const heading = part.match(/^###\s+(\d+)\.\s+([^\n]+?)\s+·\s+(\d+\s+anos)\s*\n/i);
    if (!heading) { end = i; break; }
    const [, code, name, age] = heading;
    const [metadata, summary, ...notes] = part.slice(heading[0].length).trim().split(/\n[ \t]*\n/);
    if (!summary || metadata.split('\n').length !== 4) return null;
    const fields = Object.fromEntries(recordFacts.slice(1).map(([key,label]) => [
      key, metadata.match(new RegExp('^\\*\\*'+label+':\\*\\*[^\\S\\n]*(.+)$','mi'))?.[1]?.trim()
    ]));
    if (Object.values(fields).some(value => !value) || entries.some(row => row.code === code)) return null;
    entries.push({id:'preview-'+code, code, name, age, ...fields, summary, notes:notes.join('\n\n')});
  }
  if (entries.length < 2 || parts.slice(end).some(part => /^\s*###\s+\d+\./m.test(part))) return null;
  return {intro:parts[0].trim(), notes:parts.slice(end).join('\n\n---\n\n').trim(), entries};
}

export function groupRecordAttachments(entries, attachments) {
  const groups = new Map(entries.map(record => [record.id, []]));
  const general = [];
  for (const attachment of attachments) (groups.get(attachment.record_id) ?? general).push(attachment);
  return {groups, general};
}

