/* Walk Check — hash router, no framework. Screens are functions that return HTML.
   Real geometry lives in geo.js; hand-researched contacts in data.js.
   Print model: screens that produce a document render it into #print-root; only that prints. */
(function(){
  const $=s=>document.querySelector(s);
  const app=$('#app'), sheetRoot=$('#sheet-root'), printRoot=$('#print-root');
  const G=WCGeo;
  const ss=(k,v)=>v===undefined?sessionStorage.getItem('wc.'+k):sessionStorage.setItem('wc.'+k,v);
  const state={lang:ss('lang')||'en',addr:ss('addr')||'',pt:ss('pt')?JSON.parse(ss('pt')):null,prek:ss('prek')==='1',geocoded:ss('geo')==='1',res:null,shared:false};
  const isPhone=()=>matchMedia('(max-width:899px)').matches;
  const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  const today=()=>new Date().toLocaleDateString(state.lang==='es'?'es-US':'en-US',{year:'numeric',month:'long',day:'numeric'});
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const short=G.short, mi=G.mi, ft=G.ft;
  const cache={}; const getJSON=f=>cache[f]||(cache[f]=fetch('data/'+f).then(r=>r.json()));
  const daysToApril15=()=>{const n=new Date();let d=new Date(n.getFullYear(),3,15);if(d<n)d=new Date(n.getFullYear()+1,3,15);return [Math.ceil((d-n)/864e5),d.getFullYear()];};

  /* ---------- strings ---------- */
  const S={
    en:{
      home_h:'Is your child’s walk to the new school safe?',home_b:'Seven HISD elementary schools closed this year. Type your address to see what the new walk crosses, where to cross, and how to ask for a bus or a school zone.',
      addr:'Your home address',addr_ph:'Street address, Houston, TX',check:'Check my walk',finding:'Finding your address…',pick:'Pick my home on a map',trya:'Or try a spot in a closed school’s area:',
      notfound:'We couldn’t find that address. Add the ZIP code, or pick your home on the map.',
      grade_q:'Your child is in',grade_k:'K to 5th',grade_pk:'Pre-K',found:'We found',fix:'Not right? Fix it',usemine:'Use my own address',mins:n=>`about ${n} min`,shuttle_s:'shuttle until 2028',
      ask_rail:'Ask: HISD for a bus stop, the City for a guard',ask_toc:p=>`Ask: the City, through the principal of ${p}`,ask_local:'Ask: the City, through 311 and your principal',key:'Key',
      copy:'Copy message',copied:'Copied',close:'Close',opens_mail:'Opens your email app with this message.',opens_msgs:'Opens your messages with this text ready to send.',showmap:'Show on map',walkto:'Walk to',
      shared_h:'Someone shared this walk with you.',shared_b:'Check your own address',
      coop_win:'Hold Ctrl and scroll to zoom the map',coop_mac:'Hold ⌘ and scroll to zoom the map, or pinch on a trackpad',coop_touch:'Use two fingers to move the map',
      closed:'Schools that closed',closed_b:'Each closed school, and the school its families walk to now.',see:'See the walk',how:['Type your address','See what the walk crosses and where to cross','Give your principal the request'],
      staff_h:'For City and HISD staff',staff_b:'The same data, sorted for the people who can change the walks.',
      staff:[{h:'Closed zones data',b:'Per closed zone: how much farther the walk is, and what share now crosses a dangerous road or active rail.',href:'#/data'},{h:'Corridors',b:'Every road and track a new walk crosses, sorted so the places with no traffic light come first, with what the City can do there.',href:'#/corridors'},{h:'Before April 15',b:'The streets by receiving school, the City’s written paths for a school zone, and a filled-in draft application for each principal.',href:'#/april15'}],
      src_h:'Where the data comes from',src_b:'Public HISD, City of Houston, Houston TranStar and federal railroad data. Lines go straight from home to school, so a real walk crosses at least what you see here.',src_link:'See every source and date',
      prek_h:'Is your child in Pre-K?',prek_why:'Pre-K has different bus rules, so we ask once.',yes:'Yes',yes_s:'Pre-K 3 or Pre-K 4',no:'No',no_s:'Kindergarten to 5th grade',
      verdict:(to,r,k)=>{const p=[];if(r)p.push(`${r} dangerous road${r>1?'s':''}`);if(k)p.push(k>1?`${k} railroads`:'a railroad');return `Your child’s walk to ${to} crosses ${p.length?p.join(' and '):'nothing on the City’s lists'}.`;},
      lastyear:'Last year',now:'Now',nothing:'nothing to cross',crossings:n=>`${n} crossing${n===1?'':'s'}`,straight:'in a straight line',
      where:'Where to cross',inorder:'In the order your child meets them, starting from home.',
      tag_ped:'On the City’s dangerous-for-walking list',tag_hin:'High-injury road',tag_rail:'Active train tracks',
      crashes:(pc,pd)=>pc||pd?`${pc} ${pc===1?'person':'people'} hit walking here, ${pd} killed (City count, 2022).`:'No pedestrian crashes in the City’s 2022 count on this stretch.',
      adv_sig:(n,f,d)=>`Cross at the traffic light at ${n}, ${f} ft ${d} of where the straight line meets the road.`,
      adv_nosig:(n,m)=>`No traffic light within 800 ft of where the line crosses.${n?` The nearest is ${n}, ${m} mi away.`:''} Cross at a corner, never mid-block.`,
      adv_x:(n,f,d,g)=>`Cross the tracks only at the public crossing on ${n}, ${f} ft ${d}${g}.`,gates:', which has gates',flash:', which has flashing lights',
      adv_nox:(n,m)=>`No public rail crossing within 800 ft.${n?` The nearest is on ${n}, ${m} mi away.`:''} Never cross the tracks anywhere else.`,
      who:'Who can change it',
      who_rail:'HISD can put a bus stop on the home side of the tracks. The City can add a sidewalk to the public crossing and a guard at it.',
      who_toc:(p)=>`The City. A school zone here: the principal of ${p} applies by April 15. A crossing guard: the City decides, on the school’s recommendation. A crosswalk or signal study: report through 311.`,
      who_local:'The City. A school zone is not an option here under the City’s rules (a local street that does not border the school). Ask the principal to request a crossing guard, and report a crosswalk or signal study through 311.',
      shuttle_h:y=>`Free HISD shuttle from ${y}, through the 2027–28 school year`,
      shuttle_b:(from,a,m,x)=>`The bus picks up at ${from}, ${a}, about ${m} mi from home. The walk there ${x}.`,
      xnone:'crosses nothing on the City’s lists',xsome:list=>`crosses ${list}`,
      shuttle_c:`HISD has not published where on campus it stops or when. Ask the school, or call HISD’s closure family line, ${WC.hisdLine}.`,
      after_h:'After the shuttle ends',after_b:(to,m)=>`From fall 2028, HISD buses only students who live 2 miles or more from school. This home is about ${m} mi from ${to}, so it will not get a bus for distance. The other way is a hazardous-route request, and this page gathers the evidence for it.`,
      after_prek:'Pre-K is not covered by the bus or the shuttle unless your child has an IEP or 504 plan. Ask the principal. A school zone still helps.',
      note_lines:'Lines go straight from home to school. A walk on real streets crosses at least these roads and tracks, often more.',
      note_lights:'Traffic lights only. Crossing guards, stop signs and painted crosswalks are not on any public map, so a corner with a guard still shows as “no traffic light”.',
      dates:'Data dates',
      gethelp:'Get help',print:'Print',print_plan:'Print walk plan',share:'Share',back:'Back',
      map_walk:'This year’s walk',map_pick:'Walk to the shuttle',map_x:'Where to cross',map_light:'Light or rail crossing',map_road:'Dangerous road',map_rail:'Train tracks',map_zone:'The closed school’s old zone',
      help_h:'Two requests your principal can send',help_b:'You don’t fill anything out. Open one, check it, then print it or share it with the school.',
      bus_h:'Ask HISD for a bus stop',bus_s:'For a walk HISD calls hazardous. Any time of year. Only HISD decides.',zone_h:'Ask the City for a school zone',zone_s:'20 mph signs and flashing lights on a street your child crosses. Only the principal can apply.',deadline:'Applications close April 15',open_bus:'Open the bus request',open_zone:'Open the school zone request',
      give:'Give it to',principal:'Principal',principal_of:s=>`The principal of ${s}`,front:'Ask at the front office',call:'Call',school:'School',address:'Address',hisd_line:'HISD closure family line',council:'Neighborhood council',
      inside:'What’s in the request',steps_h:'How this works',
      bus_steps:['Print this or share it with the school','Your principal files it with HISD Transportation','HISD reviews the walk and can add a stop'],
      zone_steps:['Print this or share it with the school','Your principal sends it to Public Works by April 15','The City studies the street and Council votes in July'],
      bus_items:['A map of the walk with each crossing marked','The streets and the City’s crash counts','The railroad crossing, if any','A suggested bus stop near your home','Room to add neighbors on your street'],
      again:'Ask again every fall until 2028.',dl_h:'Deadline: April 15',dl_s:'Signs go up for the next school year.',streets:'Streets to include',streets_none:'No street on this walk qualifies for a school zone under the City’s written rules. The request asks for a crossing guard and a crosswalk instead.',
      preview:'This is the page your principal gets',print_req:'Print the request',
      share_h:'Share this walk',share_school:'Share with the school',your_msg:'Your message',
      zones_h:'What the closures changed',big:'8 in 10',big_t:'of the area in the seven closed zones now has a walk that crosses a dangerous road or train tracks.',big_s:'Before the closures: 5 in 10.',shareof:'Share of each zone’s area whose walk crosses a dangerous road or train tracks',lb:'Walk before',ln:'Walk now',tap:'Tap a school to see its walk.',checkaddr:'Check my address',pct_note:'Percentages are shares of each zone’s area, sampled on an even grid. They are not counts of students or homes.',
      in10:'in 10',all:'Nearly all',zd_t:'of homes now cross a dangerous road or train tracks on the way to school.',zd_b:b=>`Before the closures: ${b} in 10.`,haz:'Crosses a dangerous road or tracks',railx:'Crosses train tracks',farther:'farther, for a typical home',over2:'live 2+ miles away, the distance that earns a bus',longest:'longest walk in the zone',
      pickup_h:'The walk to the shuttle pickup',pickup_b:(n,a)=>`The bus picks up at ${n}, ${a}, the same walk as last year. Roads crossed most on that walk:`,
      nz_h:'This address is not in one of the seven closed zones.',nz_b:'Your child’s school did not change this year, so there is no new walk to check.',seeclosed:'See the schools that closed',another:'Try another address',know:'Know a family near Burrus, Port Houston, Alcott, Briscoe, Franklin, Henderson or Ross?',
      pick_h:'Tap your home on the map',pick_b:'The seven closed zones are outlined. Tap inside one.',use:'Use this spot',spot:'Spot on the map',
      plan_h:'Walk plan',bring:'Want a bus stop or a school zone?',bring_b:(n,p)=>`Bring this page to the front office and ask for ${n}${p?' · '+p:''}.`,
      staff_only:'Staff pages are in English.',sources_h:'Where the data comes from',sources_b:'Each layer below is public. The dates are when the owner last edited it, or when we read it.',
      src_cols:['Source','What it gives this site','Date']
    },
    es:{
      home_h:'¿Es seguro el camino de su hijo a la nueva escuela?',home_b:'Siete primarias de HISD cerraron este año. Escriba su dirección para ver qué cruza el nuevo camino, dónde cruzar y cómo pedir un autobús o una zona escolar.',
      addr:'Su dirección',addr_ph:'Dirección, Houston, TX',check:'Revisar el camino',finding:'Buscando su dirección…',pick:'Marcar mi casa en el mapa',trya:'O pruebe un punto en la zona de una escuela cerrada:',
      notfound:'No encontramos esa dirección. Agregue el código postal, o marque su casa en el mapa.',
      grade_q:'Su hijo está en',grade_k:'Kínder a 5.º',grade_pk:'Pre-K',found:'Encontramos',fix:'¿No es correcta? Corríjala',usemine:'Usar mi dirección',mins:n=>`unos ${n} min`,shuttle_s:'autobús hasta 2028',
      ask_rail:'Pida: a HISD una parada, a la Ciudad un guardia',ask_toc:p=>`Pida: a la Ciudad, por medio del director de ${p}`,ask_local:'Pida: a la Ciudad, por el 311 y su director',key:'Leyenda',
      copy:'Copiar mensaje',copied:'Copiado',close:'Cerrar',opens_mail:'Abre su correo con este mensaje.',opens_msgs:'Abre sus mensajes con este texto listo para enviar.',showmap:'Ver en el mapa',walkto:'Camino a',
      shared_h:'Alguien compartió este camino con usted.',shared_b:'Revise su propia dirección',
      coop_win:'Mantenga Ctrl y desplace para acercar el mapa',coop_mac:'Mantenga ⌘ y desplace para acercar el mapa, o pellizque en el trackpad',coop_touch:'Use dos dedos para mover el mapa',
      closed:'Escuelas que cerraron',closed_b:'Cada escuela cerrada, y la escuela a la que sus familias caminan ahora.',see:'Ver el camino',how:['Escriba su dirección','Vea qué cruza el camino y dónde cruzar','Entregue la solicitud a su director'],
      staff_h:'Para personal de la Ciudad y de HISD',staff_b:'Los mismos datos, ordenados para quienes pueden cambiar los caminos.',
      staff:[{h:'Datos de las zonas cerradas',b:'Por zona cerrada: cuánto más largo es el camino y qué parte ahora cruza una calle peligrosa o una vía activa.',href:'#/data'},{h:'Corredores',b:'Cada calle y vía que cruza un camino nuevo, primero los lugares sin semáforo, con lo que la Ciudad puede hacer ahí.',href:'#/corridors'},{h:'Antes del 15 de abril',b:'Las calles por escuela receptora, las reglas escritas de la Ciudad para una zona escolar y un borrador de solicitud para cada director.',href:'#/april15'}],
      src_h:'De dónde salen los datos',src_b:'Datos públicos de HISD, la Ciudad de Houston, Houston TranStar y el registro federal de ferrocarriles. Las líneas van rectas de la casa a la escuela, así que el camino real cruza al menos lo que ve aquí.',src_link:'Ver cada fuente y fecha',
      prek_h:'¿Su hijo está en Pre-K?',prek_why:'Pre-K tiene otras reglas de autobús, por eso preguntamos una vez.',yes:'Sí',yes_s:'Pre-K 3 o Pre-K 4',no:'No',no_s:'Kínder a 5.º grado',
      verdict:(to,r,k)=>{const p=[];if(r)p.push(`${r} calle${r>1?'s':''} peligrosa${r>1?'s':''}`);if(k)p.push(k>1?`${k} vías de tren`:'una vía de tren');return `El camino de su hijo a ${to} cruza ${p.length?p.join(' y '):'nada de las listas de la Ciudad'}.`;},
      lastyear:'El año pasado',now:'Ahora',nothing:'nada que cruzar',crossings:n=>`${n} cruce${n===1?'':'s'}`,straight:'en línea recta',
      where:'Dónde cruzar',inorder:'En el orden en que su hijo los encuentra, saliendo de casa.',
      tag_ped:'En la lista de la Ciudad de calles peligrosas para peatones',tag_hin:'Calle con muchos choques',tag_rail:'Vía de tren activa',
      crashes:(pc,pd)=>pc||pd?`${pc} persona${pc===1?'':'s'} atropellada${pc===1?'':'s'} aquí, ${pd} fallecida${pd===1?'':'s'} (conteo de la Ciudad, 2022).`:'Sin choques con peatones en el conteo 2022 de la Ciudad en este tramo.',
      adv_sig:(n,f,d)=>`Cruce en el semáforo de ${n}, a ${f} pies al ${({N:'norte',S:'sur',E:'este',W:'oeste'})[d]} de donde la línea recta toca la calle.`,
      adv_nosig:(n,m)=>`No hay semáforo a menos de 800 pies de donde cruza la línea.${n?` El más cercano es ${n}, a ${m} millas.`:''} Cruce en una esquina, nunca a media cuadra.`,
      adv_x:(n,f,d,g)=>`Cruce las vías solo por el cruce público de ${n}, a ${f} pies al ${({N:'norte',S:'sur',E:'este',W:'oeste'})[d]}${g}.`,gates:', que tiene barreras',flash:', que tiene luces',
      adv_nox:(n,m)=>`No hay cruce público de vías a menos de 800 pies.${n?` El más cercano está en ${n}, a ${m} millas.`:''} Nunca cruce las vías por otro lugar.`,
      who:'Quién puede cambiarlo',
      who_rail:'HISD puede poner una parada de autobús del lado de la casa. La Ciudad puede agregar una banqueta hasta el cruce público y un guardia ahí.',
      who_toc:(p)=>`La Ciudad. Una zona escolar aquí: el director de ${p} la solicita antes del 15 de abril. Un guardia de cruce: la Ciudad decide, con la recomendación de la escuela. Un paso peatonal o un estudio de semáforo: repórtelo al 311.`,
      who_local:'La Ciudad. Una zona escolar no aplica aquí según las reglas de la Ciudad (calle local que no colinda con la escuela). Pida al director que solicite un guardia, y reporte un paso peatonal o estudio de semáforo al 311.',
      shuttle_h:y=>`Autobús gratis de HISD desde ${y}, hasta el año escolar 2027–28`,
      shuttle_b:(from,a,m,x)=>`El autobús recoge en ${from}, ${a}, a unas ${m} millas de casa. El camino hasta ahí ${x}.`,
      xnone:'no cruza nada de las listas de la Ciudad',xsome:list=>`cruza ${list}`,
      shuttle_c:`HISD no ha publicado dónde para en el plantel ni a qué hora. Pregunte en la escuela o llame a la línea de familias de HISD, ${WC.hisdLine}.`,
      after_h:'Cuando termine el autobús',after_b:(to,m)=>`Desde otoño de 2028, HISD da autobús solo a estudiantes que viven a 2 millas o más. Esta casa está a unas ${m} millas de ${to}, así que no tendrá autobús por distancia. La otra vía es una solicitud de ruta peligrosa, y esta página reúne la evidencia.`,
      after_prek:'Pre-K no está cubierto por el autobús ni el transporte, salvo con un plan IEP o 504. Pregunte al director. Una zona escolar sí ayuda.',
      note_lines:'Las líneas van rectas de la casa a la escuela. Un camino por calles reales cruza al menos estas calles y vías, a menudo más.',
      note_lights:'Solo semáforos. Los guardias, señales de alto y pasos pintados no están en ningún mapa público, así que una esquina con guardia aún aparece como “sin semáforo”.',
      dates:'Fechas de los datos',
      gethelp:'Pedir ayuda',print:'Imprimir',print_plan:'Imprimir el plan',share:'Compartir',back:'Atrás',
      map_walk:'Camino de este año',map_pick:'Camino al autobús',map_x:'Dónde cruzar',map_light:'Semáforo o cruce de vías',map_road:'Calle peligrosa',map_rail:'Vías de tren',map_zone:'Zona anterior de la escuela cerrada',
      help_h:'Dos solicitudes que su director puede enviar',help_b:'Usted no llena nada. Abra una, revísela, e imprímala o compártala con la escuela.',
      bus_h:'Pedir una parada de autobús a HISD',bus_s:'Para un camino que HISD considera peligroso. En cualquier época del año. Solo HISD decide.',zone_h:'Pedir una zona escolar a la Ciudad',zone_s:'Letreros de 20 mph y luces en una calle que cruza su hijo. Solo el director puede solicitarla.',deadline:'Cierra el 15 de abril',open_bus:'Abrir la solicitud de autobús',open_zone:'Abrir la solicitud de zona escolar',
      give:'Entregar a',principal:'Director(a)',principal_of:s=>`El director o directora de ${s}`,front:'Pregunte en la oficina',call:'Llamar',school:'Escuela',address:'Dirección',hisd_line:'Línea de familias de HISD',council:'Consejo del vecindario',
      inside:'Qué incluye la solicitud',steps_h:'Cómo funciona',
      bus_steps:['Imprima esto o compártalo con la escuela','Su director lo presenta a Transporte de HISD','HISD revisa el camino y puede agregar una parada'],
      zone_steps:['Imprima esto o compártalo con la escuela','Su director lo envía a Obras Públicas antes del 15 de abril','La Ciudad estudia la calle y el Concejo vota en julio'],
      bus_items:['Un mapa del camino con cada cruce marcado','Las calles y los choques registrados por la Ciudad','El cruce de la vía del tren, si lo hay','Una parada de autobús sugerida cerca de su casa','Espacio para agregar vecinos de su calle'],
      again:'Pídalo cada otoño hasta 2028.',dl_h:'Fecha límite: 15 de abril',dl_s:'Los letreros se instalan para el siguiente año escolar.',streets:'Calles a incluir',streets_none:'Ninguna calle de este camino califica para zona escolar según las reglas escritas de la Ciudad. La solicitud pide un guardia y un paso peatonal.',
      preview:'Esta es la página que recibe su director',print_req:'Imprimir la solicitud',
      share_h:'Compartir este camino',share_school:'Compartir con la escuela',your_msg:'Su mensaje',
      zones_h:'Qué cambió con los cierres',big:'8 de 10',big_t:'del área de las siete zonas cerradas ahora tiene un camino que cruza una calle peligrosa o vías de tren.',big_s:'Antes de los cierres: 5 de 10.',shareof:'Parte del área de cada zona cuyo camino cruza una calle peligrosa o vías de tren',lb:'Camino antes',ln:'Camino ahora',tap:'Toque una escuela para ver su camino.',checkaddr:'Revisar mi dirección',pct_note:'Los porcentajes son partes del área de cada zona, muestreada en una cuadrícula. No son conteos de estudiantes ni de casas.',
      in10:'de 10',all:'Casi todos',zd_t:'de las casas ahora cruzan una calle peligrosa o vías de tren camino a la escuela.',zd_b:b=>`Antes de los cierres: ${b} de 10.`,haz:'Cruza una calle peligrosa o vías',railx:'Cruza vías de tren',farther:'más lejos, para una casa típica',over2:'viven a 2+ millas, la distancia que da autobús',longest:'camino más largo de la zona',
      pickup_h:'El camino a la parada del autobús',pickup_b:(n,a)=>`El autobús recoge en ${n}, ${a}, el mismo camino del año pasado. Calles que más se cruzan en ese camino:`,
      nz_h:'Esta dirección no está en una de las siete zonas cerradas.',nz_b:'La escuela de su hijo no cambió este año, así que no hay un camino nuevo que revisar.',seeclosed:'Ver las escuelas que cerraron',another:'Probar otra dirección',know:'¿Conoce a una familia cerca de Burrus, Port Houston, Alcott, Briscoe, Franklin, Henderson o Ross?',
      pick_h:'Toque su casa en el mapa',pick_b:'Las siete zonas cerradas están marcadas. Toque dentro de una.',use:'Usar este punto',spot:'Punto en el mapa',
      plan_h:'Plan del camino',bring:'¿Quiere una parada de autobús o una zona escolar?',bring_b:(n,p)=>`Lleve esta página a la oficina y pregunte por ${n}${p?' · '+p:''}.`,
      staff_only:'Las páginas para personal están en inglés.',sources_h:'De dónde salen los datos',sources_b:'Cada capa es pública. Las fechas son la última edición del dueño, o cuándo la leímos.',
      src_cols:['Fuente','Qué aporta a este sitio','Fecha']
    }
  };
  const t=k=>S[state.lang][k];

  /* ---------- small pieces ---------- */
  const back=()=>`<button class="back" data-back>‹ ${t('back')}</button>`;
  const steps=(list,h)=>`<div class="steps">${h?`<h2>${h}</h2>`:''}<ol>${list.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`;
  const ARROW='<svg class="arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
  const ICON={print:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    share:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>'};
  const actionBar=btns=>{const p=btns.find(b=>b.primary),sec=btns.filter(b=>!b.primary);
    return `<div class="bar-fixed"><div class="bar-row">${sec.map(b=>`<button class="btn small secondary" data-act="${b.act}">${ICON[b.act.startsWith('share')?'share':'print']||''}<span>${b.label}</span></button>`).join('')}</div>${p?`<button class="btn primary" data-act="${p.act}">${p.label}</button>`:''}</div>`;};
  const barRow=(label,sub,before,now,href)=>`<${href?`a href="${href}"`:'div'} class="bar"><div class="hd"><b>${esc(label)}</b>${sub?`<span>${esc(sub)}</span>`:''}</div>
    <div class="tr"><i class="fill" style="--v:${before}"></i><span>${Math.round(before)}%</span></div><div class="tr now"><i class="fill now" style="--v:${now}"></i><span>${Math.round(now)}%</span></div></${href?'a':'div'}>`;
  const legend=()=>`<div class="legend"><span><i></i>${t('lb')}</span><span><i class="now"></i>${t('ln')}</span></div>`;
  const paper=(doc,pages)=>`<figure class="paper"><div class="paper-scale">${doc}</div><figcaption class="small muted">${t('preview')}${pages?` · ${pages}`:''}</figcaption></figure>`;
  const mapBox=(kind,h)=>`<div class="map" data-map="${kind}" style="height:${h||360}px" role="img" aria-label="Map"></div>`;
  const walkMap=h=>`<div class="mapwrap">${mapBox('walk',h)}<details class="maplegend"${isPhone()?'':' open'}><summary>${t('key')}</summary><ul><li><i class="l-walk"></i>${t('map_walk')}</li><li><i class="l-pick"></i>${t('map_pick')}</li><li><i class="l-x">1</i>${t('map_x')}</li><li><i class="l-light"></i>${t('map_light')}</li><li><i class="l-road"></i>${t('map_road')}</li><li><i class="l-rail"></i>${t('map_rail')}</li></ul></details></div>`;
  const principalOf=r=>{const p=WC.principals[r.nbr]||{};return {name:p.name,phone:p.phone,school:r.name,address:r.address};};
  function whoCard(res){const p=principalOf(res.recv);
    return `<dl class="def"><dt>${t('give')}</dt><dd><b>${p.name?esc(p.name)+', '+t('principal'):t('principal_of')(esc(p.school))}</b><br>${esc(p.school)} · ${esc(p.address)}${p.phone?`<br><a href="tel:${p.phone.replace(/\D/g,'')}">${t('call')} ${esc(p.phone)}</a>`:`<br><span class="muted">${t('front')}</span>`}</dd>
      <dt>${t('hisd_line')}</dt><dd><a href="tel:${WC.hisdLine.replace(/\D/g,'')}">${WC.hisdLine}</a></dd></dl>`;}
  const walkHash=()=>`#/walk?lat=${state.pt[1].toFixed(6)}&lng=${state.pt[0].toFixed(6)}&addr=${encodeURIComponent(state.addr)}&prek=${state.prek?1:0}`;
  const crossList=list=>list.map(c=>c.kind==='rail'?(state.lang==='es'?'vías de tren':'train tracks'):c.name).join(', ');

  /* one crossing, as a numbered row: what it is, where to cross, who can change it */
  function crossingRow(c,i,res){
    const tags=c.kind==='rail'?[t('tag_rail')]:[c.ped?t('tag_ped'):null,t('tag_hin')].filter(Boolean);
    let adv,who;const k=c.control;
    let ask;
    if(c.kind==='road'){adv=k.has?t('adv_sig')(k.name,ft(k.d),k.dir):t('adv_nosig')(k.name,k.d?mi(k.d):'');const toc=c.street&&c.street.toc;who=toc?t('who_toc')(short(res.recv.name)):t('who_local');ask=toc?t('ask_toc')(short(res.recv.name)):t('ask_local');}
    else{adv=k.has?t('adv_x')(k.name,ft(k.d),k.dir,k.gates?t('gates'):k.flashers?t('flash'):''):t('adv_nox')(k.name,k.d?mi(k.d):'');who=t('who_rail');ask=t('ask_rail');}
    return `<li class="xrow ${c.kind}" data-x="${i}"><span class="n">${i+1}</span><div class="xbody"><h3>${esc(c.kind==='rail'?(state.lang==='es'?'Vías de tren':'Train tracks')+' · '+c.name:c.name)} <button class="showmap" data-showmap="${i}">${t('showmap')} ›</button></h3>
      <p class="tags muted">${tags.join(' · ')}${c.kind==='road'?' · '+t('crashes')(c.pc,c.pd):''}</p>
      <p class="adv">${esc(adv)}</p>
      <details class="who"><summary>${esc(ask)}</summary><p>${esc(who)}</p></details></div></li>`;
  }

  /* ---------- documents (what actually prints) ---------- */
  const letterhead=(title,sub,to)=>`<header class="doc-head"><div class="doc-brand"><svg width="22" height="22" class="on-green"><use href="#logo"/></svg><span>Walk Check</span></div><div class="doc-meta">${to?`<b class="doc-to">${esc(to)}</b><br>`:''}${esc(title)}<br>${esc(sub)}</div></header>`;
  const sigs=(a,b)=>`<div class="doc-sigs"><div><i></i><span>${a}</span></div><div><i></i><span>${b}</span></div></div>`;
  const kindLabel=c=>c.kind==='rail'?'Active railroad':c.ped?'Pedestrian-dangerous road (Vision Zero 2022)':'High Injury Network road (2022)';
  const ctrlLabel=c=>c.control.has?`${c.control.kind==='xing'?'Public crossing':'Signal'}: ${c.control.name}, ${ft(c.control.d)} ft ${c.control.dir}`:'None within 800 ft';
  const crossTable=rows=>`<table class="doc-table"><thead><tr><th>#</th><th>Crossing</th><th>City record</th><th>Ped. crashes / deaths</th><th>Nearest control</th></tr></thead><tbody>${rows.map((c,i)=>`<tr><td>${i+1}</td><td><b>${esc(c.name)}</b></td><td>${kindLabel(c)}</td><td>${c.kind==='rail'?'n/a':`${c.pc} / ${c.pd}`}</td><td>${esc(ctrlLabel(c))}</td></tr>`).join('')}</tbody></table>`;
  const docs={
    plan(r){const p=principalOf(r.recv);return `<article class="doc doc-plan">${letterhead('Walk plan',today())}
      <h1>Walk plan to ${esc(r.recv.name)}</h1><p class="doc-sub">For the home at ${esc(state.addr)} · ${esc(r.recv.address)}</p>
      <div class="doc-cmp"><div><small>Last year: ${esc(short(r.closed.name))}</small><b>${mi(r.distBeforeM)} mi · ${r.before.length?r.before.length+' crossings':'nothing to cross'}</b></div><div class="warm"><small>Now: ${esc(short(r.recv.name))}</small><b>${mi(r.distNowM)} mi · ${r.now.length?r.now.length+' crossings':'nothing to cross'}</b></div></div>
      <h2>Where to cross, in order</h2><ol class="doc-list">${r.now.map(c=>{const k=c.control;const adv=c.kind==='road'?(k.has?S.en.adv_sig(k.name,ft(k.d),k.dir):S.en.adv_nosig(k.name,k.d?mi(k.d):'')):(k.has?S.en.adv_x(k.name,ft(k.d),k.dir,k.gates?S.en.gates:k.flashers?S.en.flash:''):S.en.adv_nox(k.name,k.d?mi(k.d):''));return `<li><span class="mk ${c.kind}"></span><div><b>${esc(c.kind==='rail'?'Train tracks · '+c.name:c.name)}</b><span>${esc(adv)}</span></div></li>`;}).join('')||'<li><span class="mk"></span><div><b>Nothing on the City’s lists</b><span>Walk it once anyway to see the corners.</span></div></li>'}</ol>
      <div class="doc-note"><b>Free HISD shuttle through 2027–28.</b> Pickup at ${esc(r.closed.name)}, ${esc(r.closed.address)}, ${mi(r.distBeforeM)} mi from home. The walk there ${r.before.length?'crosses '+esc(crossList(r.before)):'crosses nothing on the City’s lists'}. Stop and times: ask the school or call HISD, ${WC.hisdLine}.</div>
      <div class="doc-note outline"><b>Want a bus stop or a school zone?</b> Bring this page to the front office of ${esc(r.recv.name)} and ask for ${esc(p.name||'the principal')}${p.phone?' · '+p.phone:''}.</div>
      <footer class="doc-foot"><span>Straight lines, not streets. Traffic lights only; guards and painted crosswalks are not on public maps.</span><span>City crash lists 2022 · HISD rail ${G.data.dates.rail} · signals read ${G.data.dates.signals}</span></footer></article>`;},
    bus(r){const p=principalOf(r.recv);const rail=r.now.find(c=>c.kind==='rail');return `<article class="doc doc-hisd">${letterhead('Hazardous walking route · request for bus service',today(),'To HISD Transportation')}
      <h1>Request: hazardous-route bus stop, former ${esc(r.closed.name)} zone</h1>
      <p class="doc-sub">Prepared for ${esc(p.name||'the Principal')}, ${esc(r.recv.name)} · To: HISD Transportation, Routing &amp; Scheduling</p>
      <dl class="doc-facts"><dt>Home area</dt><dd>${esc(state.addr)}</dd><dt>Former campus</dt><dd>${esc(r.closed.name)}, ${esc(r.closed.address)} (closed June 2026)</dd><dt>Receiving campus</dt><dd>${esc(r.recv.name)}, ${esc(r.recv.address)}</dd><dt>Straight-line distance</dt><dd>${mi(r.distNowM)} mi (inside the 2-mile rule; ${r.closed.pctOver2New}% of the former zone is 2+ mi)</dd></dl>
      <h2>Why this walk qualifies</h2>
      <p>The walk crosses the conditions in Tex. Educ. Code §48.151 and HISD’s hazardous-route definition: ${r.roads?`${r.roads} road${r.roads>1?'s':''} on the City of Houston’s 2022 High Injury Network`:''}${r.roads&&rail?' and ':''}${rail?'active railroad track':''}${!r.now.length?'none on the City’s lists; see the walk to the shuttle pickup below':''}. ${rail?'Elementary students who must cross active track qualify on the crossing alone.':''}</p>
      ${r.now.length?crossTable(r.now):''}
      <h2>Proposed stop</h2><p>Near ${esc(state.addr)}${rail?', on the home side of the railroad, so students do not cross track to reach the bus':''}. Until 2027–28 the closure shuttle picks up at ${esc(r.closed.name)}; that walk ${r.before.length?'crosses '+esc(crossList(r.before)):'crosses nothing on the City’s lists'}.</p>
      <h2>Families on this street</h2><div class="doc-lines"><i></i><i></i><i></i></div>
      ${sigs('Principal signature · date','Regional superintendent · date')}
      <footer class="doc-foot"><span>Re-request each school year. Closure shuttle ends after 2027–28.</span><span>Sources: HISD 2026–27 boundaries; City of Houston Vision Zero HIN 2022; HISD rail layer; FRA crossings</span></footer></article>`;},
    zone(z){/* z: {school,address,principal,zoneName,before,now,streets:[{name,ped,pc,pd,toc,borders,share,lightNote}]} */
      const ok=z.streets.filter(s=>s.toc||s.borders),alt=z.streets.filter(s=>!(s.toc||s.borders));
      return `<article class="doc doc-city">${letterhead('School zone application',today(),'To the City of Houston · Public Works')}
      <h1>School zone request: ${esc(z.school)}</h1>
      <p class="doc-sub">Submitted by ${esc(z.principal||'the Principal')} · School Coordination Program, ${WC.hpwEmail} · Applications close April 15</p>
      <dl class="doc-facts"><dt>Campus</dt><dd>${esc(z.school)}, ${esc(z.address)}</dd><dt>Change</dt><dd>${esc(z.zoneName)} closed June 2026; its zone now walks to this campus</dd><dt>Share of the former zone whose walk crosses a dangerous road or rail</dt><dd>${Math.round(z.now)}% now, ${Math.round(z.before)}% before</dd>${z.count?`<dt>School’s own count of walkers</dt><dd class="doc-blank">&nbsp;</dd>`:''}</dl>
      <h2>Streets requested</h2>
      ${ok.length?`<table class="doc-table"><thead><tr><th>#</th><th>Street</th><th>HPW written path</th><th>Ped. crashes / deaths (2022)</th><th>${z.streets[0].share!=null?'Share of zone crossing it':'Nearest signal'}</th></tr></thead><tbody>${ok.map((s,i)=>`<tr><td>${i+1}</td><td><b>${esc(s.name)}</b></td><td>${s.borders?'Borders the school':'Thoroughfare or collector'}${s.owner&&s.owner!=='COH'?` · owned by ${esc(s.owner)}`:''}</td><td>${s.pc} / ${s.pd}</td><td>${s.share!=null?Math.round(s.share)+'%':esc(s.lightNote||'')}</td></tr>`).join('')}</tbody></table>`:`<p>${S.en.streets_none}</p>`}
      ${alt.length?`<h2>Streets with no written path to a zone (local streets)</h2><p>${alt.map(s=>esc(s.name)).join(', ')}: requested instead as a crossing guard post and a marked crosswalk, under the same application’s crosswalk page.</p>`:''}
      <h2>Basis</h2><p>Students from the former ${esc(z.zoneName)} zone now walk to this campus and cross the streets above. Each requested street is on the City’s 2022 High Injury Network. HPW considers a zone on a street that borders the school, or one that is a thoroughfare or collector and is owned by the City of Houston.</p>
      <h2>Requested</h2><p>20 mph school zone with flashing beacons on the streets above, timed to arrival and dismissal, for the 2027–28 school year, the closure shuttle’s last.</p>
      ${sigs('Principal signature · date','Public Works use')}
      <footer class="doc-foot"><span>Prepared with Walk Check from public data. The school fills in bell times, contacts and its own count.</span><span>Sources: City of Houston Vision Zero HIN 2022; MTFP; HISD 2026–27 boundaries</span></footer></article>`;}
  };
  const zoneDocFromWalk=r=>{const p=principalOf(r.recv);return docs.zone({school:r.recv.name,address:r.recv.address,principal:p.name,zoneName:r.closed.name,before:r.closed.hazOld.combined,now:r.closed.hazNew.combined,
    streets:r.now.filter(c=>c.kind==='road').map(c=>({name:c.name,ped:c.ped,pc:c.pc,pd:c.pd,toc:!!(c.street&&c.street.toc),borders:!!(c.street&&c.street.borders.includes(r.recv.name)),owner:c.street&&c.street.owner,lightNote:ctrlLabel(c)}))});};

  /* ---------- screens ---------- */
  const D=()=>G.data;
  const screens={
    home(){printRoot.innerHTML='';const [days,yr]=daysToApril15();return `<section class="screen"><div class="hero"><div class="hero-copy"><h1>${t('home_h')}</h1><p class="lede muted">${t('home_b')}</p>${steps(t('how'))}</div>
      <form class="form" id="f"><div class="field"><label class="label" for="addr">${t('addr')}</label><input class="input" id="addr" name="addr" autocomplete="street-address" placeholder="${t('addr_ph')}" value="${esc(state.geocoded?state.addr:'')}"></div>
      <button class="btn" type="submit" id="go">${t('check')}</button><p class="err" id="err" hidden>${t('notfound')}</p>
      <a class="linkbtn" href="#/pick">${t('pick')}</a>
      <p class="small muted try">${t('trya')}</p><div class="chips">${D().closed.map(z=>`<button type="button" class="chip" data-demo="${z.nbr}">${esc(short(z.name))}</button>`).join('')}</div></form></div>
      <div class="sec"><h2>${t('closed')}</h2><p class="muted">${t('closed_b')}</p></div><div class="list grid4">${D().closed.map(z=>`<a class="list-row pair-row" href="#/zone/${z.nbr}" data-pair><span class="pair"><span class="was">${esc(short(z.name))}</span><span class="arrow" aria-hidden="true">→</span><span class="now">${esc(z.receiving.map(r=>short(r.name)).join(' / '))}</span></span><span class="go">${t('see')} ${ARROW}</span></a>`).join('')}</div>
      <div class="sec"><h2>${t('staff_h')}</h2><p class="muted">${t('staff_b')}</p></div><div class="staffgrid">${t('staff').map(s=>`<a class="staffcard" href="${s.href}"><h3>${s.h}${s.href==='#/april15'?` <span class="muted">· ${days} days</span>`:''}</h3><p class="muted">${s.b}</p></a>`).join('')}</div>
      <div class="sec"><h2>${t('src_h')}</h2><p class="muted">${t('src_b')} <a href="#/sources">${t('src_link')} ›</a></p></div></section>`;},
    pick(){printRoot.innerHTML='';return `<section class="screen">${back()}<h1>${t('pick_h')}</h1><p class="muted lede">${t('pick_b')}</p>${mapBox('pick',isPhone()?420:520)}<div class="row"><button class="btn" id="usept" disabled>${t('use')}</button></div></section>`;},
    prek(){printRoot.innerHTML='';return `<section class="screen narrow">${back()}<p class="eyebrow">${esc(state.addr)}</p><h1>${t('prek_h')}</h1><p class="muted">${t('prek_why')}</p>
      <button class="choice" data-prek="0"><b>${t('no')}</b><span>${t('no_s')}</span></button><button class="choice" data-prek="1"><b>${t('yes')}</b><span>${t('yes_s')}</span></button></section>`;},
    walk(){const r=state.res;printRoot.innerHTML=docs.plan(r);const d=D().dates;
      const to=short(r.recv.name),from=short(r.closed.name);
      const xb=r.before.length?t('xsome')(crossList(r.before)):t('xnone');
      const mins=Math.round(r.distNowM/1609.344/2.5*60);const sample=!state.geocoded;
      return `<section class="screen has-bar">${state.shared?`<p class="shared">${t('shared_h')} <a href="#/" data-fix>${t('shared_b')} ›</a></p>`:''}<div class="ctx" aria-hidden="true"><b>${t('walkto')} ${esc(to)}</b><span>${r.now.length?t('crossings')(r.now.length):t('nothing')} · ${mi(r.distNowM)} mi</span></div>${back()}<h1 data-ctx-anchor>${t('verdict')(to,r.roads,r.rails)}</h1>
      <p class="summary"><span>${mi(r.distNowM)} mi</span><span>${t('mins')(mins)}</span><span>${r.now.length?t('crossings')(r.now.length):t('nothing')}</span><span>${t('shuttle_s')}</span></p>
      <p class="addr"><span class="muted">${sample?'':t('found')+': '}</span><b>${esc(state.addr)}</b> <a href="#/" data-fix>${sample?t('usemine'):t('fix')} ›</a></p>
      <div class="grade" role="group" aria-label="${t('grade_q')}"><span class="muted">${t('grade_q')}</span><button class="seg ${state.prek?'':'is-on'}" data-grade="0" aria-pressed="${!state.prek}">${t('grade_k')}</button><button class="seg ${state.prek?'is-on':''}" data-grade="1" aria-pressed="${state.prek}">${t('grade_pk')}</button></div>
      ${state.prek?`<p class="notice">${t('after_prek')}</p>`:''}
      <div class="cols"><div class="col">
        <div class="cmp"><div class="cmp-row tint"><span class="k">${t('lastyear')}</span><span class="name">${esc(from)}</span><span class="meta">${mi(r.distBeforeM)} mi · ${r.before.length?t('crossings')(r.before.length):t('nothing')}</span></div>
        <div class="cmp-row warm"><span class="k">${t('now')}</span><span class="name">${esc(to)}</span><span class="meta">${mi(r.distNowM)} mi · ${r.now.length?t('crossings')(r.now.length):t('nothing')}</span></div></div>
        <div class="mob-only">${walkMap(340)}</div>
        <h2>${t('where')}</h2>${r.now.length?`<p class="muted">${t('inorder')}</p><ol class="xlist">${r.now.map((c,i)=>crossingRow(c,i,r)).join('')}</ol>`:`<p class="muted">${t('xnone')[0].toUpperCase()+t('xnone').slice(1)}. ${state.lang==='es'?'Camínelo una vez de todos modos para ver las esquinas.':'Walk it once anyway to see the corners.'}</p>`}
        <h2>${t('shuttle_h')(r.closed.name)}</h2><p>${esc(t('shuttle_b')(r.closed.name,r.closed.address,mi(r.distBeforeM),xb))}</p><p class="muted">${esc(t('shuttle_c'))}</p>
        <h2>${t('after_h')}</h2><p>${esc(t('after_b')(to,mi(r.distNowM)))}</p>
        <p class="small muted foot">${t('note_lines')} ${t('note_lights')}</p>
        <p class="small muted foot">${t('dates')}: ${state.lang==='es'?'listas de choques de la Ciudad':'City crash lists'} ${d.crash} · HISD ${state.lang==='es'?'vías':'rail'} ${d.rail} · ${state.lang==='es'?'límites':'boundaries'} ${d.zones} · ${state.lang==='es'?'semáforos':'traffic lights'} ${d.signals} · ${state.lang==='es'?'cruces de vías':'rail crossings'} ${d.xings}. <a href="#/sources">${t('src_link')} ›</a></p></div>
        <div class="col side sticky"><div class="desk-only">${walkMap(440)}</div>
        ${actionBar(state.prek?[{act:'zone',label:t('askzone'),primary:true},{act:'print',label:t('print_plan')},{act:'share',label:t('share')}]:[{act:'help',label:t('gethelp'),primary:true},{act:'print',label:t('print')},{act:'share',label:t('share')}])}</div></div></section>`;},
    help(){const r=state.res;printRoot.innerHTML='';return `<section class="screen">${back()}<h1>${t('help_h')}</h1><p class="muted lede">${t('help_b')}</p>
      <div class="cols"><div class="col">
      <a class="option" href="#/bus"><span class="opt-n">1</span><div><h2>${t('bus_h')}</h2><p class="muted">${t('bus_s')}</p></div><span class="btn">${t('open_bus')} ›</span></a>
      <a class="option" href="#/schoolzone"><span class="opt-n">2</span><div><h2>${t('zone_h')}</h2><p class="muted">${t('zone_s')}</p><p class="due">${t('deadline')}</p></div><span class="btn">${t('open_zone')} ›</span></a>
      </div><div class="col side">${whoCard(r)}</div></div></section>`;},
    bus(){const r=state.res;printRoot.innerHTML=docs.bus(r);return `<section class="screen has-bar">${back()}<h1>${t('bus_h')}</h1><div class="cols"><div class="col">
      ${steps(t('bus_steps'),t('steps_h'))}${whoCard(r)}
      <h2>${t('inside')}</h2><ul class="ticks">${t('bus_items').map(i=>`<li>${i}</li>`).join('')}</ul><p class="muted">${t('again')}</p></div>
      <div class="col side">${paper(docs.bus(r),'1 page')}${actionBar([{act:'print',label:t('print_req'),primary:true},{act:'share-school',label:t('share')}])}</div></div></section>`;},
    schoolzone(q){const r=state.res;const roads=r.now.filter(c=>c.kind==='road');const doc=zoneDocFromWalk(r);printRoot.innerHTML=doc;return `<section class="screen has-bar">${back()}<h1>${t('zone_h')}</h1><div class="cols"><div class="col">
      <p class="due big">${t('dl_h')}, ${daysToApril15()[1]} <span class="muted">· ${t('dl_s')}</span></p>
      ${steps(t('zone_steps'),t('steps_h'))}
      <h2>${t('streets')}</h2>${roads.length?`<ol class="xlist compact">${roads.map((c,i)=>`<li class="xrow"><span class="n">${i+1}</span><div class="xbody"><h3>${esc(c.name)}</h3><p class="muted">${c.street&&(c.street.toc||c.street.borders.includes(r.recv.name))?(state.lang==='es'?'Califica por escrito: ':'Written path: ')+(c.street.borders.includes(r.recv.name)?(state.lang==='es'?'colinda con la escuela':'borders the school'):(state.lang==='es'?'vía principal o colectora':'thoroughfare or collector')):(state.lang==='es'?'Calle local: se pide un guardia y un paso peatonal':'Local street: asks for a guard and a crosswalk instead')} · ${t('crashes')(c.pc,c.pd)}</p></div></li>`).join('')}</ol>`:`<p class="muted">${t('streets_none')}</p>`}
      ${whoCard(r)}</div>
      <div class="col side">${paper(doc,'1 page')}${actionBar([{act:'print',label:t('print_req'),primary:true},{act:'share-school',label:t('share')}])}</div></div></section>`;},
    zones(){const zs=[...D().closed].sort((a,b)=>b.hazNew.combined-a.hazNew.combined);printRoot.innerHTML='';const T=D().totals;
      return `<section class="screen">${back()}<h1>${t('zones_h')}</h1><div class="cols side-first">
      <div class="col"><p class="small muted b">${t('shareof')}</p>${legend()}<div class="bars">${zs.map(z=>barRow(short(z.name),'→ '+z.receiving.map(r=>short(r.name)).join(' / '),z.hazOld.combined,z.hazNew.combined,'#/zone/'+z.nbr)).join('')}</div><p class="small muted">${t('tap')} ${t('pct_note')}</p><a class="btn mob-only" href="#/">${t('checkaddr')}</a></div>
      <div class="col side"><div class="stat"><span class="n">${Math.round(T.hazNew.combined/10)} ${t('in10')}</span><span class="t">${t('big_t')}</span><span class="muted">${t('big_s').replace(/5/,Math.round(T.hazOld.combined/10))}</span></div>${mapBox('zones',isPhone()?280:380)}<a class="btn desk-only" href="#/">${t('checkaddr')}</a></div></div></section>`;},
    zone(nbr){const z=D().closed.find(z=>z.nbr==nbr)||D().closed[0];printRoot.innerHTML='';const c=WC.councils[z.nbr];const recv=z.receiving.map(r=>short(r.name)).join(' / ');
      return `<section class="screen">${back()}<h1 class="pair is-on"><span class="was">${esc(short(z.name))}</span><span class="arrow" aria-hidden="true">→</span><span class="now">${esc(recv)}</span></h1><div class="cols"><div class="col">
      <div class="stat warm"><span class="n">${z.hazNew.combined>=95?t('all'):Math.round(z.hazNew.combined/10)+' '+t('in10')}</span><span class="t">${t('zd_t')}</span><span class="muted">${t('zd_b')(Math.round(z.hazOld.combined/10))}</span></div>
      ${legend()}<div class="bars">${barRow(t('haz'),'',z.hazOld.combined,z.hazNew.combined)}${barRow(t('railx'),'',z.hazOld.rail,z.hazNew.rail)}</div>
      <dl class="facts"><div><dt>+${mi(z.medNewM-z.medOldM)} mi</dt><dd>${t('farther')}</dd></div><div><dt>${z.pctOver2New}%</dt><dd>${t('over2')}</dd></div><div><dt>${z.maxNewMi} mi</dt><dd>${t('longest')}</dd></div></dl>
      <h2>${t('pickup_h')}</h2><p>${esc(t('pickup_b')(z.name,z.address))}</p><ul class="plain">${z.pickupRoads.filter(p=>p.share>=1).map(p=>`<li>${esc(p.name)} <span class="muted">· ${Math.round(p.share)}%${p.ped?' · '+t('tag_ped').toLowerCase():''}</span></li>`).join('')||`<li class="muted">${t('xnone')}</li>`}</ul>
      <p class="small muted">${t('pct_note')}</p></div>
      <div class="col side"><a class="btn" href="#/walk?lat=${z.demo[1]}&lng=${z.demo[0]}&addr=${encodeURIComponent((state.lang==='es'?'Punto de muestra en la zona de ':'Sample point in the old ')+short(z.name)+(state.lang==='es'?'':' area'))}&prek=0">${t('see')}</a><a class="btn secondary" href="#/">${t('checkaddr')}</a><button class="btn secondary" data-act="share-zone" data-zone="${z.nbr}">${t('share')}</button>
      <dl class="def">${z.receiving.map(r=>{const p=WC.principals[r.nbr]||{};return `<dt>${t('principal')} · ${esc(r.name)}</dt><dd>${p.name?esc(p.name):t('front')}<br>${esc(r.address)}${p.phone?`<br><a href="tel:${p.phone.replace(/\D/g,'')}">${t('call')} ${esc(p.phone)}</a>`:''}</dd>`;}).join('')}${c?`<dt>${t('council')}</dt><dd>${esc(c.name)}<br><span class="muted">${esc(c.meets)}</span></dd>`:''}</dl></div></div></section>`;},
    nozone(){printRoot.innerHTML='';return `<section class="screen narrow">${back()}<p class="eyebrow">${esc(state.addr)}</p><h1>${t('nz_h')}</h1><p class="muted lede">${t('nz_b')}</p>
      <a class="btn" href="#/zones">${t('seeclosed')}</a><a class="btn secondary" href="#/">${t('another')}</a>
      <p class="muted">${t('know')} <button class="linkbtn" data-act="share-site">${t('share')}</button></p></section>`;},
    sources(){printRoot.innerHTML='';const m=cache.meta;const rows=[['schools_new','HISD Schools 2026–27','Campus points and addresses'],['zones_old','HISD elementary boundaries 2025–26','The seven closed zones'],['zones_new','HISD elementary boundaries 2026–27','Which school an address walks to now'],['ped_hin','City of Houston Vision Zero, pedestrian-dangerous roads (2022)','Roads marked “dangerous for people walking”, with crash counts'],['hin','City of Houston Vision Zero, High Injury Network (2022)','High-injury roads, with crash counts'],['rail','Texas railroads, active (HISD map layer)','Train tracks'],['signals','Traffic signals (City, TxDOT, Harris County, via Houston TranStar)','“Cross at the traffic light at…”'],['rail_crossings','FRA crossing inventory, open public crossings, Harris County','“Cross the tracks at the public crossing on…”'],['mtfp','City of Houston Major Thoroughfare and Freeway Plan','Whether a street can get a school zone on paper'],['campus_grounds','OpenStreetMap school grounds','Where on campus a shuttle can stop']];
      return `<section class="screen">${back()}<h1>${t('sources_h')}</h1><p class="muted lede">${t('sources_b')}</p>
      <table class="tbl"><thead><tr>${t('src_cols').map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(([k,label,use])=>{const e=m&&m[k]||{};return `<tr><td><a href="${esc(e.url||'#')}" target="_blank" rel="noopener">${esc(e.label||label)}</a></td><td>${use}</td><td>${esc(e.readOn||e.lastEditDate||(e.fetchedAt||'').slice(0,10)||'')}</td></tr>`;}).join('')}</tbody></table>
      <p class="small muted">${t('pct_note')} ${t('note_lines')}</p></section>`;},
    /* ---- staff pages (English) ---- */
    data(){printRoot.innerHTML='';const T=D().totals;const zs=D().closed;const arrow=(a,b)=>`<td class="pct" style="--v:${Math.round(b)}"><span class="was">${Math.round(a)}%</span> → <b>${Math.round(b)}%</b></td>`;
      return `<section class="screen wide">${back()}<p class="eyebrow">${t('staff_h')}</p><h1>Closed zones: the walk got longer, and it got more dangerous</h1>
      <p class="lede muted">Each 2025–26 elementary zone with no 2026–27 counterpart was sampled on a ${T.spacingM} m grid (${T.points.toLocaleString()} points). Each point was measured in a straight line to its old school and to its new one.</p>
      <dl class="facts three"><div><dt>${T.pctOver2New}%</dt><dd>of the closed-zone area is 2+ miles from its new school, the distance that earns a bus</dd></div><div><dt>${Math.round(T.hazNew.combined)}%</dt><dd>now crosses a pedestrian-dangerous road or active railroad, up from ${Math.round(T.hazOld.combined)}%</dd></div><div><dt>${Math.round(T.hazNew.rail)}%</dt><dd>crosses active railroad track, up from ${Math.round(T.hazOld.rail)}%</dd></div></dl>
      ${mapBox('zones',isPhone()?340:460)}<p class="small muted">Fill: share of each closed zone whose new walk crosses a hazard. Dot: shuttle pickup at the closed campus. Square: receiving school.</p>
      <h2>Per closed zone</h2><p class="muted small">All percentages are shares of zone area.</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Closed zone</th><th>Now zoned to</th><th class="num">Median walk</th><th class="num">Farther</th><th class="num">2+ mi</th><th class="num">Ped-dangerous road</th><th class="num">Any high-injury road</th><th class="num">Active railroad</th><th class="num">Either hazard</th></tr></thead><tbody>
      ${zs.map(z=>`<tr><td><a href="#/zone/${z.nbr}">${esc(z.name)}</a></td><td>${z.receiving.map(r=>esc(r.name)+(r.share<100?` (${Math.round(r.share)}%)`:'')).join(', ')}</td><td class="num">${mi(z.medOldM)} → ${mi(z.medNewM)} mi</td><td class="num">${Math.round(z.pctFarther)}%</td><td class="num">${z.pctOver2New}%</td>${arrow(z.hazOld.ped,z.hazNew.ped)}${arrow(z.hazOld.hin,z.hazNew.hin)}${arrow(z.hazOld.rail,z.hazNew.rail)}${arrow(z.hazOld.combined,z.hazNew.combined)}</tr>`).join('')}
      <tr class="total"><td>All seven</td><td></td><td></td><td></td><td class="num">${T.pctOver2New}%</td>${arrow(T.hazOld.ped,T.hazNew.ped)}${arrow(T.hazOld.hin,T.hazNew.hin)}${arrow(T.hazOld.rail,T.hazNew.rail)}${arrow(T.hazOld.combined,T.hazNew.combined)}</tr></tbody></table></div>
      <h2>The seven pickups</h2><p>HISD runs a direct shuttle from each closed campus to its receiving school for 2026–27 and 2027–28, open to any K–12 student affected by a closure (<a href="${WC.hisdFaq}" target="_blank" rel="noopener">HISD closure FAQ</a>). HISD owns the building and the bus. The City owns the streets, the school zones and the crossing-guard funding. On Aug 13, 2026 the board declared each building surplus; no sale date is published.</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Pickup</th><th>To</th><th>Shuttle</th><th>Walk to the pickup crosses a hazard</th><th>Roads crossed most</th></tr></thead><tbody>
      ${zs.map(z=>`<tr><td><b>${esc(z.name)}</b><br><span class="muted">${esc(z.address)}</span></td><td>${z.receiving.map(r=>esc(r.name)).join(', ')}</td><td>${z.shuttleMi} mi, through 2027–28</td><td>${Math.round(z.hazOld.combined)}% of the zone; ${Math.round(z.hazOld.rail)}% crosses track</td><td>${z.pickupRoads.map(p=>`${esc(p.name)} (${Math.round(p.share)}%)`).join(', ')||'—'}</td></tr>`).join('')}</tbody></table></div>
      <p><b>Not public for any of the seven:</b> where on campus the bus stops and when (ask HISD; families got route details in early August); the City school zone at the campus and its hours (ask Houston Public Works; a zone’s hours follow its school’s bell, and a closed campus has none); a crossing guard on the walk to the pickup (ask HISD, which reports its guard posts to the City).</p>
      <p class="small muted">${t('pct_note')} ${t('note_lines')}</p>${staffNav('data')}</section>`;},
    corridors(){printRoot.innerHTML='';const C=cache.corridors||[];const rank=c=>{const k=c.control||{};return !k.crossings?3:(k.within500Pct===0?0:k.within250Pct<50?1:2);};const rows=C.filter(c=>c.pointsNewlyCrossed>0).sort((a,b)=>rank(a)-rank(b)||b.pointsNewlyCrossed-a.pointsNewlyCrossed);
      const ctrl=c=>{const k=c.control||{};if(!k.crossings)return '—';if(k.within250Pct===0&&k.within500Pct===0)return `<b>No</b> ${c.kind==='rail'?'public rail crossing':'traffic light'} within 0.3 mi of where the walks cross.`;const p=k.within250Pct;return `<b>${p>=50?'Yes':'Mostly no'}</b> ${Math.round(p)}% of crossings have one within 800 ft; median ${k.medianM>=800?mi(k.medianM)+' mi':ft(k.medianM)+' ft'}.${k.nearest?' Nearest: '+esc(k.nearest)+'.':''}`;};
      const can=c=>{if(c.kind==='rail')return `<b>HISD:</b> a bus stop on the home side of the tracks.<br><b>City:</b> a sidewalk to, and a guard at, the nearest public crossing${c.control&&c.control.nearest?' ('+esc(c.control.nearest)+')':''}.`;const sc=c.streetClass||{};const zone=sc.thoroughfareOrCollector||(c.bordersSchool||[]).length?`School zone: principal of ${esc((c.bordersSchool||[])[0]||(c.receiving||[])[0]||'the receiving school')} applies by April 15`:'No school zone on paper (local street)*';return `Crossing guard**<br>${zone}<br>Crosswalk or signal study: 311`;};
      return `<section class="screen wide">${back()}<p class="eyebrow">${t('staff_h')}</p><h1>The corridors now between children and school</h1>
      <p class="lede muted">Each road or railroad that a 2026–27 straight-line walk crosses but the 2025–26 walk did not. Sorted so the places with no traffic light or public rail crossing nearby come first, each with what the City can do there. The City can act on this list whatever HISD decides about buses.</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Road or track</th><th>Traffic light or public crossing nearby?</th><th>What can change it</th><th class="num">Area newly crossing</th><th>Closed zone</th><th class="num">Ped. crashes / deaths</th></tr></thead><tbody>
      ${rows.map(c=>`<tr><td><b>${esc(c.name)}</b><br><span class="muted small">${c.kind==='rail'?'Railroad':[c.pedDangerous?'Ped-dangerous':null,c.highInjury?'High-injury':null].filter(Boolean).join(', ')}</span></td><td>${ctrl(c)}</td><td>${can(c)}</td><td class="pct num" style="--v:${Math.round(100*c.pointsNewlyCrossed/D().totals.points)}">${(100*c.pointsNewlyCrossed/D().totals.points).toFixed(1)}% <span class="muted small">(${c.pointsNewlyCrossed} pts)</span>${c.pointsOldRoute?`<br><span class="muted small">+${c.pointsOldRoute} on both walks</span>`:''}</td><td>${(c.zones||[]).map(short).join(', ')}</td><td class="num">${c.kind==='rail'?'n/a':`${c.pedCrashes} / ${c.pedDeaths}`}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">* HPW’s written criteria cover a street that borders the school or a City-owned thoroughfare or collector; a local street that does neither has no written path to a zone. ** The City decides how many crossing guards, on schools’ recommendations (Tex. Local Gov’t Code §343.014). Crashes: City High Injury Network 2022, on the crossed segments. Lights: Houston TranStar’s public signal list. ${t('pct_note')}</p>${staffNav('corridors')}</section>`;},
    april15(){printRoot.innerHTML='';const Z=cache.zone_requests||{schools:[]};const [days,yr]=daysToApril15();
      const path=s=>s.path==='borders'||s.borders?'Borders the school':s.path==='toc'||(s.streetClass||{}).thoroughfareOrCollector?'Thoroughfare or collector':'Neither, on paper';
      const lights=s=>{const l=s.lights||{};return l.within500?`${l.within500} within 500 m · median ${l.medianM} m away`:'None within 500 m';};
      const cls=s=>{const c=s.streetClass||{};return c.type?`${esc(c.type)} · ${esc(c.owner||'')}`:'Local street (not on the thoroughfare plan)';};
      return `<section class="screen wide">${back()}<p class="eyebrow">${t('staff_h')} · ${days} days until April 15, ${yr}</p><h1>Before April 15: school zones for the new walks</h1>
      <p class="lede muted">The City’s school-zone process was built for schools that stay put. A principal applies by April 15, and on a street that does not border the school HPW asks for “observation or evidence of students walking”. The 2026 deadline came before anyone walked the new routes. This page does the homework for each receiving school: the streets its new walkers cross, what the City’s own layers say about each, and a filled-in draft of HPW’s application for the principal to review, count, and sign.</p>
      <ol class="timeline"><li><b>Feb 26, 2026</b> HISD’s board approves the closures.</li><li><b>Apr 15, 2026</b> School-zone applications close, 48 days later. Nobody walks the new routes yet.</li><li><b>Aug 2026</b> New walks begin. HISD’s shuttle runs from each old campus.</li><li><b>Apr 15, 2027</b> Deadline for 2027–28, the shuttle’s last year. Council updates the ordinance in July; signs follow.</li><li><b>End of 2027–28</b> The shuttle ends. The 2-mile bus rule applies again.</li><li><b>Apr 15, 2028</b> Deadline for 2028–29, the first year without the shuttle.</li></ol>
      <p class="muted">Signing the City’s 2023 batch of 38 schools took about 11 months. An application in April 2027 is the one that can have signs up before the shuttle ends.</p>
      <h2>The streets, by receiving school</h2><p class="muted">Each row is a street a straight-line walk to the school crosses when the walk to the old campus did not. HPW considers a zone on a street that borders the school, or on a City-owned thoroughfare or collector. HPW decides after its own study; this page only sorts the streets by which written path they could use.</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Street</th><th class="num">Newly crossing</th><th class="num">Ped. crashes / deaths</th><th>Traffic lights</th><th>City street class</th><th>HPW’s written path</th></tr></thead><tbody>
      ${Z.schools.map(s=>`<tr class="group"><td colspan="6"><b>${esc(s.name)}</b> takes ${Math.round(s.shareOfZone)}% of the old ${esc(s.zone)} zone${s.streets.length?'':' · no City high-injury street is newly crossed'}${s.railNewlyPct?` · ${Math.round(s.railNewlyPct)}% newly crosses active railroad; a school zone does not cover that`:''}</td></tr>${s.streets.map(st=>`<tr class="${path(st)==='Neither, on paper'?'no':''}"><td>${esc(st.name)}</td><td class="pct num" style="--v:${Math.round(st.share)}">${st.share.toFixed(1)}%</td><td class="num">${st.pedCrashes} / ${st.pedDeaths}</td><td>${lights(st)}</td><td>${cls(st)}${(st.streetClass||{}).owner&&st.streetClass.owner!=='COH'?'<br><span class="muted small">HPW’s form asks for a City street</span>':''}</td><td>${path(st)}</td></tr>`).join('')}`).join('')}</tbody></table></div>
      <h2>Draft applications</h2><p class="muted">One per receiving school, in the order of HPW’s form. The principal fills in contacts, bell times, the school’s own count and the signature. Everything else comes from public data and says so.</p>
      <ul class="plain drafts">${Z.schools.map(s=>{const ok=s.streets.filter(st=>path(st)!=='Neither, on paper').length,alt=s.streets.length-ok;return `<li><a href="#/draft/${s.nbr}"><b>${esc(s.name)}</b></a> <span class="muted">· ${ok} requested street${ok===1?'':'s'}${alt?`, ${alt} for a crosswalk or guard instead`:''}</span></li>`;}).join('')}</ul>
      <h2>The seven pickups</h2><p>A school zone’s hours follow its school’s bell, and only its principal can ask to change it. The seven closed campuses have no principal, and the shuttle there runs on the receiving school’s clock. Whether each old zone is still in the ordinance, and on what hours, is not public. Someone has to decide what those zones do in 2027–28, by the same April 15. <a href="#/data">See the pickup table ›</a></p>${staffNav('april15')}</section>`;},
    draft(nbr){const Z=cache.zone_requests||{schools:[]};const s=Z.schools.find(x=>x.nbr==nbr);if(!s)return screens.april15();const z=D().closed.find(c=>c.name===s.zone)||{hazOld:{combined:0},hazNew:{combined:0}};const p=WC.principals[s.nbr]||{};
      const doc=docs.zone({school:s.name,address:s.address,principal:p.name,zoneName:s.zone,before:z.hazOld.combined,now:z.hazNew.combined,count:true,streets:s.streets.map(st=>({name:st.name,ped:st.pedDangerous,pc:st.pedCrashes,pd:st.pedDeaths,toc:!!(st.streetClass||{}).thoroughfareOrCollector,borders:!!st.borders,owner:(st.streetClass||{}).owner,share:st.share}))});
      printRoot.innerHTML=doc;return `<section class="screen has-bar">${back()}<p class="eyebrow">${t('staff_h')}</p><h1>Draft school zone application: ${esc(s.name)}</h1><div class="cols"><div class="col"><p class="lede muted">Streets a newly zoned walk crosses, sorted by HPW’s written paths. Public data fills the table; the principal adds bell times, contacts and the school’s own count.</p>
      <dl class="def"><dt>Principal</dt><dd>${esc(p.name||t('front'))}<br>${esc(s.name)} · ${esc(s.address)}${p.phone?`<br><a href="tel:${p.phone.replace(/\D/g,'')}">${t('call')} ${esc(p.phone)}</a>`:''}</dd><dt>Send to</dt><dd>Houston Public Works, School Coordination Program<br><a href="mailto:${WC.hpwEmail}">${WC.hpwEmail}</a></dd></dl></div>
      <div class="col side">${paper(doc,'1 page')}${actionBar([{act:'print',label:t('print_req'),primary:true}])}</div></div></section>`;}
  };
  const staffNav=cur=>`<nav class="staffnav" aria-label="Staff pages"><span class="muted">${t('staff_h')}:</span>${[['data','Closed zones data'],['corridors','Corridors'],['april15','Before April 15']].map(([k,l])=>`<a href="#/${k}" ${k===cur?'aria-current="page"':''}>${l}</a>`).join('')}</nav>`;

  /* ---------- maps (MapLibre + OpenFreeMap "positron": a light, quiet basemap, no key) ---------- */
  const STYLE='https://tiles.openfreemap.org/styles/positron';
  const fc=(feats)=>({type:'FeatureCollection',features:feats});
  const lineF=(coords,props)=>({type:'Feature',properties:props||{},geometry:{type:'LineString',coordinates:coords}});
  const polyF=(rings,props)=>({type:'Feature',properties:props||{},geometry:{type:'Polygon',coordinates:rings}});
  const ptF=(p,props)=>({type:'Feature',properties:props||{},geometry:{type:'Point',coordinates:p}});
  function marker(m,p,cls,glyph,label){const el=document.createElement('div');el.className='mkwrap';el.innerHTML=`<div class="mk ${cls}">${glyph||''}</div>${label?`<span class="mk-label">${esc(label)}</span>`:''}`;return new maplibregl.Marker({element:el,anchor:'top',offset:[0,-11]}).setLngLat(p).addTo(m);}
  function newMap(el,interactiveZoom){const mac=/Mac|iPhone|iPad/.test(navigator.platform);
    const m=new maplibregl.Map({container:el,style:STYLE,center:[-95.33,29.75],zoom:11,attributionControl:{compact:true},cooperativeGestures:true,dragRotate:false,pitchWithRotate:false,touchPitch:false,
      locale:{'CooperativeGesturesHandler.WindowsHelpText':t('coop_win'),'CooperativeGesturesHandler.MacHelpText':t('coop_mac'),'CooperativeGesturesHandler.MobileHelpText':t('coop_touch')}});
    if(interactiveZoom)m.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');m.touchZoomRotate.disableRotation();return m;}
  const addLine=(m,id,data,paint)=>{m.addSource(id,{type:'geojson',data});m.addLayer({id,type:'line',source:id,layout:{'line-cap':'round','line-join':'round'},paint});};
  function bounds(pts){const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return [[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]];}
  let walkMaps=[],spyOff=null;
  function showOnMap(i){const r=state.res;const c=r.now[i];if(!c)return;const wrap=app.querySelector('.mob-only .mapwrap')||app.querySelector('.mapwrap');
    if(isPhone()&&wrap)wrap.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
    walkMaps.forEach(({m,marks})=>{m.flyTo({center:c.at,zoom:16,duration:reduced()?0:700,essential:true});marks.forEach((mk,j)=>mk.getElement().classList.toggle('is-hot',j===i));});}
  function mountMaps(){ walkMaps=[]; if(!window.maplibregl)return; app.querySelectorAll('[data-map]').forEach(el=>{
    if(!el.clientWidth)return; /* the phone/desktop copy that CSS hides */
    const kind=el.dataset.map;const m=newMap(el,!isPhone()||kind==='pick');
    m.on('load',()=>{
      if(kind==='walk'){const r=state.res;
        addLine(m,'zone',fc([lineF(r.closed.rings[0])]),{'line-color':'#1F6E5A','line-width':1.5,'line-dasharray':[2,3],'line-opacity':.7});
        const names=new Set(r.now.filter(c=>c.kind==='road').map(c=>c.name));
        addLine(m,'roads',fc(D().roads.filter(l=>names.has(l.name)).map(l=>lineF(l.c))),{'line-color':'#D9822B','line-width':5,'line-opacity':.85});
        if(r.now.some(c=>c.kind==='rail'))addLine(m,'rails',fc(D().rails.map(l=>lineF(l.c))),{'line-color':'#22302C','line-width':2,'line-dasharray':[3,3],'line-opacity':.8});
        addLine(m,'pick',fc([lineF([r.home,r.closed.loc])]),{'line-color':'#1F6E5A','line-width':3,'line-dasharray':[0.2,2.2],'line-opacity':.85});
        addLine(m,'walk',fc([lineF(reduced()?[r.home,r.recv.loc]:[r.home,r.home])]),{'line-color':'#1F6E5A','line-width':4,'line-opacity':.95});
        walkMaps.push({m,marks:r.now.map((c,i)=>marker(m,c.at,'x'+(c.kind==='rail'?' rail':''),String(i+1)))});
        const lights=r.now.filter(c=>c.control.has);m.addSource('lights',{type:'geojson',data:fc(lights.map(c=>ptF(c.control.loc,{n:c.control.name})))});
        m.addLayer({id:'lights',type:'circle',source:'lights',paint:{'circle-radius':5,'circle-color':'#1F6E5A','circle-stroke-color':'#fff','circle-stroke-width':2}});
        m.addLayer({id:'lights-l',type:'symbol',source:'lights',layout:{'text-field':['get','n'],'text-size':11,'text-variable-anchor':['left','right','bottom','top'],'text-radial-offset':.9,'text-justify':'auto','text-font':['Noto Sans Regular']},paint:{'text-color':'#164F41','text-halo-color':'#fff','text-halo-width':1.5}});
        marker(m,r.closed.loc,'bus','P',r.closed.name);marker(m,r.recv.loc,'school','S',r.recv.name);marker(m,r.home,'home','',state.lang==='es'?'Casa':'Home');
        m.fitBounds(bounds([r.home,r.recv.loc,r.closed.loc]),{padding:isPhone()?{top:72,bottom:48,left:44,right:44}:{top:56,bottom:132,left:44,right:44},duration:0});
        if(!reduced()){const t0=performance.now(),dur=1100,src=m.getSource('walk');const ease=x=>1-Math.pow(1-x,3);
          const step=now=>{const k=Math.min(1,ease((now-t0)/dur));const p=[r.home[0]+(r.recv.loc[0]-r.home[0])*k,r.home[1]+(r.recv.loc[1]-r.home[1])*k];src.setData(fc([lineF([r.home,p])]));if(k<1)requestAnimationFrame(step);};setTimeout(()=>requestAnimationFrame(step),250);}
      }
      if(kind==='pick'){
        m.addSource('zones',{type:'geojson',data:fc(D().closed.map(z=>polyF(z.rings,{n:short(z.name)})))});
        m.addLayer({id:'zones-f',type:'fill',source:'zones',paint:{'fill-color':'#1F6E5A','fill-opacity':.08}});m.addLayer({id:'zones-l',type:'line',source:'zones',paint:{'line-color':'#1F6E5A','line-width':2}});
        m.addLayer({id:'zones-t',type:'symbol',source:'zones',layout:{'text-field':['get','n'],'text-size':13,'text-font':['Noto Sans Bold']},paint:{'text-color':'#164F41','text-halo-color':'#fff','text-halo-width':1.5}});
        m.fitBounds(bounds(D().closed.flatMap(z=>z.rings[0])),{padding:24,duration:0});
        let mk=null;const btn=app.querySelector('#usept');m.getCanvas().style.cursor='crosshair';
        m.on('click',e=>{const p=[e.lngLat.lng,e.lngLat.lat];if(mk)mk.setLngLat(p);else mk=marker(m,p,'home','','');btn.disabled=false;btn.onclick=()=>{setPoint(p,t('spot'));state.geocoded=false;ss('geo','0');go(state.res?walkHash():'#/nozone');};});
      }
      if(kind==='zones'){
        m.addSource('zones',{type:'geojson',data:fc(D().closed.map(z=>polyF(z.rings,{n:short(z.name),v:z.hazNew.combined})))});
        m.addLayer({id:'zones-f',type:'fill',source:'zones',paint:{'fill-color':'#D9822B','fill-opacity':['+',.12,['*',.6,['/',['get','v'],100]]]}});m.addLayer({id:'zones-l',type:'line',source:'zones',paint:{'line-color':'#1F6E5A','line-width':1.5}});
        addLine(m,'sh',fc(D().closed.flatMap(z=>z.receiving.map(r=>lineF([z.loc,r.loc])))),{'line-color':'#1F6E5A','line-width':2,'line-dasharray':[0.2,2.2]});
        m.addSource('rs',{type:'geojson',data:fc(D().closed.flatMap(z=>z.receiving.map(r=>ptF(r.loc,{n:short(r.name)}))))});
        m.addLayer({id:'rs',type:'circle',source:'rs',paint:{'circle-radius':5,'circle-color':'#fff','circle-stroke-color':'#1F6E5A','circle-stroke-width':2}});
        m.addSource('ps',{type:'geojson',data:fc(D().closed.map(z=>ptF(z.loc,{n:short(z.name)+' · '+Math.round(z.hazNew.combined)+'%'})))});
        m.addLayer({id:'ps',type:'circle',source:'ps',paint:{'circle-radius':6,'circle-color':'#1F6E5A','circle-stroke-color':'#fff','circle-stroke-width':2}});
        m.addLayer({id:'ps-l',type:'symbol',source:'ps',layout:{'text-field':['get','n'],'text-size':12,'text-font':['Noto Sans Bold'],'text-variable-anchor':['left','right','top','bottom'],'text-radial-offset':.8,'text-justify':'auto'},paint:{'text-color':'#164F41','text-halo-color':'#fff','text-halo-width':1.6}});
        m.fitBounds(bounds(D().closed.flatMap(z=>z.rings[0])),{padding:32,duration:0});
      }
    });
  });}

  /* ---------- share ---------- */
  const link=()=>location.origin+location.pathname+walkHash();
  function message(r){const cross=r.now.length?crossList(r.now):(state.lang==='es'?'nada de las listas de la Ciudad':'nothing on the City’s lists');return state.lang==='es'?`Walk Check: el camino de ${state.addr} a ${r.recv.name} cruza ${cross}. Autobús gratis desde ${r.closed.name} hasta 2028. Vea el camino: ${link()}`:`Walk Check: the walk from ${state.addr} to ${r.recv.name} crosses ${cross}. Free shuttle from ${r.closed.name} until 2028. See the walk: ${link()}`;}
  function openShare(text,title){
    sheetRoot.innerHTML=`<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><i class="grab"></i><div class="sheet-hd"><h2>${esc(title)}</h2><button class="x" data-close aria-label="${t('close')}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><span class="k">${t('your_msg')}</span><div class="msg"><p>${esc(text).replace(/https?:\/\/\S+/,u=>`<u>${esc(u.replace(/^https?:\/\//,'').replace(/[?#].*$/,''))}/walk…</u>`)}</p></div><p class="small muted">${isPhone()?t('opens_msgs'):t('opens_mail')}</p><div class="sheet-btns"><button class="btn" data-send>${ICON.share}<span>${t('share')}</span></button><button class="btn secondary" data-copy>${t('copy')}</button></div></div>`;
    requestAnimationFrame(()=>{sheetRoot.querySelector('.scrim').classList.add('is-in');sheetRoot.querySelector('.sheet').classList.add('is-in');sheetRoot.querySelector('[data-send]').focus();});
    sheetRoot.querySelector('[data-send]').onclick=()=>{ if(isPhone()){ if(navigator.share){navigator.share({text}).catch(()=>{});} else location.href='sms:?&body='+encodeURIComponent(text); } else location.href='mailto:?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent(text); };
    sheetRoot.querySelector('[data-copy]').onclick=async e=>{try{await navigator.clipboard.writeText(text);e.currentTarget.textContent=t('copied');}catch(_){}};
    sheetRoot.querySelectorAll('[data-close]').forEach(x=>x.onclick=closeShare); document.addEventListener('keydown',escClose);
  }
  function escClose(e){if(e.key==='Escape')closeShare();}
  function closeShare(){const s=sheetRoot.querySelector('.sheet'),sc=sheetRoot.querySelector('.scrim');if(!s)return;s.classList.remove('is-in');sc.classList.remove('is-in');document.removeEventListener('keydown',escClose);setTimeout(()=>sheetRoot.innerHTML='',420);}

  /* ---------- geocoding (OpenStreetMap Nominatim, Houston-bounded) ---------- */
  async function geocode(q){if(!/houston|tx\b|texas/i.test(q))q+=', Houston, TX';
    const u='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&bounded=1&viewbox=-95.95,30.20,-94.95,29.40&q='+encodeURIComponent(q);
    const j=await fetch(u,{headers:{'Accept-Language':'en'}}).then(r=>r.json());if(!j[0])return null;const a=j[0].address||{};const label=[a.house_number,a.road].filter(Boolean).join(' ')+(a.postcode?', '+a.postcode:'');return {pt:[+j[0].lon,+j[0].lat],label:label.trim()||j[0].display_name.split(',').slice(0,2).join(',')};}

  /* ---------- router ---------- */
  const go=h=>{location.hash=h;};
  function setPoint(p,addr,prek){ss('seen','1');state.pt=p;state.addr=addr;if(prek!==undefined)state.prek=prek;ss('pt',JSON.stringify(p));ss('addr',addr);ss('prek',state.prek?'1':'0');state.res=G.compute(p);}
  async function route(){
    const raw=location.hash.replace(/^#\/?/,'');const [path,qs]=raw.split('?');const [name,arg]=path.split('/');const q=new URLSearchParams(qs||'');
    app.classList.add('is-loading');await G.load();
    if(name==='sources')cache.meta=await getJSON('meta.json');
    if(name==='corridors')cache.corridors=await getJSON('corridors.json');
    if(name==='april15'||name==='draft')cache.zone_requests=await getJSON('zone_requests.json');
    if(q.has('lat')){state.shared=!ss('seen');ss('seen','1');setPoint([+q.get('lng'),+q.get('lat')],q.get('addr')||t('spot'),q.get('prek')==='1');}
    else{state.shared=false;if(state.pt&&!state.res)state.res=G.compute(state.pt);}
    let html;
    if(['walk','help','bus','schoolzone'].includes(name)){ if(!state.res){go('#/');return;} html=screens[name](q); }
    else if(name==='prek'){ if(!state.pt){go('#/');return;} html=screens.prek(); }
    else if(name==='zone'||name==='draft') html=screens[name](arg);
    else if(screens[name]) html=screens[name]();
    else html=screens.home();
    if(spyOff){spyOff();spyOff=null;}
    app.innerHTML=html; app.classList.remove('is-loading'); window.scrollTo(0,0); bind(); mountMaps(); app.focus({preventScroll:true});
    document.querySelectorAll('.topnav a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')==='#/'+name||(a.getAttribute('href')==='#/data'&&['data','corridors','april15','draft'].includes(name))?'page':'false'));
  }
  function fitPapers(){app.querySelectorAll('.paper').forEach(p=>{const s=(p.clientWidth-4)/612;p.style.setProperty('--s',s);p.style.height=(792*s+4)+'px';});}
  function bind(){
    const f=app.querySelector('#f');if(f&&ss('focus')){sessionStorage.removeItem('wc.focus');const i=app.querySelector('#addr');i.focus();i.select();}
    f?.addEventListener('submit',async e=>{e.preventDefault();const v=app.querySelector('#addr').value.trim();if(!v)return;const b=app.querySelector('#go'),err=app.querySelector('#err');err.hidden=true;b.disabled=true;b.textContent=t('finding');
      let g=null;try{g=await geocode(v);}catch(_){}
      b.disabled=false;b.textContent=t('check');
      if(!g){err.hidden=false;return;}const p=g.pt,label=g.label;
      setPoint(p,label||v);state.geocoded=true;ss('geo','1');go(state.res?walkHash():'#/nozone');});
    app.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>{const z=D().closed.find(z=>z.nbr==b.dataset.demo);const addr=(state.lang==='es'?'Punto de muestra en la zona de ':'Sample point in the old ')+short(z.name)+(state.lang==='es'?'':' area');setPoint(z.demo,addr);state.geocoded=false;ss('geo','0');go(walkHash());});
    app.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{state.prek=b.dataset.grade==='1';ss('prek',state.prek?'1':'0');history.replaceState(null,'',walkHash());route();});
    app.querySelector('[data-fix]')?.addEventListener('click',()=>{ss('focus','1');});
    app.querySelectorAll('[data-prek]').forEach(b=>b.onclick=()=>{state.prek=b.dataset.prek==='1';ss('prek',state.prek?'1':'0');go(walkHash());});
    app.querySelectorAll('[data-pair]').forEach(a=>a.addEventListener('click',e=>{if(reduced()||a.classList.contains('is-on'))return;e.preventDefault();a.classList.add('is-on');setTimeout(()=>{location.hash=a.getAttribute('href');},280);}));
    app.querySelectorAll('[data-showmap]').forEach(b=>b.onclick=e=>{e.stopPropagation();showOnMap(+b.dataset.showmap);});
    app.querySelectorAll('.xrow[data-x]').forEach(li=>li.addEventListener('click',e=>{if(e.target.closest('details,a,button'))return;showOnMap(+li.dataset.x);}));
    if(!isPhone()&&app.querySelector('.xrow[data-x]')){const rows=[...app.querySelectorAll('.xrow[data-x]')];let cur=-1,tick=false;
      const spy=()=>{tick=false;const line=innerHeight*0.38;let bi=-1;rows.forEach((r,i)=>{if(r.getBoundingClientRect().top<=line)bi=i;});const first=rows[0].getBoundingClientRect();if(first.top>innerHeight*0.9)bi=-1;
        if(bi!==cur){cur=bi;walkMaps.forEach(({marks})=>marks.forEach((mk,j)=>mk.getElement().classList.toggle('is-hot',j===bi)));}};
      const onScroll=()=>{if(!tick){tick=true;requestAnimationFrame(spy);}};addEventListener('scroll',onScroll,{passive:true});spyOff=()=>removeEventListener('scroll',onScroll);}
    const anchor=app.querySelector('[data-ctx-anchor]'),ctx=app.querySelector('.ctx');
    if(anchor&&ctx&&'IntersectionObserver' in window){new IntersectionObserver(([en])=>ctx.classList.toggle('is-on',!en.isIntersecting&&en.boundingClientRect.top<0),{rootMargin:'-64px 0px 0px 0px'}).observe(anchor);}
    app.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>history.length>1?history.back():go('#/'));
    app.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{const r=state.res;switch(b.dataset.act){
      case 'help':go('#/help');break; case 'zone':go('#/schoolzone');break;
      case 'print':window.print();break;
      case 'share':openShare(message(r),t('share_h'));break;
      case 'share-school':openShare(`Walk Check request for ${r.recv.name}: ${message(r)}`,t('share_school'));break;
      case 'share-zone':{const z=D().closed.find(x=>x.nbr==b.dataset.zone);openShare(`${short(z.name)} → ${z.receiving.map(x=>short(x.name)).join(' / ')}: ${Math.round(z.hazNew.combined)}% of the old zone now walks across a dangerous road or train tracks, up from ${Math.round(z.hazOld.combined)}%. ${location.origin}${location.pathname}#/zone/${z.nbr}`,t('share_h'));break;}
      case 'share-site':openShare(`Walk Check shows what a child’s walk to the new school crosses, where to cross, and how to ask for a bus or a school zone. ${location.origin}${location.pathname}`,t('share_h'));break;}});
    fitPapers();
  }
  addEventListener('resize',fitPapers);
  document.querySelectorAll('.lang-btn').forEach(b=>b.onclick=()=>{state.lang=b.dataset.lang;ss('lang',state.lang);document.documentElement.lang=state.lang;document.querySelectorAll('.lang-btn').forEach(x=>{const on=x===b;x.classList.toggle('is-on',on);x.setAttribute('aria-pressed',on);});route();});
  const lb=document.querySelector(`.lang-btn[data-lang="${state.lang}"]`);if(lb){document.documentElement.lang=state.lang;document.querySelectorAll('.lang-btn').forEach(x=>{const on=x===lb;x.classList.toggle('is-on',on);x.setAttribute('aria-pressed',on);});}
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  addEventListener('hashchange',route);
  addEventListener('scroll',()=>document.getElementById('top').classList.toggle('is-scrolled',scrollY>4),{passive:true});
  const sp=document.getElementById('splash');
  if(ss('splash')){sp.remove();} else {ss('splash','1');setTimeout(()=>sp.classList.add('is-gone'),1300);setTimeout(()=>sp.remove(),1900);}
  route();
})();
