import {BoardAssets} from '../board-assets.js?v=328';
import {EvidenceProgress} from './evidence-progress.js?v=330';
import {placePreparation,preparationLayout,preparationRuntime} from './board-preparations.js?v=332';
import {archiveClient, CaseArchive, checked, evidenceImage} from '../case-archive-data.js?v=336';

const itemId = id => 'evidence-' + id;
const pinId = id => 'evidence-pin-' + id;
const colors = /^#[\da-f]{6}$/i;
const number = (value, fallback, min, max) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const geometry = (value, center) => ({
  x: number(value.x, center.x, -100000, 100000),
  y: number(value.y, center.y, -100000, 100000),
  w: number(value.w, 300, 30, 6000),
  rot: number(value.rot, 0, -360, 360),
  scale: number(value.scale, 1, .05, 30),
  z: number(value.z, 1, 0, 100000)
});

function connection(value) {
  if (!value || ![value.id,value.a,value.b].every(id => typeof id === 'string' && /^[\w-]{1,100}$/.test(id))) return null;
  return {id:value.id, a:value.a, b:value.b, color:colors.test(value.color)?value.color:'#b3121c', slack:number(value.slack,1.08,1,4)};
}

export class BoardEvidence {
  static async open(bridge, user) {
    const client = await archiveClient(bridge);
    const api = new CaseArchive(client, bridge.campaignId);
    const [rows,preparations]=await Promise.all([api.boardPins(bridge.archiveId),api.rows('case_evidence_preparations').eq('board_id',bridge.archiveId)]);
    const templates=checked(preparations);
    for(const row of rows)row.preparation=templates.find(template=>template.attachment_id===row.attachment?.id)?.payload;
    const result=new BoardEvidence(api,bridge.archiveId,user,rows);result.assets=new BoardAssets(client,bridge.campaignId);result.progress=new EvidenceProgress(client,bridge.campaignId,user,bridge.archiveId);
    for(const row of rows)if(row.layout.runtime)row.layout=await result.progress.unpack(row.layout,row.id);
    return result;
  }

  constructor(api, boardId, user, rows) {
    Object.assign(this, {api, boardId, user, rows});
    this.layouts = new Map(rows.map(row => [row.id, row.layout]));
    this.urls = [];
    this.queue = Promise.resolve();
  }

  async insertInto(snapshot, center) {
    const {state, imgs} = snapshot;
    const startingZ = state.z || 1;
    await Promise.all(this.rows.map(async (row, index) => {
      const source = row.attachment || row.document;
      if (!source) return;
      const id = itemId(row.id);
      const offset = {x: center.x + [0,320,-320][index % 3], y: center.y + Math.floor(index / 3) * 235};
      if(row.preparation){
        const prepared=placePreparation(await this.assets.unpack(row.preparation),row,this.user,offset);
        state.items.push(...prepared.state.items);Object.assign(imgs,prepared.imgs);
        const target=prepared.state.items[0];
        state.pins.push(...prepared.state.pins);
        if(target&&row.layout.pin!==false)state.pins.push({id:pinId(row.id),item:target.id,crisOwner:this.user,lx:row.layout.pin?.lx||0,ly:row.layout.pin?.ly||-55,size:row.layout.pin?.size||1,color:colors.test(row.layout.pin?.color)?row.layout.pin.color:'#c3161c'});
        state.z=Math.max(state.z||1,...prepared.state.items.map(item=>(item.z||0)+1));return;
      }
      const pose = geometry(row.layout.pose || {}, offset);
      const item = {id, ...pose, z: Math.max(startingZ + index + 1,pose.z), rot: pose.rot, seed: 1,
        parent:null, flipped:!!row.layout.flipped, crisOwner:this.user, crisEvidence:row.id, crisDocument:row.attachment?.document_id || source.id};
      Object.assign(item, {type:'note', style:'postit', text:[source.title, source.body?.slice(0,180)].filter(Boolean).join('\n\n'),
        font:'Typewriter', size:24, color:'#1d2a55', h:200, fita:false});
      if (row.attachment?.object_path && evidenceImage(source.mime)) {
        try {
          const url = URL.createObjectURL(await this.api.original(source));
          if (typeof Image === 'function') {
            const image = new Image();
            image.src = url;
            try { await image.decode(); }
            catch (error) { URL.revokeObjectURL(url); throw error; }
          }
          this.urls.push(url);
          imgs[id] = url;
          Object.assign(item, {type:'img', imgId:id, filter:'solto', opts:{}});
        } catch {
          item.text = source.title + '\n\nImagem indisponível. Abra a evidência no acervo.';
        }
      }
      state.items.push(item);
      state.z = Math.max(state.z || 1, item.z + 1);
      const pin = row.layout.pin;
      if (pin !== false) state.pins.push({id:pinId(row.id), item:id, crisOwner:this.user,
        lx:number(pin?.lx,0,-6000,6000), ly:number(pin?.ly,-55,-6000,6000), size:number(pin?.size,1,.25,4),
        color:colors.test(pin?.color)?pin.color:'#c3161c'});
    }));
    const pins = new Set(state.pins.map(pin => pin.id));
    const links = new Set(state.strings.map(link => link.id));
    for (const row of this.rows) {
      if (!Array.isArray(row.layout.links)) continue;
      for (const raw of row.layout.links) {
        const link = connection(raw);
        if (!link || links.has(link.id) || !pins.has(link.a) || !pins.has(link.b)) continue;
        state.strings.push({...link, crisOwner:this.user});
        links.add(link.id);
      }
    }
    this.baseline = new Map(this.rows.filter(row => state.items.some(item => item.crisEvidence === row.id))
      .map(row => [row.id, JSON.stringify(this.layout(row, state, imgs))]));
  }

  layout(row, state, imgs={}) {
    const item = state.items.find(item => item.crisEvidence === row.id);
    if (!item) return null;
    const id = pinId(row.id);
    const pin = state.pins.find(pin => pin.id === id);
    const pins = new Set(state.pins.map(pin => pin.id));
    const evidencePins=new Set(state.pins.filter(pin=>pin.id===id||state.items.some(item=>item.id===pin.item&&item.crisEvidence===row.id)).map(pin=>pin.id));
    const links = state.strings.filter(link => evidencePins.has(link.a) || evidencePins.has(link.b)).map(connection).filter(Boolean);
    // Connections to local annotations can be restored on their original device.
    const old = this.layouts.get(row.id)?.links;
    if (pin && Array.isArray(old)) for (const raw of old) {
      const link = connection(raw);
      const other = link?.a === id ? link.b : link?.a;
      if (link && (link.a === id || link.b === id) && !pins.has(other) && !links.some(value => value.id === link.id)) links.push(link);
    }
    return {...(row.preparation?{parts:preparationLayout(row,state),runtime:preparationRuntime(row,state,imgs)}:{flipped:!!item.flipped}),pose:geometry(item,{x:0,y:0}), pin:pin ? {lx:pin.lx,ly:pin.ly,size:pin.size,color:pin.color} : false, links:links.slice(0,100)};
  }

  hasChanges(state,imgs={}) {
    if (!this.baseline) return false;
    return this.rows.some(row => this.baseline.has(row.id)
      && this.baseline.get(row.id) !== JSON.stringify(this.layout(row,state,imgs)));
  }

  save(state,imgs={}) {
    const layouts = new Map(this.rows.map(row => [row.id,this.layout(row,state,imgs)]));
    this.queue = this.queue.catch(() => {}).then(async () => {
      for (const row of this.rows) {
        if (!this.baseline.has(row.id)) continue;
        const layout = layouts.get(row.id);
        const stamp = JSON.stringify(layout);
        if (stamp === this.baseline.get(row.id)) continue;
        const query = this.api.client.from('case_evidence_pins');
        if (layout) {
          const packed=this.progress?await this.progress.pack(layout,row.id):layout;
          checked(await query.update({layout:packed}).eq('id',row.id).eq('board_id',this.boardId));
          this.layouts.set(row.id,layout);
          this.baseline.set(row.id,stamp);
        } else {
          checked(await query.delete().eq('id',row.id).eq('board_id',this.boardId));
          this.baseline.delete(row.id);
          this.layouts.delete(row.id);
        }
      }
    });
    return this.queue;
  }

  release() {
    this.urls.forEach(url => URL.revokeObjectURL(url));
  }
}
