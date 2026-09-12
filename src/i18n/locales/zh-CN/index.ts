import common from './common.json';
import layout from './layout.json';
import settings from './settings.json';
import editor from './editor.json';
import push from './push.json';
import devices from './devices.json';
import auth from './auth.json';
import themes from './themes.json';
import profile from './profile.json';
import market from './market.json';
import admin from './admin.json';
import upload from './upload.json';
import snippets from './snippets.json';
import notifications from './notifications.json';
import tickets from './tickets.json';
import terms from './terms.json';
import member from './member.json';
import cloud from './cloud.json';
import points from './points.json';
import invite from './invite.json';
import onboarding from './onboarding.json';

// 所有模块合并进顶层，仅使用一个 common 命名空间
// t('editor.foo') / t('push.bar') 等按点路径直接解析
// common.json 展开到顶层，使 t('versionGate.titleUpdate') / t('noData') 等直接可用
// 同时保留 common 键兼容旧式 t('common.x') 调用
export default {
  ...common,
  common,
  layout,
  settings,
  editor,
  push,
  devices,
  auth,
  themes,
  profile,
  market,
  admin,
  upload,
  snippets,
  notifications,
  tickets,
  terms,
  member,
  cloud,
  points,
  invite,
  onboarding,
} as Record<string, unknown>;