#![allow(non_snake_case)]

use std::collections::HashSet;
use std::time::Instant;

use chrono::Utc;

use super::types::*;

struct CpuSnapshot {
    idle: u64,
    total: u64,
}

struct NetSnapshot {
    rx: u64,
    tx: u64,
    time: Instant,
}

pub struct Collector {
    prev_cpu: Option<CpuSnapshot>,
    prev_net: Option<NetSnapshot>,
}

impl Collector {
    pub fn new() -> Self {
        Self {
            prev_cpu: None,
            prev_net: None,
        }
    }

    pub fn collect(&mut self, sources: &HashSet<String>) -> PerfSnapshot {
        let mut snap = PerfSnapshot::default();
        snap.timestamp = Utc::now().timestamp_millis();

        if sources.contains("cpu") {
            snap.cpu = self.collect_cpu();
        }
        if sources.contains("memory") {
            snap.memory = self.collect_memory();
        }
        if sources.contains("network") {
            snap.network = self.collect_network();
        }
        if sources.contains("disk") {
            snap.disk = self.collect_disk();
        }
        if sources.contains("battery") {
            snap.battery = self.collect_battery();
        }
        if sources.contains("uptime") {
            snap.uptime = self.collect_uptime();
        }

        snap
    }

    // ─── CPU ─────────────────────────────────────────────────

    fn collect_cpu(&mut self) -> Option<f64> {
        let (idle, total) = self.read_cpu_times()?;

        if let Some(prev) = &self.prev_cpu {
            let idle_d = idle.saturating_sub(prev.idle);
            let total_d = total.saturating_sub(prev.total);
            self.prev_cpu = Some(CpuSnapshot { idle, total });
            if total_d == 0 {
                return Some(0.0);
            }
            Some(((1.0 - idle_d as f64 / total_d as f64) * 100.0).clamp(0.0, 100.0))
        } else {
            self.prev_cpu = Some(CpuSnapshot { idle, total });
            None
        }
    }

    #[cfg(target_os = "windows")]
    fn read_cpu_times(&self) -> Option<(u64, u64)> {
        #[repr(C)]
        #[derive(Default)]
        struct FILETIME {
            lo: u32,
            hi: u32,
        }
        impl FILETIME {
            fn val(&self) -> u64 {
                ((self.hi as u64) << 32) | self.lo as u64
            }
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn GetSystemTimes(
                lpIdleTime: *mut FILETIME,
                lpKernelTime: *mut FILETIME,
                lpUserTime: *mut FILETIME,
            ) -> i32;
        }
        unsafe {
            let mut idle = FILETIME::default();
            let mut kernel = FILETIME::default();
            let mut user = FILETIME::default();
            if GetSystemTimes(&mut idle, &mut kernel, &mut user) == 0 {
                return None;
            }
            let idle_v = idle.val();
            let total = kernel.val() + user.val();
            Some((idle_v, total))
        }
    }

    #[cfg(target_os = "linux")]
    fn read_cpu_times(&self) -> Option<(u64, u64)> {
        let text = std::fs::read_to_string("/proc/stat").ok()?;
        let line = text.lines().next()?;
        let parts: Vec<u64> = line
            .split_whitespace()
            .skip(1)
            .filter_map(|s| s.parse().ok())
            .collect();
        if parts.is_empty() {
            return None;
        }
        let idle = parts.get(3).copied().unwrap_or(0)
            + parts.get(4).copied().unwrap_or(0); // idle + iowait
        let total: u64 = parts.iter().sum();
        Some((idle, total))
    }

    #[cfg(target_os = "macos")]
    fn read_cpu_times(&self) -> Option<(u64, u64)> {
        use std::mem;
        #[repr(C)]
        struct host_cpu_load_info {
            cpu_ticks: [u32; 4], // user, system, idle, nice
        }
        const HOST_CPU_LOAD_INFO: u32 = 3;
        const HOST_CPU_LOAD_INFO_COUNT: u32 =
            mem::size_of::<host_cpu_load_info>() as u32 / 4;
        extern "C" {
            fn mach_host_self() -> u32;
            fn host_statistics(
                host_priv: u32,
                flavor: u32,
                host_info_out: *mut u32,
                host_info_outCnt: *mut u32,
            ) -> u32;
        }
        unsafe {
            let host = mach_host_self();
            let mut info = host_cpu_load_info { cpu_ticks: [0; 4] };
            let mut count = HOST_CPU_LOAD_INFO_COUNT;
            if host_statistics(
                host,
                HOST_CPU_LOAD_INFO,
                info.cpu_ticks.as_mut_ptr(),
                &mut count,
            ) != 0
            {
                return None;
            }
            let user = info.cpu_ticks[0] as u64;
            let system = info.cpu_ticks[1] as u64;
            let idle = info.cpu_ticks[2] as u64;
            let nice = info.cpu_ticks[3] as u64;
            Some((idle, user + system + idle + nice))
        }
    }

    // ─── Memory ──────────────────────────────────────────────

    #[cfg(target_os = "windows")]
    fn collect_memory(&self) -> Option<f64> {
        #[repr(C)]
        struct MEMORYSTATUSEX {
            dwLength: u32,
            dwMemoryLoad: u32,
            _ullTotalPhys: u64,
            _ullAvailPhys: u64,
            _pad: [u64; 5],
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn GlobalMemoryStatusEx(lpBuffer: *mut MEMORYSTATUSEX) -> i32;
        }
        unsafe {
            let mut s = MEMORYSTATUSEX {
                dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
                dwMemoryLoad: 0,
                _ullTotalPhys: 0,
                _ullAvailPhys: 0,
                _pad: [0; 5],
            };
            if GlobalMemoryStatusEx(&mut s) == 0 {
                return None;
            }
            Some(s.dwMemoryLoad as f64)
        }
    }

    #[cfg(target_os = "linux")]
    fn collect_memory(&self) -> Option<f64> {
        let text = std::fs::read_to_string("/proc/meminfo").ok()?;
        let mut total = 0u64;
        let mut available = 0u64;
        for line in text.lines() {
            if line.starts_with("MemTotal:") {
                total = line.split_whitespace().nth(1)?.parse().ok()?;
            } else if line.starts_with("MemAvailable:") {
                available = line.split_whitespace().nth(1)?.parse().ok()?;
            }
        }
        if total == 0 {
            return None;
        }
        Some(((total - available) as f64 / total as f64 * 100.0).clamp(0.0, 100.0))
    }

    #[cfg(target_os = "macos")]
    fn collect_memory(&self) -> Option<f64> {
        use std::mem;
        // Must match the kernel's vm_statistics64 on modern macOS (10.12+).
        // Missing fields cause host_statistics64 to reject the buffer size.
        #[repr(C)]
        struct vm_statistics64 {
            _free_count: u32,
            _active_count: u32,
            _inactive_count: u32,
            _wire_count: u32,
            _zero_fill_count: u64,
            _reactivations: u64,
            _pageins: u64,
            _pageouts: u64,
            _faults: u64,
            _cow_faults: u64,
            _lookups: u64,
            _hits: u64,
            _purgeable_count: u32,
            _purges: u64,
            _speculative_count: u32,
            _decompressions: u64,
            _compressions: u64,
            _swapins: u64,
            _swapouts: u64,
            _compressor_page_count: u32,
            _throttled_count: u32,
            _external_page_count: u32,
            _internal_page_count: u32,
            _total_uncompressed_pages_in_compressor: u64,
        }
        const HOST_VM_INFO64: u32 = 6;
        extern "C" {
            fn mach_host_self() -> u32;
            fn host_statistics64(
                host_priv: u32,
                flavor: u32,
                host_info_out: *mut u32,
                host_info_outCnt: *mut u32,
            ) -> u32;
            fn sysctlbyname(
                name: *const i8,
                oldp: *mut std::ffi::c_void,
                oldlenp: *mut usize,
                newp: *const u8,
                newlen: usize,
            ) -> i32;
        }
        unsafe {
            let host = mach_host_self();
            let mut stats = mem::zeroed::<vm_statistics64>();
            let mut count = mem::size_of::<vm_statistics64>() as u32 / 4;
            if host_statistics64(
                host,
                HOST_VM_INFO64,
                &mut stats as *mut _ as *mut u32,
                &mut count,
            ) != 0
            {
                return None;
            }
            let mut total_mem: u64 = 0;
            let mut size = mem::size_of::<u64>();
            let name = b"hw.memsize\0";
            if sysctlbyname(
                name.as_ptr() as *const i8,
                &mut total_mem as *mut u64 as *mut std::ffi::c_void,
                &mut size,
                std::ptr::null(),
                0,
            ) != 0
            {
                return None;
            }
            if total_mem == 0 {
                return None;
            }
            let page_size: u64 = 4096;
            // free + inactive + speculative are reclaimable on macOS
            let available = (stats._free_count + stats._inactive_count
                + stats._speculative_count) as u64 * page_size;
            Some(((total_mem - available) as f64 / total_mem as f64 * 100.0).clamp(0.0, 100.0))
        }
    }

    // ─── Network ─────────────────────────────────────────────

    fn collect_network(&mut self) -> Option<NetworkSpeed> {
        let (rx, tx) = self.read_net_bytes()?;
        let now = Instant::now();

        if let Some(prev) = self.prev_net.take() {
            let elapsed = now.duration_since(prev.time).as_secs_f64();
            self.prev_net = Some(NetSnapshot { rx, tx, time: now });
            if elapsed < 0.001 {
                return Some(NetworkSpeed { upload: 0.0, download: 0.0 });
            }
            // Handle 32-bit counter overflow: a lower new value means the counter wrapped around
            let rx_delta = if rx >= prev.rx {
                rx - prev.rx
            } else {
                (u32::MAX as u64 - prev.rx) + rx + 1
            };
            let tx_delta = if tx >= prev.tx {
                tx - prev.tx
            } else {
                (u32::MAX as u64 - prev.tx) + tx + 1
            };
            Some(NetworkSpeed {
                upload: (tx_delta as f64 / elapsed / 1024.0).max(0.0),
                download: (rx_delta as f64 / elapsed / 1024.0).max(0.0),
            })
        } else {
            self.prev_net = Some(NetSnapshot { rx, tx, time: now });
            None
        }
    }

    #[cfg(target_os = "windows")]
    fn read_net_bytes(&self) -> Option<(u64, u64)> {
        #[repr(C)]
        struct MIB_IFROW {
            _name: [u16; 256],
            _index: u32,
            _type: u32,
            _mtu: u32,
            _speed: u32,
            _physlen: u32,
            _physaddr: [u8; 8],
            _admin: u32,
            oper_status: u32,
            _lastchange: u32,
            in_octets: u32,
            _in_ucast: u32,
            _in_nucast: u32,
            _in_discard: u32,
            _in_err: u32,
            _in_unk: u32,
            out_octets: u32,
            _out_ucast: u32,
            _out_nucast: u32,
            _out_discard: u32,
            _out_err: u32,
            _out_qlen: u32,
            _desclen: u32,
            _desc: [u8; 256],
        }
        const IF_OPER_STATUS_UP: u32 = 1;
        #[link(name = "iphlpapi")]
        extern "system" {
            fn GetIfTable(pIfTable: *mut u8, pdwSize: *mut u32, bOrder: i32) -> u32;
        }
        unsafe {
            let mut size: u32 = 0;
            GetIfTable(std::ptr::null_mut(), &mut size, 0);
            if size == 0 {
                return None;
            }
            let mut buf = vec![0u8; size as usize];
            if GetIfTable(buf.as_mut_ptr(), &mut size, 0) != 0 {
                return None;
            }
            let num = *(buf.as_ptr() as *const u32) as usize;
            let row_size = std::mem::size_of::<MIB_IFROW>();
            let base = buf.as_ptr().add(4);
            let mut rx: u64 = 0;
            let mut tx: u64 = 0;
            for i in 0..num {
                let row = &*(base.add(i * row_size) as *const MIB_IFROW);
                if row.oper_status == IF_OPER_STATUS_UP {
                    rx += row.in_octets as u64;
                    tx += row.out_octets as u64;
                }
            }
            Some((rx, tx))
        }
    }

    #[cfg(target_os = "linux")]
    fn read_net_bytes(&self) -> Option<(u64, u64)> {
        let text = std::fs::read_to_string("/proc/net/dev").ok()?;
        let mut rx: u64 = 0;
        let mut tx: u64 = 0;
        for line in text.lines().skip(2) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 10 {
                continue;
            }
            let iface = parts[0].trim_end_matches(':');
            if iface == "lo" {
                continue;
            }
            rx += parts[1].parse::<u64>().unwrap_or(0);
            tx += parts[9].parse::<u64>().unwrap_or(0);
        }
        Some((rx, tx))
    }

    #[cfg(target_os = "macos")]
    fn read_net_bytes(&self) -> Option<(u64, u64)> {
        use std::ptr;
        #[repr(C)]
        struct ifaddrs {
            ifa_next: *mut ifaddrs,
            ifa_name: *const i8,
            ifa_flags: u32,
            ifa_addr: *mut u8,
            ifa_netmask: *mut u8,
            ifa_dstaddr: *mut u8,
            ifa_data: *mut u8,
        }
        #[repr(C)]
        struct if_data {
            ifi_type: u8,
            ifi_typelen: u8,
            ifi_physical: u8,
            ifi_addrlen: u8,
            ifi_hdrlen: u8,
            ifi_recvquota: u8,
            _xmit_quota: u8,
            _unused1: u8,
            ifi_mtu: u32,
            ifi_metric: u32,
            ifi_baudrate: u64,
            ifi_ipackets: u64,
            ifi_ierrors: u64,
            ifi_opackets: u64,
            ifi_oerrors: u64,
            ifi_collisions: u64,
            ifi_ibytes: u64,
            ifi_obytes: u64,
            _imcasts: u64,
            _omcasts: u64,
            _iqdrops: u64,
            _noproto: u64,
            _recvchange: u32,
            _xmitchange: u32,
            _lastchange: u32,
        }
        extern "C" {
            fn getifaddrs(ifap: *mut *mut ifaddrs) -> i32;
            fn freeifaddrs(ifp: *mut ifaddrs);
        }
        unsafe {
            let mut ifap: *mut ifaddrs = ptr::null_mut();
            if getifaddrs(&mut ifap) != 0 {
                return None;
            }
            let mut rx: u64 = 0;
            let mut tx: u64 = 0;
            let mut cur = ifap;
            while !cur.is_null() {
                let entry = &*cur;
                let name = std::ffi::CStr::from_ptr(entry.ifa_name)
                    .to_string_lossy()
                    .to_string();
                if name != "lo0" && !entry.ifa_data.is_null() {
                    let data = &*(entry.ifa_data as *const if_data);
                    rx += data.ifi_ibytes;
                    tx += data.ifi_obytes;
                }
                cur = entry.ifa_next;
            }
            freeifaddrs(ifap);
            Some((rx, tx))
        }
    }

    // ─── Disk ────────────────────────────────────────────────

    #[cfg(target_os = "windows")]
    fn collect_disk(&self) -> Option<f64> {
        #[link(name = "kernel32")]
        extern "system" {
            fn GetDiskFreeSpaceExW(
                lpRootPathName: *const u16,
                _lpFreeBytesAvailableToCaller: *mut u64,
                lpTotalNumberOfBytes: *mut u64,
                lpTotalNumberOfFreeBytes: *mut u64,
            ) -> i32;
        }
        let root: Vec<u16> = "C:\\".encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            let mut total: u64 = 0;
            let mut free: u64 = 0;
            if GetDiskFreeSpaceExW(root.as_ptr(), std::ptr::null_mut(), &mut total, &mut free) == 0 {
                return None;
            }
            if total == 0 {
                return Some(0.0);
            }
            Some(((total - free) as f64 / total as f64 * 100.0).clamp(0.0, 100.0))
        }
    }

    #[cfg(target_os = "linux")]
    fn collect_disk(&self) -> Option<f64> {
        use std::mem;
        #[repr(C)]
        struct statvfs {
            f_bsize: u64,
            f_frsize: u64,
            _f_blocks: u64,
            f_bfree: u64,
            f_bavail: u64,
            _f_files: u64,
            _f_ffree: u64,
            _f_favail: u64,
            _f_fsid: u64,
            _f_flag: u64,
            _f_namemax: u64,
            _pad: [i32; 6],
        }
        extern "C" {
            fn statvfs(path: *const i8, buf: *mut statvfs) -> i32;
        }
        let path = b"/\0";
        unsafe {
            let mut s: statvfs = mem::zeroed();
            if statvfs(path.as_ptr() as *const i8, &mut s) != 0 {
                return None;
            }
            let total = s._f_blocks;
            let free = s.f_bavail;
            if total == 0 {
                return Some(0.0);
            }
            Some(((total - free) as f64 / total as f64 * 100.0).clamp(0.0, 100.0))
        }
    }

    #[cfg(target_os = "macos")]
    fn collect_disk(&self) -> Option<f64> {
        // macOS has statvfs in libc, same approach as Linux
        self.collect_disk_linux_compat()
    }

    #[allow(dead_code)]
    fn collect_disk_linux_compat(&self) -> Option<f64> {
        use std::mem;
        #[repr(C)]
        struct statvfs {
            f_bsize: u64,
            f_frsize: u64,
            f_blocks: u64,
            f_bfree: u64,
            f_bavail: u64,
            _f_files: u64,
            _f_ffree: u64,
            _f_favail: u64,
            _f_fsid: u64,
            _f_flag: u64,
            _f_namemax: u64,
        }
        extern "C" {
            fn statvfs(path: *const i8, buf: *mut statvfs) -> i32;
        }
        let path = b"/\0";
        unsafe {
            let mut s: statvfs = mem::zeroed();
            if statvfs(path.as_ptr() as *const i8, &mut s) != 0 {
                return None;
            }
            if s.f_blocks == 0 {
                return Some(0.0);
            }
            Some(((s.f_blocks - s.f_bavail) as f64 / s.f_blocks as f64 * 100.0).clamp(0.0, 100.0))
        }
    }

    // ─── Uptime ──────────────────────────────────────────────

    #[cfg(target_os = "windows")]
    fn collect_uptime(&self) -> Option<u64> {
        #[link(name = "kernel32")]
        extern "system" {
            fn GetTickCount64() -> u64;
        }
        unsafe { Some(GetTickCount64() / 1000) }
    }

    #[cfg(target_os = "linux")]
    fn collect_uptime(&self) -> Option<u64> {
        let text = std::fs::read_to_string("/proc/uptime").ok()?;
        let secs: f64 = text.split_whitespace().next()?.parse().ok()?;
        Some(secs as u64)
    }

    #[cfg(target_os = "macos")]
    fn collect_uptime(&self) -> Option<u64> {
        use std::mem;
        #[repr(C)]
        struct timeval {
            tv_sec: i64,
            tv_usec: i64,
        }
        extern "C" {
            fn sysctlbyname(
                name: *const i8,
                oldp: *mut std::ffi::c_void,
                oldlenp: *mut usize,
                newp: *const u8,
                newlen: usize,
            ) -> i32;
            fn time(t: *mut i64) -> i64;
        }
        unsafe {
            let mut boot: timeval = mem::zeroed();
            let mut size = mem::size_of::<timeval>();
            let name = b"kern.boottime\0";
            if sysctlbyname(
                name.as_ptr() as *const i8,
                &mut boot as *mut timeval as *mut std::ffi::c_void,
                &mut size,
                std::ptr::null(),
                0,
            ) != 0
            {
                return None;
            }
            let now = time(std::ptr::null_mut());
            Some((now - boot.tv_sec) as u64)
        }
    }


    // ─── Battery ────────────────────────────────────────────

    #[cfg(target_os = "windows")]
    fn collect_battery(&self) -> Option<BatteryInfo> {
        #[repr(C)]
        struct SYSTEM_POWER_STATUS {
            ACLineStatus: u8,
            BatteryFlag: u8,
            BatteryLifePercent: u8,
            _reserved: u8,
            BatteryLifeTime: u32,
            BatteryFullLifeTime: u32,
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn GetSystemPowerStatus(lpStatus: *mut SYSTEM_POWER_STATUS) -> i32;
        }
        unsafe {
            let mut status = SYSTEM_POWER_STATUS {
                ACLineStatus: 255,
                BatteryFlag: 255,
                BatteryLifePercent: 255,
                _reserved: 0,
                BatteryLifeTime: 0,
                BatteryFullLifeTime: 0,
            };
            if GetSystemPowerStatus(&mut status) == 0 {
                return None;
            }
            if status.BatteryLifePercent == 255 {
                return None;
            }
            Some(BatteryInfo {
                level: status.BatteryLifePercent as f64,
                charging: Some(status.ACLineStatus == 1),
                temperature: None,
            })
        }
    }

    #[cfg(target_os = "linux")]
    fn collect_battery(&self) -> Option<BatteryInfo> {
        let base = std::path::Path::new("/sys/class/power_supply");
        let mut level: Option<f64> = None;
        let mut charging: Option<bool> = None;
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                if !name.starts_with("BAT") {
                    continue;
                }
                let dir = entry.path();
                let cap_path = dir.join("capacity");
                if let Ok(cap_str) = std::fs::read_to_string(&cap_path) {
                    if let Ok(cap) = cap_str.trim().parse::<f64>() {
                        level = Some(cap);
                    }
                }
                let status_path = dir.join("status");
                if let Ok(status_str) = std::fs::read_to_string(&status_path) {
                    let s = status_str.trim();
                    charging = Some(s == "Charging");
                }
                break;
            }
        }
        level.map(|lvl| BatteryInfo {
            level: lvl,
            charging,
            temperature: None,
        })
    }

    #[cfg(target_os = "macos")]
    fn collect_battery(&self) -> Option<BatteryInfo> {
        // IOKit IOPowerSources — the standard Apple API for battery info.
        // Linked against IOKit + CoreFoundation system frameworks.
        #[link(name = "IOKit", kind = "framework")]
        #[link(name = "CoreFoundation", kind = "framework")]
        extern "C" {
            fn IOPSCopyPowerSourcesInfo() -> *mut std::ffi::c_void;
            fn IOPSCopyPowerSourcesList(
                info: *mut std::ffi::c_void,
            ) -> *mut std::ffi::c_void;
            fn IOPSGetPowerSourceDescription(
                info: *mut std::ffi::c_void,
                ps: *mut std::ffi::c_void,
            ) -> *mut std::ffi::c_void;
            fn CFArrayGetCount(array: *mut std::ffi::c_void) -> isize;
            fn CFArrayGetValueAtIndex(
                array: *mut std::ffi::c_void,
                idx: isize,
            ) -> *mut std::ffi::c_void;
            fn CFDictionaryGetValue(
                dict: *mut std::ffi::c_void,
                key: *const std::ffi::c_void,
            ) -> *mut std::ffi::c_void;
            fn CFNumberGetValue(
                num: *mut std::ffi::c_void,
                the_type: u32,
                value_ptr: *mut std::ffi::c_void,
            ) -> bool;
            fn CFBooleanGetValue(boolean: *mut std::ffi::c_void) -> bool;
            fn CFStringCreateWithCString(
                alloc: *mut std::ffi::c_void,
                cstr: *const i8,
                encoding: u32,
            ) -> *mut std::ffi::c_void;
            fn CFRelease(cf: *mut std::ffi::c_void);
        }

        // kCFNumberSInt32 = 3, kCFStringEncodingUTF8 = 0x08001000
        const SINT32: u32 = 3;
        const UTF8: u32 = 0x08001000;

        unsafe {
            let info = IOPSCopyPowerSourcesInfo();
            if info.is_null() {
                return None;
            }
            let list = IOPSCopyPowerSourcesList(info);
            if list.is_null() {
                CFRelease(info);
                return None;
            }
            let count = CFArrayGetCount(list);
            if count == 0 {
                CFRelease(list);
                CFRelease(info);
                return None;
            }

            // grab the first power source (internal battery)
            let ps = CFArrayGetValueAtIndex(list, 0);
            let desc = IOPSGetPowerSourceDescription(info, ps);
            if desc.is_null() {
                CFRelease(list);
                CFRelease(info);
                return None;
            }

            let k_current = b"Current Capacity\0";
            let k_max = b"Max Capacity\0";
            let k_charging = b"Is Charging\0";

            let kc = CFStringCreateWithCString(
                std::ptr::null_mut(),
                k_current.as_ptr() as *const i8,
                UTF8,
            );
            let km = CFStringCreateWithCString(
                std::ptr::null_mut(),
                k_max.as_ptr() as *const i8,
                UTF8,
            );
            let kch = CFStringCreateWithCString(
                std::ptr::null_mut(),
                k_charging.as_ptr() as *const i8,
                UTF8,
            );

            let mut current: i32 = 0;
            let mut max: i32 = 0;
            let mut charging = false;

            let cur_val = CFDictionaryGetValue(desc, kc);
            if !cur_val.is_null() {
                CFNumberGetValue(
                    cur_val,
                    SINT32,
                    &mut current as *mut _ as *mut _,
                );
            }
            let max_val = CFDictionaryGetValue(desc, km);
            if !max_val.is_null() {
                CFNumberGetValue(
                    max_val,
                    SINT32,
                    &mut max as *mut _ as *mut _,
                );
            }
            let chg_val = CFDictionaryGetValue(desc, kch);
            if !chg_val.is_null() {
                charging = CFBooleanGetValue(chg_val);
            }

            CFRelease(kc);
            CFRelease(km);
            CFRelease(kch);
            CFRelease(list);
            CFRelease(info);

            if max == 0 {
                return None;
            }
            let level = (current as f64 / max as f64 * 100.0).clamp(0.0, 100.0);
            Some(BatteryInfo {
                level,
                charging: Some(charging),
                temperature: None,
            })
        }
    }
}
