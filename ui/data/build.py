"""Trim the repo's public data pulls into one small file the site loads: ui/data/walk.json.
Run: python3 ui/data/build.py  (from the repo root). Sources are read from public/data."""
import json, os
here=os.path.dirname(os.path.abspath(__file__))
src=os.path.join(here,'..','..','public','data')
if not os.path.isdir(src): src=here
L=lambda f: json.load(open(os.path.join(src,f)))
zones=L('zones.json'); zr=L('zone_requests.json'); sh=L('shuttles.json'); cor=L('corridors.json'); meta=L('meta.json')
zn=L('zones_new.geojson'); hin=L('hin.geojson'); ped=L('ped_hin.geojson'); rail=L('rail.geojson'); sig=L('signals.json'); rx=L('rail_crossings.json')
R=lambda c:[round(c[0],5),round(c[1],5)]
recv_nbrs={s['nbr'] for s in zr['schools']}
recv=[]
for f in zn['features']:
    p=f['properties']
    if p['Campus__Number'] in recv_nbrs:
        g=f['geometry']; polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
        recv.append({'nbr':p['Campus__Number'],'name':p['Campus_Short_Name'],'address':p['Street_Address'],'rings':[[R(c) for c in ring] for poly in polys for ring in poly[:1]]})
# receiving school locs from zone_requests
for r in recv:
    s=next(x for x in zr['schools'] if x['nbr']==r['nbr']); r['loc']=R(s['loc']); r['zip']=s['zip']; r['zone']=s['zone']
closed=[]
for z in zones['zones']:
    s=next(x for x in sh['shuttles'] if x['from']['nbr']==z['nbr'])
    closed.append({'nbr':z['nbr'],'name':z['name'],'address':z['oldSchool']['address'],'loc':R(z['oldSchool']['loc']),
      'rings':[[R(c) for c in ring] for ring in z['rings']],'demo':R(z['demoPoint']),
      'receiving':[{'nbr':next(x['nbr'] for x in zr['schools'] if x['name']==r['name']),'name':r['name'],'address':r['address'],'loc':R(r['loc']),'share':round(r['share'],1)} for r in z['receiving']],
      'medOldM':round(z['medianOldM']),'medNewM':round(z['medianNewM']),'pctFarther':round(z['pctFarther'],1),'pctOver2New':round(z['pctOver2New'],1),'maxNewMi':round(z['maxNewMi'],2),
      'hazOld':{k:round(v,1) for k,v in z['hazardOld'].items()},'hazNew':{k:round(v,1) for k,v in z['hazardNew'].items()},
      'pickupRoads':[{'name':p['name'],'share':round(p['share'],1),'ped':p['pedDangerous']} for p in z['pickupRoads']],
      'shuttleMi':round(s['to'][0]['miles'],2),'grounds':[[R(c) for c in ring] for poly in (s['from'].get('grounds') or []) for ring in poly[:1]]})
# bbox
xs=[c[0] for z in closed+recv for ring in z['rings'] for c in ring]; ys=[c[1] for z in closed+recv for ring in z['rings'] for c in ring]
pad=0.02; bb=[min(xs)-pad,min(ys)-pad,max(xs)+pad,max(ys)+pad]
inb=lambda c: bb[0]<=c[0]<=bb[2] and bb[1]<=c[1]<=bb[3]
import re
def nice(n):
    t=n.title()
    t=re.sub(r'(\d)(St|Nd|Rd|Th)\b',lambda m:m.group(1)+m.group(2).lower(),t)
    t=t.replace(' Railroad Company','').replace(' Railway Company',' Railway').replace(' Company','').replace('Bnsf','BNSF').replace('Mccarty','McCarty')
    for a,b in (('Ih ','IH '),('Us ','US '),('Sh ','SH '),('Fm ','FM '),(' Ssgt ',' SSgt '),('Mlk','MLK')): t=t.replace(a,b)
    return t
def clip(parts):
    # keep only runs of coordinates that touch the bbox (plus one neighbour each side)
    res=[]
    for part in parts:
        keep=[inb(c) for c in part]; keep=[k or (i>0 and keep[i-1]) or (i<len(keep)-1 and keep[i+1]) for i,k in enumerate(keep)]
        run=[]
        for c,k in zip(part,keep):
            if k: run.append(c)
            elif len(run)>1: res.append(run); run=[]
            else: run=[]
        if len(run)>1: res.append(run)
    return res
def lines(fc,layer):
    out=[]
    for i,f in enumerate(fc['features']):
        g=f['geometry']; parts=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
        for part in clip(parts):
            if True:
                p=f['properties']
                out.append({'id':i,'name':nice(p.get('Full_Name') or p.get('RR_COMPANY') or ''),'ped':layer=='ped','pc':p.get('ped_crash_count',0),'pd':p.get('ped_death_count',0),'tc':p.get('total_crash_count',0),'c':[R(c) for c in part]})
    return out
roads=lines(hin,'hin')
pednames={(l['id']) for l in lines(ped,'ped')}
# mark ped-dangerous segments by matching geometry to ped layer
pedset=set()
for f in ped['features']:
    g=f['geometry']; parts=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
    for part in parts: pedset.add(tuple(map(tuple,[R(c) for c in part[:3]])))
for r in roads: r['ped']=tuple(map(tuple,r['c'][:3])) in pedset
# ped features that are not in hin geometry (rare) → add
for l in lines(ped,'ped'):
    if tuple(map(tuple,l['c'][:3])) not in {tuple(map(tuple,r['c'][:3])) for r in roads}: roads.append(l)
rails=[{'c':l['c'],'name':l['name']} for l in lines(rail,'rail')]
signals=[{'name':s['name'],'loc':R(s['loc']),'src':s['src']} for s in sig if inb(s['loc'])]
xings=[{'street':nice(x['street']),'rr':x['railroad'].replace(' Railroad Company','').replace(' Company',''),'loc':R(x['loc']),'gates':x['gates'],'flashers':x['flashers'],'purpose':x['purpose']} for x in rx if inb(x['loc']) and x['type']=='Public']
streets={}
for c in cor:
    if c['kind']!='road': continue
    sc=c.get('streetClass') or {}
    streets[c['name'].upper()]={'toc':bool(sc.get('thoroughfareOrCollector')),'type':sc.get('type'),'owner':sc.get('owner'),'borders':c.get('bordersSchool') or [],'nearest':(c.get('control') or {}).get('nearest')}
dates={'crash':'2022','rail':meta['rail']['lastEditDate'],'zones':meta['zones_new']['lastEditDate'],'schools':meta['schools_new']['lastEditDate'],'signals':meta['signals']['readOn'],'xings':meta['rail_crossings']['readOn'],'pulled':meta['fetchedAt'][:10]}
out={'bbox':[round(v,4) for v in bb],'closed':closed,'receiving':recv,'roads':roads,'rails':rails,'signals':signals,'xings':xings,'streets':streets,'dates':dates,'totals':{k:(round(v,1) if isinstance(v,float) else v) for k,v in zones['totals'].items() if k in('points','spacingM','pctOver2New','closedZones')} | {'hazOld':{k:round(v,1) for k,v in zones['totals']['hazardOld'].items()},'hazNew':{k:round(v,1) for k,v in zones['totals']['hazardNew'].items()}}}
json.dump(out,open(os.path.join(here,'walk.json'),'w'),separators=(',',':'))
print('walk.json',os.path.getsize(os.path.join(here,'walk.json'))//1024,'KB; roads',len(roads),'rails',len(rails),'signals',len(signals),'xings',len(xings),'recv',len(recv),'bbox',out['bbox'])
