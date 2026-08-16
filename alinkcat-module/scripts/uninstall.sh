#!/system/bin/sh
# 艾联猫模块 - 卸载清理脚本

MODDIR=${0%/*}

# 停止守护进程
kill $(pgrep -f alnkcat_helper) 2>/dev/null || true

# 清理守护标记
rm -f "$MODDIR/.daemon_running" 2>/dev/null

# 清理 App 侧生成的数据
rm -rf /data/local/tmp/alinkcat_module 2>/dev/null
rm -f /data/adb/service.d/alinkcat-module.sh 2>/dev/null

ui_print "- 艾联猫模块已卸载"