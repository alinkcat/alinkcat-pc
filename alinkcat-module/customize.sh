#!/system/bin/sh
# alinkcat module installer
# works with Magisk / KernelSU / APatch

SKIPUNZIP=0
MODPATH="${0%/*}"

ui_print "================================"
ui_print " 艾联猫 Root 扩展模块"
ui_print "================================"

# detect the framework
if [ "$KSU" = "true" ]; then
  ui_print "- 检测到 KernelSU"
  MODPATH="/data/adb/modules/alinkcat_module"
elif [ "$MAGISK_VER_CODE" ]; then
  ui_print "- 检测到 Magisk v$MAGISK_VER_CODE"
else
  ui_print "- 检测到其他 root 框架"
fi

# deps
command -v su >/dev/null 2>&1 || { ui_print "! 未检测到 su"; exit 1; }

# install scripts into the module dir
ui_print "- 安装模块脚本..."
mkdir -p "$MODPATH/scripts" "$MODPATH/bin" "$MODPATH/config"
cp -f "$MODPATH/scripts/shell/"* "$MODPATH/scripts/" 2>/dev/null || true

# exec permissions
chmod 0755 "$MODPATH/bin/alnkcat_helper" 2>/dev/null || true
chmod 0755 "$MODPATH/scripts/"*.sh 2>/dev/null || true

# default config
if [ ! -f "$MODPATH/config/module.conf" ]; then
  ui_print "- 生成默认配置"
  sed -i 's/SECRET=.*/SECRET=alinkcat_\$RANDOM\$RANDOM/' "$MODPATH/config/module.conf.example" 2>/dev/null
  cp -f "$MODPATH/config/module.conf.example" "$MODPATH/config/module.conf" 2>/dev/null || true
fi

ui_print "- 安装完成"
ui_print "================================="