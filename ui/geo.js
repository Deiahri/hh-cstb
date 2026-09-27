/* Walk Check — geometry. Straight lines from home to school, intersected with the City's crash
   lists and the active-rail layer, then the nearest traffic light or public rail crossing.
   Everything is [lng, lat]. Loads data/walk.json once (built by data/build.py). */
window.WCGeo=(function(){
  const R=6371000, rad=d=>d*Math.PI/180;
  function distM(a,b){const dLat=rad(b[1]-a[1]),dLng=rad(b[0]-a[0]);const s=Math.sin(dLat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
  function inRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
  const inZone=(p,z)=>z.rings.some(r=>inRing(p,r));
  function segInt(p,p2,q,q2){const r=[p2[0]-p[0],p2[1]-p[1]],s=[q2[0]-q[0],q2[1]-q[1]];const den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-14)return null;const qp=[q[0]-p[0],q[1]-p[1]];const t=(qp[0]*s[1]-qp[1]*s[0])/den,u=(qp[0]*r[1]-qp[1]*r[0])/den;if(t<0||t>1||u<0||u>1)return null;return {pt:[p[0]+t*r[0],p[1]+t*r[1]],t};}
  function bearing(a,b){const y=Math.sin(rad(b[0]-a[0]))*Math.cos(rad(b[1]));const x=Math.cos(rad(a[1]))*Math.sin(rad(b[1]))-Math.sin(rad(a[1]))*Math.cos(rad(b[1]))*Math.cos(rad(b[0]-a[0]));return (Math.atan2(y,x)*180/Math.PI+360)%360;}
  const dir=b=>b<45||b>=315?'N':b<135?'E':b<225?'S':'W';
  const tokens=n=>n.toUpperCase().replace(/\b(N|S|E|W|ST|DR|RD|BLVD|AVE|LN|PKWY|HWY|FWY|CT|WAY)\b/g,'').split(/\s+/).filter(t=>t.length>2);

  let D=null, loading=null;
  function load(){ if(D)return Promise.resolve(D); return loading||(loading=fetch('data/walk.json').then(r=>r.json()).then(d=>(D=d))); }

  /* one hit list for a straight line, grouped by road name; rail grouped by place */
  function hits(home,dest){
    const roads=new Map(), rails=[];
    for(const l of D.roads){for(let i=1;i<l.c.length;i++){const h=segInt(home,dest,l.c[i-1],l.c[i]);if(!h)continue;
      const e=roads.get(l.name)||{kind:'road',name:l.name,ped:false,pc:0,pd:0,tc:0,t:2};
      e.ped=e.ped||!!l.ped;e.pc=Math.max(e.pc,l.pc||0);e.pd=Math.max(e.pd,l.pd||0);e.tc=Math.max(e.tc,l.tc||0);if(h.t<e.t){e.t=h.t;e.at=h.pt;}roads.set(l.name,e);}}
    for(const l of D.rails){for(let i=1;i<l.c.length;i++){const h=segInt(home,dest,l.c[i-1],l.c[i]);if(!h)continue;
      const near=rails.find(e=>distM(e.at,h.pt)<200);if(near)continue;rails.push({kind:'rail',name:l.name,t:h.t,at:h.pt});}}
    const all=[...roads.values(),...rails].sort((a,b)=>a.t-b.t);
    all.forEach(c=>{c.distM=distM(home,c.at);c.control=c.kind==='road'?nearSignal(c):nearXing(c);c.street=D.streets[c.name.toUpperCase()]||null;});
    return all;
  }
  function nearSignal(c){
    const toks=tokens(c.name);let best=null,any=null;
    for(const s of D.signals){const d=distM(c.at,s.loc);if(d>1600)continue;const match=toks.some(t=>s.name.toUpperCase().includes(t));
      if(match&&(!best||d<best.d))best={...s,d};if(!any||d<any.d)any={...s,d};}
    const pick=best||any;if(!pick)return {has:false};
    return {has:(best&&best.d<=250)||pick.d<=120,name:pick.name,d:pick.d,dir:dir(bearing(c.at,pick.loc)),loc:pick.loc,kind:'signal'};
  }
  function nearXing(c){
    let best=null;for(const x of D.xings){const d=distM(c.at,x.loc);if(d>1600)continue;if(!best||d<best.d)best={...x,d};}
    if(!best)return {has:false};
    return {has:best.d<=250,name:best.street,d:best.d,dir:dir(bearing(c.at,best.loc)),loc:best.loc,gates:best.gates,flashers:best.flashers,kind:'xing'};
  }
  /* the whole answer for one home point */
  function compute(pt){
    const closed=D.closed.find(z=>inZone(pt,z));if(!closed)return null;
    const recv=D.receiving.find(z=>inZone(pt,z))||D.receiving.find(z=>z.nbr===closed.receiving[0].nbr);
    const now=hits(pt,recv.loc), before=hits(pt,closed.loc);
    return {home:pt,closed,recv,now,before,distNowM:distM(pt,recv.loc),distBeforeM:distM(pt,closed.loc),
      roads:now.filter(c=>c.kind==='road').length,rails:now.filter(c=>c.kind==='rail').length};
  }
  const short=n=>n.replace(/ (NQ )?ES$/,'');
  const mi=m=>(m/1609.344).toFixed(2).replace(/\.?0+$/,'');
  const ft=m=>Math.max(50,Math.round(m*3.28084/50)*50);
  return {load,compute,distM,short,mi,ft,inZone,get data(){return D;}};
})();
