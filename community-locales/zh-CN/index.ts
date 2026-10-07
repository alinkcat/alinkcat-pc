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

// all modules merged into the top level, using a single common namespace
// t('editor.foo') / t('push.bar') resolved by dot path
// common.json expanded to the top level，so t('versionGate.titleUpdate') / t('noData') directly available
// also keeps the common key for legacy t('common.x') call
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