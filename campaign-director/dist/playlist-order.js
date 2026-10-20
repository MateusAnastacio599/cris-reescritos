/** Ordem da mesa, independente do player. O pré-carregamento só consulta a próxima faixa. */
export class PlaylistOrder {
  constructor(ids,{shuffle=false,currentId=null,random=Math.random}={}) {
    this.ids=[...new Set(ids)];this.shuffle=shuffle;this.random=random;
    this.history=[];this.cursor=-1;this.remaining=[];
    if(this.ids.includes(currentId)){this.history=[currentId];this.cursor=0;}
    if(shuffle)this.refill(currentId,true);
  }
  get current(){return this.history[this.cursor]??null;}
  matches(ids,shuffle){return this.shuffle===shuffle&&JSON.stringify(this.ids)===JSON.stringify([...new Set(ids)]);}
  refill(current,excludeCurrent=false){
    this.remaining=this.ids.filter(id=>!excludeCurrent||id!==current);
    for(let i=this.remaining.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.remaining[i],this.remaining[j]]=[this.remaining[j],this.remaining[i]];}
    // A última faixa de uma rodada não deve ser a primeira da próxima.
    if(!excludeCurrent&&this.remaining.length>1&&this.remaining[0]===current)[this.remaining[0],this.remaining[1]]=[this.remaining[1],this.remaining[0]];
  }
  peek(){
    if(!this.ids.length)return null;
    if(this.cursor<this.history.length-1)return this.history[this.cursor+1];
    if(!this.shuffle)return this.ids[(this.ids.indexOf(this.current)+1)%this.ids.length];
    if(!this.remaining.length)this.refill(this.current);
    return this.remaining[0];
  }
  next(){
    const id=this.peek();if(!id)return null;
    if(this.cursor<this.history.length-1){this.cursor++;return id;}
    if(this.shuffle)this.remaining.shift();
    this.history.push(id);this.cursor++;
    if(this.history.length>500){this.history.shift();this.cursor--;}
    return id;
  }
  previous(){
    if(this.shuffle){if(this.cursor>0)this.cursor--;return this.current;}
    if(!this.ids.length)return null;
    const id=this.ids[(this.ids.indexOf(this.current)-1+this.ids.length)%this.ids.length];
    this.history=this.history.slice(0,this.cursor+1);this.history.push(id);this.cursor++;return id;
  }
}
