import json,gzip,glob,os,sys
import numpy as np
from PIL import Image
A,B=sys.argv[1],sys.argv[2]
only=sys.argv[3] if len(sys.argv)>3 else ''
TOL=float(os.environ.get('TOL','1'))
import re
def load(f):
  d=json.load(gzip.open(f))
  # body-level children: number them per tag among shown elements (inline <script> tags shift raw indexes)
  cnt={};ren={}
  for e in d['d']:
    m=re.match(r'^body/([a-z0-9-]+?)(\d+)$',e['p'])
    if m:
      t=m.group(1);cnt[t]=cnt.get(t,0)+1;ren['body/'+t+m.group(2)]='body/'+t+'#'+str(cnt[t])
  for e in d['d']:
    p=e['p'];m=re.match(r'^(body/[a-z0-9-]+?\d+)(/.*)?$',p)
    if m and m.group(1) in ren: e['p']=ren[m.group(1)]+(m.group(2) or '')
  return d
tot=0;rows=[]
names=sorted(set(os.path.basename(f) for f in [g for g in glob.glob(A+'/*.json.gz') if '.m.' not in g])|set(os.path.basename(f) for f in [g for g in glob.glob(B+'/*.json.gz') if '.m.' not in g]))
for n in names:
  if only and only not in n: continue
  fa,fb=A+'/'+n,B+'/'+n
  if not os.path.exists(fa) or not os.path.exists(fb): rows.append((n,'MISSING in '+('A' if not os.path.exists(fa) else 'B')));continue
  a,b=load(fa),load(fb)
  msgs=[]
  if a['errs']!=b['errs']: msgs.append('ERRS A=%s B=%s'%(a['errs'][:2],b['errs'][:2]))
  if b['errs']: msgs.append('B-ERRS %s'%b['errs'][:3])
  da={e['p']:e for e in a['d']}; db={e['p']:e for e in b['d']}
  for p in da:
    if p not in db: msgs.append('gone %s %s'%(p,da[p].get('x',''))); continue
    x,y=da[p],db[p]
    for k in ('t','x','v'):
      if x.get(k)!=y.get(k): msgs.append('%s %s: %s -> %s'%(p,k,x.get(k),y.get(k)))
    ra,rb=x.get('r'),y.get('r')
    if ra and rb and max(abs(u-v) for u,v in zip(ra,rb))>TOL and not ('/svg' in p and 'header' in p): msgs.append('%s r: %s -> %s'%(p,ra,rb))
    for k in x['s']:
      if x['s'][k]!=y['s'].get(k): msgs.append('%s %s: %s -> %s'%(p,k,x['s'][k][:80],str(y['s'].get(k))[:80]))
    for ps in ('::before','::after'):
      if x.get(ps)!=y.get(ps): msgs.append('%s %s: %s -> %s'%(p,ps,str(x.get(ps))[:160],str(y.get(ps))[:160]))
  for p in db:
    if p not in da: msgs.append('new %s %s'%(p,db[p].get('x','')))
  pa,pb=fa.replace('.json.gz','.png'),fb.replace('.json.gz','.png')
  if os.path.exists(pa) and os.path.exists(pb):
    ia,ib=np.asarray(Image.open(pa).convert('RGB')).astype(int),np.asarray(Image.open(pb).convert('RGB')).astype(int)
    if ia.shape!=ib.shape: msgs.append('PNG size differs')
    else:
      d=(np.abs(ia-ib).sum(2)>24).sum()
      if d: msgs.append('PNG %d px differ'%d)
  if msgs: rows.append((n,msgs))
for n,m in rows:
  if isinstance(m,str): print(n,m);continue
  print('==',n,len(m)); [print('   ',x) for x in m[:int(os.environ.get('N','6'))]]
print('states:',len(names),'with diffs:',len(rows))
