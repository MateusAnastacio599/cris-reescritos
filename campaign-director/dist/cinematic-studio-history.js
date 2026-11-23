// Studio history is UI-only. Media are retained in a bounded draft pool, not JSON snapshots.
export class StudioHistory{
  constructor(limit=100){this.limit=limit;this.entries=[];this.index=-1;}
  record(state){const json=JSON.stringify(state);if(this.entries[this.index]===json)return false;this.entries.splice(this.index+1);this.entries.push(json);if(this.entries.length>this.limit)this.entries.shift();this.index=this.entries.length-1;return true;}
  undo(){if(this.index<=0)return null;return JSON.parse(this.entries[--this.index]);}
  redo(){if(this.index>=this.entries.length-1)return null;return JSON.parse(this.entries[++this.index]);}
  reset(state){this.entries=[];this.index=-1;this.record(state);}
}
