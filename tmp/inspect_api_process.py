import subprocess,json
print(subprocess.check_output(['netstat','-ano','-p','tcp'],text=True).split('Active Connections')[0])
for line in subprocess.check_output(['netstat','-ano','-p','tcp'],text=True).splitlines():
    if '127.0.0.1:3000' in line and 'LISTENING' in line:
        print(line.strip())
try:
    import psutil
    for process in psutil.process_iter(['pid','ppid','name','cmdline','cwd']):
        args=process.info['cmdline'] or []
        if 'pointnemo' in ' '.join(args).lower() and process.info['name'].lower() in ('node.exe','cmd.exe'):
            print(json.dumps(process.info))
except ImportError:
    print('psutil unavailable')
