from pathlib import Path
import subprocess
files=subprocess.check_output(['git','diff','--name-only','--diff-filter=U']).decode().splitlines()
review=[]
for name in files:
    path=Path(name)
    lines=path.read_text(encoding='utf-8').splitlines(keepends=True)
    output=[]; ours=[]; theirs=[]; mode='normal'
    for line in lines:
        if line.startswith('<<<<<<< '):
            assert mode=='normal'; mode='ours'; ours=[]; theirs=[]
        elif line.startswith('=======') and mode=='ours': mode='theirs'
        elif line.startswith('>>>>>>> ') and mode=='theirs':
            output.extend(ours); review.append(name+'\nOURS\n'+''.join(ours)+'\nMAIN\n'+''.join(theirs)); mode='normal'
        elif mode=='ours': ours.append(line)
        elif mode=='theirs': theirs.append(line)
        else: output.append(line)
    assert mode=='normal'
    path.write_text(''.join(output),encoding='utf-8',newline='\n')
Path('tmp/conflict-review.txt').write_text('\n\n'.join(review),encoding='utf-8')
print('\n'.join(files))
