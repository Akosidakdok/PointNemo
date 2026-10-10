import pathlib, subprocess, zipfile, datetime
root=pathlib.Path.cwd()
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
target=root/'tmp'/('pre-main-recovery-'+stamp+'.zip')
paths=set()
for args in [['git','diff','--name-only','-z'],['git','diff','--cached','--name-only','-z'],['git','ls-files','--others','--exclude-standard','-z']]:
    paths.update(subprocess.check_output(args).decode().split('\0'))
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(paths):
        path=root/name
        if name and path.is_file() and path!=target: archive.write(path,name)
    for name,args in [('git-status.txt',['git','status','--porcelain=v2','--branch']),('working.patch',['git','diff','--binary']),('staged.patch',['git','diff','--cached','--binary']),('unmerged.txt',['git','ls-files','-u'])]:
        archive.writestr(name,subprocess.check_output(args))
print(target)
