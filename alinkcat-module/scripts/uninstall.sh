#!/system/bin/sh
# alinkcat module - uninstall cleanup

MODDIR=${0%/*}

# stop the daemon
kill $(pgrep -f alnkcat_helper) 2>/dev/null || true

# remove the daemon marker
rm -f "$MODDIR/.daemon_running" 2>/dev/null

# clean up app-side data
rm -rf /data/local/tmp/alinkcat_module 2>/dev/null
rm -f /data/adb/service.d/alinkcat-module.sh 2>/dev/null

ui_print "- 艾联猫模块已卸载"