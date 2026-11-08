# significant diffs only: gone/new elements, text, display/visibility/color, rect > 3px; ignore header (animated purse/emblem) and known accepted
import re,sys,subprocess,os
os.environ['N']='100000'; os.environ['TOL']='3'
out=subprocess.run(['python3','diff.py',sys.argv[1],sys.argv[2]]+sys.argv[3:],capture_output=True,text=True,env=os.environ).stdout
cur=None;keep={}
IGN=re.compile(r'(gone|new) body/div#3/form0/.*/(button|span)0 i$|img[0-9] opacity: [01] -> [01]|body/header#1|section12/div1/div0/div0|font-family|font-weight|line-height|align-items|letter-spacing|justify-content|box-shadow|opacity: 0\.[0-9]|transform: matrix|PNG|B-ERRS \[.console: Access to fetch|ERRS A=')
for l in out.splitlines():
  if l.startswith('=='): cur=l.split()[1]; continue
  if l.startswith('states:') or 'MISSING' in l: continue
  if cur and not IGN.search(l): keep.setdefault(cur,[]).append(l.strip())
for k,v in keep.items():
  print('==',k,len(v)); [print('   ',x[:220]) for x in v[:int(os.environ.get('M','5'))]]
print('significant states:',len(keep))
