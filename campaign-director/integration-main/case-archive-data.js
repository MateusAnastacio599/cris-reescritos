export const evidenceBucket = 'cris-case-evidence';
export const evidenceImage = mime => /^image\/(png|jpeg|webp|gif)$/.test(mime || '');
export const checked = result => {
  if (result.error) throw result.error;
  return result.data;
};

export async function archiveClient(bridge) {
  const {getCloudClient} = await import(new URL('cloud-account.js', bridge.directorURL));
  return getCloudClient();
}

export class CaseArchive {
  constructor(client, campaignId) {
    this.client = client;
    this.campaignId = campaignId;
  }

  rows(table, columns = '*') {
    return this.client.from(table).select(columns).eq('campaign_id', this.campaignId);
  }

  async list() {
    const [investigations, documents, attachments] = await Promise.all([
      this.rows('case_investigations').order('position').order('title'),
      this.rows('case_documents', 'id,investigation_id,title,position,published').order('position').order('title'),
      this.rows('case_attachments', 'id,document_id').eq('published', true)
    ]);
    return {investigations: checked(investigations), documents: checked(documents), attachments: checked(attachments)};
  }

  async document(id) {
    const [document, attachments] = await Promise.all([
      this.rows('case_documents').eq('id', id).maybeSingle(),
      this.rows('case_attachments').eq('document_id', id).order('position').order('title')
    ]);
    return {document: checked(document), attachments: checked(attachments)};
  }

  async save(table, id, fields) {
    const query = this.client.from(table);
    const result = id
      ? await query.update(fields).eq('campaign_id', this.campaignId).eq('id', id).select().single()
      : await query.insert({...fields, campaign_id: this.campaignId}).select().single();
    return checked(result);
  }

  async saveRecords(document, records) {
    const row = checked(await this.client.from('case_documents').update({records})
      .eq('campaign_id', this.campaignId).eq('id', document.id)
      .eq('records_revision', document.records_revision).select().maybeSingle());
    if (!row) throw Error('O documento mudou em outra janela. Reabra o documento antes de salvar.');
    return row;
  }

  async remove(table, id) {
    checked(await this.client.from(table).delete().eq('campaign_id', this.campaignId).eq('id', id));
  }

  async attach(documentId, fields, file) {
    const id = crypto.randomUUID();
    const path = file ? this.campaignId + '/' + id : null;
    const mime = file ? (file.type || 'application/octet-stream') : null;
    const {published, ...metadata} = fields;
    checked(await this.client.from('case_attachments').insert({
      ...metadata, id, campaign_id: this.campaignId, document_id: documentId, object_path: path, mime
    }));
    if (file) {
      try {
        checked(await this.client.storage.from(evidenceBucket).upload(path, file, {contentType: mime, upsert: false, cacheControl: '0'}));
      } catch (error) {
        await this.remove('case_attachments', id).catch(() => {});
        throw error;
      }
    }
    if (published) await this.save('case_attachments', id, {published: true});
  }

  async completeAttachment(row, fields, file) {
    if (!file) return this.save('case_attachments', row.id, fields);
    const path = this.campaignId + '/' + row.id;
    const mime = file.type || 'application/octet-stream';
    await this.save('case_attachments', row.id, {object_path:path, mime, published:false});
    try {
      checked(await this.client.storage.from(evidenceBucket).upload(path, file, {contentType:mime, upsert:false, cacheControl:'0'}));
    } catch (error) {
      await this.save('case_attachments', row.id, {object_path:null, mime:null}).catch(() => {});
      throw error;
    }
    return this.save('case_attachments', row.id, fields);
  }

  async original(attachment) {
    return checked(await this.client.storage.from(evidenceBucket).download(attachment.object_path));
  }

  async pin(boardId, kind, sourceId) {
    const source = kind === 'attachment' ? 'attachment_id' : 'document_id';
    const result = await this.client.from('case_evidence_pins').insert({
      board_id: boardId, campaign_id: this.campaignId, [source]: sourceId
    }).select('id').single();
    if (!result.error) return {id: result.data.id, existing: false};
    if (result.error.code !== '23505') throw result.error;
    const row = checked(await this.rows('case_evidence_pins', 'id').eq('board_id', boardId).eq(source, sourceId).single());
    return {id: row.id, existing: true};
  }

  async boardPins(boardId) {
    return checked(await this.rows('case_evidence_pins',
      'id,layout,document:case_documents(id,title,body),attachment:case_attachments(id,document_id,record_id,title,body,mime,object_path)'
    ).eq('board_id', boardId).order('id'));
  }
}
