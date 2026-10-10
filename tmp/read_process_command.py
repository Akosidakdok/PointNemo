import ctypes,json,sys
from ctypes import wintypes
kernel=ctypes.WinDLL('kernel32',use_last_error=True)
kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
kernel.OpenProcess.restype=wintypes.HANDLE
kernel.CloseHandle.argtypes=[wintypes.HANDLE]
nt=ctypes.WinDLL('ntdll')
nt.NtQueryInformationProcess.argtypes=[wintypes.HANDLE,wintypes.ULONG,ctypes.c_void_p,wintypes.ULONG,ctypes.POINTER(wintypes.ULONG)]
nt.NtQueryInformationProcess.restype=ctypes.c_long
class UnicodeString(ctypes.Structure):
    _fields_=[('Length',wintypes.USHORT),('MaximumLength',wintypes.USHORT),('Buffer',ctypes.c_void_p)]
for arg in sys.argv[1:]:
    handle=kernel.OpenProcess(0x1000,False,int(arg))
    if not handle: raise ctypes.WinError(ctypes.get_last_error())
    try:
        size=wintypes.ULONG()
        nt.NtQueryInformationProcess(handle,60,None,0,ctypes.byref(size))
        buf=ctypes.create_string_buffer(max(size.value,4096))
        result=nt.NtQueryInformationProcess(handle,60,buf,len(buf),ctypes.byref(size))
        if result < 0: raise RuntimeError(hex(result & 0xffffffff))
        value=UnicodeString.from_buffer(buf)
        print(json.dumps({'pid':int(arg),'command':ctypes.wstring_at(value.Buffer,value.Length//2)}))
    finally: kernel.CloseHandle(handle)
