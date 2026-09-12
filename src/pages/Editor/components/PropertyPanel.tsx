import { useTranslation } from 'react-i18next';
import { Form, Input, Select, InputNumber, Tag, Button, Slider, Radio, Switch } from 'antd';
import { message } from '../../../utils/message';
import { PlusOutlined, DeleteOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useEditorStore } from '../store/editorStore';
import type { SnippetItem } from '../types';
import PageManager from './PageManager';
import { Typography } from 'antd';
import { tauriInvoke } from '../../../utils/tauri';

const { Text } = Typography;

// ─── 天气组件：自建天气 API 默认配置兜底（免登录，X-API-Key 鉴权，Key 由 Android 端注入） ─
// 后端接口规范：GET /api/public/weather?q=${city}&f=wttr（Android 定位时替换为 ?g=lng,lat&f=wttr）
// 返回 wttr.in j1 格式（current_condition[].temp_C、weatherDesc 等），渲染逻辑不变
const OWM_URL = 'https://www.pynen.com/api/public/weather?q=${city}&f=wttr';
const OWM_MAPPING: Record<string, string> = {
  city: 'nearest_area[0].areaName[0].value',
  temp: 'current_condition[0].temp_C',
  condition: 'current_condition[0].weatherDesc[0].value',
  description: 'current_condition[0].weatherDesc[0].value',
  icon: 'current_condition[0].weatherCode',
  humidity: 'current_condition[0].humidity',
  wind_speed: 'current_condition[0].windspeedKmph',
  feels_like: 'current_condition[0].FeelsLikeC',
  forecast: 'weather',
};

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <Input size="small" value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }} />
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: 'none', cursor: 'pointer', background: 'transparent', padding: 0 }} />
    </div>
  );
}

function SnippetEditor({ value, onChange }: { value?: SnippetItem[]; onChange?: (v: SnippetItem[]) => void }) {
  const { t } = useTranslation();
  const items = value || [];
  return (
    <div className="pp-snippet-editor">
      {items.map((item, idx) => (
        <div key={item.id} className="pp-snippet-row">
          <Input size="small" placeholder={t('editor.propertyPanel.snippet.label')} value={item.label} style={{ width: 80 }}
            onChange={e => onChange?.(items.map((s, i) => i === idx ? { ...s, label: e.target.value } : s))} />
          <Input size="small" placeholder={t('editor.propertyPanel.snippet.content')} value={item.content}
            onChange={e => onChange?.(items.map((s, i) => i === idx ? { ...s, content: e.target.value } : s))} />
          <Button size="small" type="text" danger icon={<DeleteOutlined />}
            onClick={() => onChange?.(items.filter((_, i) => i !== idx))} />
        </div>
      ))}
      <Button size="small" type="dashed" icon={<PlusOutlined />} block
        onClick={() => onChange?.([...items, { id: `s-${Date.now()}`, label: '', content: '' }])}>{t('editor.propertyPanel.snippet.addItem')}</Button>
    </div>
  );
}

function CommonStyleFields({ widget, up }: { widget: Record<string, unknown>; up: (k: string, v: unknown) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
      <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.common.style')}</Text>
      <Form.Item label={t('editor.propertyPanel.common.backgroundColor')} style={{ marginBottom: 8 }}>
        <ColorInput value={(widget.backgroundColor as string) || '#f0f2f5'} onChange={v => up('backgroundColor', v)} />
      </Form.Item>
      <Form.Item label={t('editor.propertyPanel.common.backgroundOpacity')} style={{ marginBottom: 8 }}>
        <Slider min={0} max={100} value={(widget.backgroundOpacity as number) ?? 100} onChange={v => up('backgroundOpacity', v)} />
      </Form.Item>
      <Form.Item label={t('editor.propertyPanel.common.borderRadius')} style={{ marginBottom: 8 }}>
        <Slider min={0} max={20} value={(widget.borderRadius as number) ?? 6} onChange={v => up('borderRadius', v)} />
      </Form.Item>
      <Form.Item label={t('editor.propertyPanel.common.textColor')} style={{ marginBottom: 8 }}>
        <ColorInput value={(widget.textColor as string) || '#333333'} onChange={v => up('textColor', v)} />
      </Form.Item>
      <Form.Item label={t('editor.propertyPanel.common.fontSize')} style={{ marginBottom: 8 }}>
        <Slider min={12} max={48} value={(widget.fontSize as number) ?? 12} onChange={v => up('fontSize', v)} />
      </Form.Item>
      <Form.Item label={t('editor.propertyPanel.common.fontWeight')} style={{ marginBottom: 0 }}>
        <Select value={(widget.fontWeight as string) || 'normal'} onChange={v => up('fontWeight', v)}
          options={[
            { label: t('editor.propertyPanel.common.fontWeightNormal'), value: 'normal' },
            { label: t('editor.propertyPanel.common.fontWeightBold'), value: 'bold' },
            { label: t('editor.propertyPanel.common.fontWeightBolder'), value: 'bolder' },
          ]} />
      </Form.Item>
    </div>
  );
}


function ActionConfigFields({ widget, up, pageOptions }: { widget: Record<string, unknown>; up: (k: string, v: unknown) => void; pageOptions?: { label: string; value: string }[] }) {
  const { t } = useTranslation();
  const { theme } = useEditorStore();
  const action = (widget.clickAction as Record<string, unknown>) || {};
  const actionType = (action.type as string) || 'none';

  const allPageOptions = pageOptions || theme.pages.map((p, i) => ({ label: p.label || t('editor.propertyPanel.actionConfig.switchPage'), value: String(i) }));

  return (
    <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
      <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.actionConfig.section')}</Text>
      <Form.Item label={t('editor.propertyPanel.actionConfig.actionType')} style={{ marginBottom: 8 }}>
        <Select value={actionType} onChange={val => up('clickAction', { type: val })}
          options={[
            { label: t('editor.propertyPanel.actionConfig.none'), value: 'none' },
            { label: t('editor.propertyPanel.actionConfig.openLink'), value: 'url' },
            { label: t('editor.propertyPanel.actionConfig.switchPage'), value: 'switch_page' },
          ]} />
      </Form.Item>
      {actionType === 'url' && (
        <Form.Item label={t('editor.propertyPanel.actionConfig.url')} style={{ marginBottom: 8 }}>
          <Input value={(action.url as string) || ''} onChange={e => up('clickAction', { ...action, url: e.target.value })} placeholder={t('editor.propertyPanel.actionConfig.urlPlaceholder')} />
        </Form.Item>
      )}
      {actionType === 'switch_page' && (
        <Form.Item label={t('editor.propertyPanel.actionConfig.targetPage')} style={{ marginBottom: 8 }}>
          <Select value={(action.targetPage as string) || ''} onChange={val => up('clickAction', { ...action, targetPage: val })}
            options={allPageOptions} />
        </Form.Item>
      )}
    </div>
  );
}

function PageProperties() {
  const { t } = useTranslation();
  const { theme, activePageIdx, updatePage } = useEditorStore();
  const page = theme.pages[activePageIdx];
  if (!page) return <Text style={{ color: '#888', fontSize: 12 }}>{t('editor.propertyPanel.page.noPage')}</Text>;

  const handleBgUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => updatePage(activePageIdx, { backgroundImage: reader.result as string });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <Form layout="vertical" size="small">
      <Form.Item label={t('editor.propertyPanel.page.pageName')}><Input value={page.label} onChange={e => updatePage(activePageIdx, { label: e.target.value })} /></Form.Item>
      <Form.Item label={t('editor.propertyPanel.page.layoutMode')}>
        <Select value={page.layoutMode} onChange={v => updatePage(activePageIdx, { layoutMode: v })}
          options={[{ label: t('editor.propertyPanel.page.gridLayout'), value: 'grid' }, { label: t('editor.propertyPanel.page.freeLayout'), value: 'free' }]} />
      </Form.Item>
      {page.layoutMode === 'grid' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item label={t('editor.propertyPanel.page.columns')}><InputNumber value={page.columns} min={2} max={8} onChange={v => updatePage(activePageIdx, { columns: v ?? 4 })} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.page.rows')}><InputNumber value={page.rows} min={1} max={10} onChange={v => updatePage(activePageIdx, { rows: v ?? 6 })} /></Form.Item>
        </div>
      )}
      {page.layoutMode === 'free' && (
        <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 8 }}>
          {t('editor.propertyPanel.page.freeLayoutDesc')}
        </Text>
      )}
      <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.page.pageBackground')}</Text>
        <Form.Item label={t('editor.propertyPanel.page.backgroundColor')} style={{ marginBottom: 8 }}>
          <ColorInput value={page.backgroundColor || '#ffffff'} onChange={v => updatePage(activePageIdx, { backgroundColor: v })} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.page.backgroundImage')} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button size="small" onClick={handleBgUpload}>{t('editor.propertyPanel.page.upload')}</Button>
            {page.backgroundImage && <>
              <Tag color="blue">{t('editor.propertyPanel.page.set')}</Tag>
              <Button size="small" type="link" danger onClick={() => updatePage(activePageIdx, { backgroundImage: undefined })}>{t('editor.propertyPanel.page.clear')}</Button>
            </>}
          </div>
        </Form.Item>
        {page.backgroundImage && (<>
          <Form.Item label={t('editor.propertyPanel.page.backgroundMode')} style={{ marginBottom: 8 }}>
            <Select value={page.backgroundMode || 'cover'} onChange={v => updatePage(activePageIdx, { backgroundMode: v })}
              options={[
                { label: t('editor.propertyPanel.page.modeCover'), value: 'cover' },
                { label: t('editor.propertyPanel.page.modeContain'), value: 'contain' },
                { label: t('editor.propertyPanel.page.modeStretch'), value: 'stretch' },
                { label: t('editor.propertyPanel.page.modeRepeat'), value: 'repeat' },
              ]} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.page.opacity')} style={{ marginBottom: 0 }}>
            <Slider min={0} max={100} value={page.backgroundOpacity ?? 100} onChange={v => updatePage(activePageIdx, { backgroundOpacity: v })} />
          </Form.Item>
        </>)}
      </div>
    </Form>
  );
}


function WidgetProperties() {
  const { t } = useTranslation();
  const { theme, activePageIdx, selectedWidgetId, updateWidget, bringToFront, sendToBack, moveUp, moveDown } = useEditorStore();
  const page = theme.pages[activePageIdx];
  const widget = page?.widgets.find(w => w.id === selectedWidgetId);
  if (!widget || !selectedWidgetId) return null;
  const v = widget as Record<string, unknown>;
  const up = (key: string, val: unknown) => updateWidget(selectedWidgetId, { [key]: val });
  const isGrid = page!.layoutMode === 'grid';

  /** 切换预设模板：选择天气时自动填充常用默认值（URL / 映射），用户只需再填城市与 Key */
  const applyPreset = (val: string) => {
    up('preset', val);
    if (val === 'weather') {
      if (!(v.requestUrl as string)) up('requestUrl', OWM_URL);
      if (!(v.requestMethod as string)) up('requestMethod', 'GET');
      if (!v.requestHeaders) up('requestHeaders', {});
      if (!v.extraParams) up('extraParams', {});
      if (!(v.unit as string)) up('unit', 'c');
      if ((v.refreshHours as number) == null) up('refreshHours', 1);
      if (!(v.responseMapping && Object.keys(v.responseMapping as Record<string, string>).length)) up('responseMapping', { ...OWM_MAPPING });
    }
  };

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => up('src', reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleCardImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => up('cardImage', reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <Form layout="vertical" size="small">
      <Form.Item label={t('editor.propertyPanel.widget.type')}><Tag color="blue">{t(`editor.controlLibrary.${widget.type}`) || t('editor.propertyPanel.widget.unknown')}</Tag></Form.Item>
      <Form.Item label={t('editor.propertyPanel.widget.label')}><Input value={widget.label} onChange={e => up('label', e.target.value)} /></Form.Item>

      {isGrid ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Form.Item label={t('editor.propertyPanel.widget.gridCol')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridCol} min={0} max={page!.columns - 1} size="small" style={{ width: '100%' }} onChange={v => up('gridCol', v ?? 0)} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.widget.gridRow')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridRow} min={0} max={page!.rows - 1} size="small" style={{ width: '100%' }} onChange={v => up('gridRow', v ?? 0)} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.widget.gridW')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridW} min={1} max={page!.columns} size="small" style={{ width: '100%' }} onChange={v => up('gridW', v ?? 1)} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.widget.gridH')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridH} min={1} max={page!.rows} size="small" style={{ width: '100%' }} onChange={v => up('gridH', v ?? 1)} /></Form.Item>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Form.Item label={t('editor.propertyPanel.widget.freeX')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeX ?? 0)} min={0} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeX', v ?? 0)} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.widget.freeY')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeY ?? 0)} min={0} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeY', v ?? 0)} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.widget.freeW')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeW ?? 30)} min={5} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeW', v ?? 30)} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.widget.freeH')} style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeH ?? 15)} min={5} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeH', v ?? 15)} /></Form.Item>
        </div>
      )}

      {/* Z-Order 层级控制（仅自由模式） */}
      {!isGrid && (
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.zOrder.section')}</Text>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="small" icon={<VerticalAlignTopOutlined />} onClick={() => bringToFront(selectedWidgetId)} title={t('editor.propertyPanel.zOrder.bringToFront')} />
            <Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={() => sendToBack(selectedWidgetId)} title={t('editor.propertyPanel.zOrder.sendToBack')} />
            <Button size="small" icon={<ArrowUpOutlined />} onClick={() => moveUp(selectedWidgetId)} title={t('editor.propertyPanel.zOrder.moveUp')} />
            <Button size="small" icon={<ArrowDownOutlined />} onClick={() => moveDown(selectedWidgetId)} title={t('editor.propertyPanel.zOrder.moveDown')} />
          </div>
        </div>
      )}

      <CommonStyleFields widget={v} up={up} />

      {widget.type === 'button' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.button.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.button.icon')}><Input value={(v.icon as string) || ''} onChange={e => up('icon', e.target.value)} style={{ width: 80 }} /></Form.Item>
        <Form.Item label={t('editor.propertyPanel.button.actionType')}>
          <Select value={(v.action as Record<string, unknown>)?.type as string || 'keyboard'}
            onChange={val => up('action', { type: val, keys: [], path: '', url: '', targetPage: '', script: '', command: '', args: [] })}
            options={[
              { label: t('editor.propertyPanel.button.keyboard'), value: 'keyboard' },
              { label: t('editor.propertyPanel.button.openApp'), value: 'open' },
              { label: t('editor.propertyPanel.button.openUrl'), value: 'url' },
              { label: t('editor.propertyPanel.button.executeScript'), value: 'script' },
              { label: t('editor.propertyPanel.button.switchPage'), value: 'switch_page' },
              { label: t('editor.propertyPanel.button.systemCommand'), value: 'command' },
            ]} />
        </Form.Item>
        {((v.action as Record<string, unknown>)?.type === 'keyboard') && (
          <Form.Item label={t('editor.propertyPanel.button.keys')}><Input value={((v.action as Record<string, unknown>)?.keys as string[])?.join(',') || ''}
            onChange={e => up('action', { ...(v.action as Record<string, unknown>), keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={t('editor.propertyPanel.actionConfig.keysPlaceholder')} /></Form.Item>
        )}
        {((v.action as Record<string, unknown>)?.type === 'open') && (
          <Form.Item label={t('editor.propertyPanel.button.path')}><Input value={(v.action as Record<string, unknown>)?.path as string || ''}
            onChange={e => up('action', { ...(v.action as Record<string, unknown>), path: e.target.value })} placeholder={t('editor.propertyPanel.actionConfig.pathPlaceholder')} /></Form.Item>
        )}
        {((v.action as Record<string, unknown>)?.type === 'url') && (
          <Form.Item label={t('editor.propertyPanel.button.urlLabel')}><Input value={(v.action as Record<string, unknown>)?.url as string || ''}
            onChange={e => up('action', { ...(v.action as Record<string, unknown>), url: e.target.value })} placeholder={t('editor.propertyPanel.actionConfig.urlPlaceholder')} /></Form.Item>
        )}
        {((v.action as Record<string, unknown>)?.type === 'script') && (
          <Form.Item label={t('editor.propertyPanel.actionConfig.script')} style={{ marginBottom: 8 }}>
            <Input value={(v.action as Record<string, unknown>)?.script as string || ''}
              onChange={e => up('action', { ...(v.action as Record<string, unknown>), script: e.target.value })} placeholder={t('editor.propertyPanel.actionConfig.scriptPlaceholder')} />
          </Form.Item>
        )}
        {((v.action as Record<string, unknown>)?.type === 'switch_page') && (
          <Form.Item label={t('editor.propertyPanel.actionConfig.targetPage')} style={{ marginBottom: 8 }}>
            <Select value={(v.action as Record<string, unknown>)?.targetPage as string || ''}
              onChange={val => up('action', { ...(v.action as Record<string, unknown>), targetPage: val })}
              options={theme.pages.map((p, i) => ({ label: p.label || String(i), value: String(i) }))} />
          </Form.Item>
        )}
        {((v.action as Record<string, unknown>)?.type === 'command') && (
          <Form.Item label={t('editor.propertyPanel.actionConfig.command')} style={{ marginBottom: 8 }}>
            <Input value={(v.action as Record<string, unknown>)?.command as string || ''}
              onChange={e => up('action', { ...(v.action as Record<string, unknown>), command: e.target.value })} placeholder={t('editor.propertyPanel.actionConfig.commandPlaceholder')} />
          </Form.Item>
        )}
      </>)}

      {widget.type === 'gauge' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.gauge.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.gauge.dataSource')}>
          <Select value={(v.dataSource as string) || 'system.cpu.usage'} onChange={val => up('dataSource', val)}
            options={[
              { label: t('editor.propertyPanel.gauge.cpuUsage'), value: 'system.cpu.usage' },
              { label: t('editor.propertyPanel.gauge.memoryUsage'), value: 'system.memory.usage' },
              { label: t('editor.propertyPanel.gauge.diskUsage'), value: 'system.disk.usage' },
              { label: t('editor.propertyPanel.gauge.networkUpload'), value: 'system.network.upload' },
              { label: t('editor.propertyPanel.gauge.networkDownload'), value: 'system.network.download' },
              { label: t('editor.propertyPanel.gauge.uptime'), value: 'system.uptime' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.gauge.displayStyle')}>
          <Select value={(v.gaugeStyle as string) || 'ring'} onChange={val => up('gaugeStyle', val)}
            options={[
              { label: t('editor.propertyPanel.gauge.ring'), value: 'ring' },
              { label: t('editor.propertyPanel.gauge.number'), value: 'number' },
              { label: t('editor.propertyPanel.gauge.bar'), value: 'bar' },
            ]} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item label={t('editor.propertyPanel.gauge.minValue')} style={{ flex: 1, marginBottom: 8 }}><InputNumber value={(v.minValue as number) ?? 0} style={{ width: '100%' }} onChange={val => up('minValue', val ?? 0)} /></Form.Item>
          <Form.Item label={t('editor.propertyPanel.gauge.maxValue')} style={{ flex: 1, marginBottom: 8 }}><InputNumber value={(v.maxValue as number) ?? 100} style={{ width: '100%' }} onChange={val => up('maxValue', val ?? 100)} /></Form.Item>
        </div>
        <Form.Item label={t('editor.propertyPanel.gauge.unit')}><Input value={(v.unit as string) || ''} onChange={e => up('unit', e.target.value)} style={{ width: 80 }} placeholder="%" /></Form.Item>
        <Form.Item label={t('editor.propertyPanel.gauge.ringWidth')}><Slider min={1} max={6} value={(v.ringWidth as number) ?? 3} onChange={val => up('ringWidth', val)} /></Form.Item>
        <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>{t('editor.propertyPanel.gauge.ringColors')}</Text>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}><Text style={{ fontSize: 10, color: '#888' }}>{t('editor.propertyPanel.gauge.low')}</Text><ColorInput value={(v.ringColorLow as string) || '#52c41a'} onChange={val => up('ringColorLow', val)} /></div>
          <div style={{ flex: 1 }}><Text style={{ fontSize: 10, color: '#888' }}>{t('editor.propertyPanel.gauge.mid')}</Text><ColorInput value={(v.ringColorMid as string) || '#faad14'} onChange={val => up('ringColorMid', val)} /></div>
          <div style={{ flex: 1 }}><Text style={{ fontSize: 10, color: '#888' }}>{t('editor.propertyPanel.gauge.high')}</Text><ColorInput value={(v.ringColorHigh as string) || '#ff4d4f'} onChange={val => up('ringColorHigh', val)} /></div>
        </div>
      </>)}

      {widget.type === 'battery' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.battery.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.battery.style')}>
          <Select value={(v.batteryStyle as string) || 'bar'} onChange={val => up('batteryStyle', val)}
            options={[
              { label: t('editor.propertyPanel.battery.bar'), value: 'bar' },
              { label: t('editor.propertyPanel.battery.ring'), value: 'ring' },
              { label: t('editor.propertyPanel.battery.number'), value: 'number' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.battery.showLevel')} valuePropName="checked">
          <Switch checked={(v.showLevel as boolean) ?? true} onChange={val => up('showLevel', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.battery.showCharging')} valuePropName="checked">
          <Switch checked={(v.showCharging as boolean) ?? true} onChange={val => up('showCharging', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.battery.showTemp')} valuePropName="checked">
          <Switch checked={(v.showTemp as boolean) ?? false} onChange={val => up('showTemp', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.battery.barColor')}>
          <ColorInput value={(v.barColor as string) || '#52c41a'} onChange={val => up('barColor', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.battery.lowColor')}>
          <ColorInput value={(v.lowColor as string) || '#ff4d4f'} onChange={val => up('lowColor', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.battery.lowThreshold')}>
          <Slider min={0} max={50} value={(v.lowThreshold as number) ?? 20} onChange={val => up('lowThreshold', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.battery.dataSource')}>
          <Select value={(v.dataSource as string) || 'system.battery.level'} onChange={val => up('dataSource', val)}
            options={[
              { label: 'system.battery.level', value: 'system.battery.level' },
              { label: t('editor.propertyPanel.gauge.cpuUsage'), value: 'system.cpu.usage' },
              { label: t('editor.propertyPanel.gauge.memoryUsage'), value: 'system.memory.usage' },
              { label: t('editor.propertyPanel.gauge.diskUsage'), value: 'system.disk.usage' },
            ]} />
        </Form.Item>
      </>)}

      {widget.type === 'snippet-list' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.snippet.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.snippet.mode')}>
          <Select value={(v.mode as string) || 'note'} onChange={val => up('mode', val)}
            options={[
              { label: t('editor.propertyPanel.snippet.note'), value: 'note' },
              { label: t('editor.propertyPanel.snippet.snippet'), value: 'snippet' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.snippet.list')}><SnippetEditor value={(v.snippets as SnippetItem[]) || []} onChange={val => up('snippets', val)} /></Form.Item>
      </>)}

      {widget.type === 'image' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.image.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.image.image')}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button size="small" onClick={handleImageUpload}>{t('editor.propertyPanel.image.upload')}</Button>
            {(v.src as string) && <Tag color="blue">{t('editor.propertyPanel.image.set')}</Tag>}
          </div>
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.image.objectFit')}>
          <Select value={(v.objectFit as string) || 'cover'} onChange={val => up('objectFit', val)}
            options={[
              { label: t('editor.propertyPanel.image.cover'), value: 'cover' },
              { label: t('editor.propertyPanel.image.contain'), value: 'contain' },
              { label: t('editor.propertyPanel.image.fill'), value: 'fill' },
            ]} />
        </Form.Item>
        <ActionConfigFields widget={v} up={up} />
      </>)}

      {widget.type === 'text' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.text.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.text.content')}>
          <Input.TextArea value={(v.content as string) || ''} onChange={e => up('content', e.target.value)} rows={3} placeholder={t('editor.propertyPanel.text.contentPlaceholder')} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.fontSize')}>
          <Slider min={12} max={72} value={(v.fontSize as number) ?? 16} onChange={val => up('fontSize', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.fontWeight')}>
          <Select value={(v.fontWeight as string) || 'normal'} onChange={val => up('fontWeight', val)}
            options={[
              { label: t('editor.propertyPanel.text.fontWeightNormal'), value: 'normal' },
              { label: t('editor.propertyPanel.text.fontWeightBold'), value: 'bold' },
              { label: t('editor.propertyPanel.text.fontWeightBolder'), value: 'bolder' },
              { label: t('editor.propertyPanel.text.fontWeightLighter'), value: 'lighter' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.color')}>
          <ColorInput value={(v.color as string) || '#333333'} onChange={val => up('color', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.textAlign')}>
          <Select value={(v.textAlign as string) || 'left'} onChange={val => up('textAlign', val)}
            options={[
              { label: t('editor.propertyPanel.text.alignLeft'), value: 'left' },
              { label: t('editor.propertyPanel.text.alignCenter'), value: 'center' },
              { label: t('editor.propertyPanel.text.alignRight'), value: 'right' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.backgroundColor')}>
          <ColorInput value={(v.backgroundColor as string) || 'transparent'} onChange={val => up('backgroundColor', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.backgroundOpacity')}>
          <Slider min={0} max={100} value={(v.backgroundOpacity as number) ?? 0} onChange={val => up('backgroundOpacity', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.padding')}>
          <Slider min={0} max={20} value={(v.padding as number) ?? 4} onChange={val => up('padding', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.text.borderRadius')}>
          <Slider min={0} max={20} value={(v.borderRadius as number) ?? 0} onChange={val => up('borderRadius', val)} />
        </Form.Item>
        <ActionConfigFields widget={v} up={up} />
      </>)}

      {widget.type === 'shape' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.shape.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.shape.shapeType')}>
          <Select value={(v.shapeType as string) || 'rect'} onChange={val => up('shapeType', val)}
            options={[
              { label: t('editor.propertyPanel.shape.rect'), value: 'rect' },
              { label: t('editor.propertyPanel.shape.roundedRect'), value: 'rounded-rect' },
              { label: t('editor.propertyPanel.shape.circle'), value: 'circle' },
              { label: t('editor.propertyPanel.shape.triangle'), value: 'triangle' },
              { label: t('editor.propertyPanel.shape.diamond'), value: 'diamond' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.shape.fillType')}>
          <Select value={(v.fillType as string) || 'solid'} onChange={val => up('fillType', val)}
            options={[
              { label: t('editor.propertyPanel.shape.solid'), value: 'solid' },
              { label: t('editor.propertyPanel.shape.gradient'), value: 'gradient' },
            ]} />
        </Form.Item>
        {(v.fillType as string) === 'solid' ? (
          <Form.Item label={t('editor.propertyPanel.shape.fillColor')}>
            <ColorInput value={(v.fillColor as string) || '#d9d9d9'} onChange={val => up('fillColor', val)} />
          </Form.Item>
        ) : (<>
          <Form.Item label={t('editor.propertyPanel.shape.gradientStart')}>
            <ColorInput value={(v.gradientStart as string) || '#4F6EF7'} onChange={val => up('gradientStart', val)} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.shape.gradientEnd')}>
            <ColorInput value={(v.gradientEnd as string) || '#52c41a'} onChange={val => up('gradientEnd', val)} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.shape.gradientAngle')}>
            <Slider min={0} max={360} value={(v.gradientAngle as number) ?? 90} onChange={val => up('gradientAngle', val)} />
          </Form.Item>
        </>)}
        <Form.Item label={t('editor.propertyPanel.shape.borderColor')}>
          <ColorInput value={(v.borderColor as string) || 'transparent'} onChange={val => up('borderColor', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.shape.borderWidth')}>
          <Slider min={0} max={10} value={(v.borderWidth as number) ?? 0} onChange={val => up('borderWidth', val)} />
        </Form.Item>
        {(v.shapeType as string) === 'rounded-rect' && (
          <Form.Item label={t('editor.propertyPanel.shape.borderRadius')}>
            <Slider min={0} max={50} value={(v.borderRadius as number) ?? 0} onChange={val => up('borderRadius', val)} />
          </Form.Item>
        )}
        <Form.Item label={t('editor.propertyPanel.shape.opacity')}>
          <Slider min={0} max={100} value={(v.opacity as number) ?? 100} onChange={val => up('opacity', val)} />
        </Form.Item>
      </>)}

      {(widget.type === 'webview' || widget.type === 'weather') && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.webview.section')}</Text>
        </div>

        <Form.Item label={t('editor.propertyPanel.webview.preset')}>
          <div className="pp-preset-cards">
            {[
              { value: 'none', icon: '🌐', label: t('editor.propertyPanel.webview.none'), desc: t('editor.propertyPanel.webview.noneDesc') },
              { value: 'bilibili', icon: '📺', label: t('editor.propertyPanel.webview.bilibili'), desc: t('editor.propertyPanel.webview.bilibiliDesc') },
              { value: 'weather', icon: '🌤️', label: t('editor.propertyPanel.webview.weather'), desc: t('editor.propertyPanel.webview.weatherDesc') },
            ].map(p => (
              <div
                key={p.value}
                className={`pp-preset-card${(v.preset as string) === p.value ? ' active' : ''}`}
                onClick={() => applyPreset(p.value)}
              >
                <span className="pp-preset-icon">{p.icon}</span>
                <span className="pp-preset-label">{p.label}</span>
                <span className="pp-preset-desc">{p.desc}</span>
              </div>
            ))}
          </div>
        </Form.Item>

        {(v.preset as string) === 'bilibili' && (<>
          <Form.Item label={t('editor.propertyPanel.webview.roomId')}>
            <Input value={(v.bilibiliRoomId as string) || ''} onChange={e => up('bilibiliRoomId', e.target.value)} placeholder={t('editor.propertyPanel.webview.roomIdPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.webview.refreshInterval')}>
            <InputNumber min={10} max={3600} value={(v.refreshInterval as number) || 30} style={{ width: '100%' }}
              onChange={val => up('refreshInterval', val ?? 30)} />
          </Form.Item>
        </>)}

        {(v.preset as string) === 'weather' && (<>
          <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.webview.paramSection')}</Text>
          </div>

          <Form.Item label={t('editor.propertyPanel.webview.city')}>
            <Input value={(v.city as string) || ''} onChange={e => up('city', e.target.value)} placeholder={t('editor.propertyPanel.webview.cityPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.webview.apiKey')} extra={t('editor.propertyPanel.webview.apiKeyHint')}>
            <Input.Password value={(v.apiKey as string) || ''} onChange={e => up('apiKey', e.target.value)} placeholder={t('editor.propertyPanel.webview.apiKeyPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.webview.tempUnit')}>
            <Radio.Group value={(v.unit as string) || 'c'} onChange={e => up('unit', e.target.value)}>
              <Radio.Button value="c">{t('editor.propertyPanel.webview.celsius')}</Radio.Button>
              <Radio.Button value="f">{t('editor.propertyPanel.webview.fahrenheit')}</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.webview.refreshHours')} extra={t('editor.propertyPanel.webview.refreshHoursHint')}>
            <InputNumber min={0} max={168} step={1} value={(v.refreshHours as number) ?? 1} style={{ width: '100%' }} suffix="h"
              onChange={val => up('refreshHours', val ?? 0)} />
          </Form.Item>
        </>)}

        {(v.preset as string) === 'none' && (<>
          <Form.Item label={t('editor.propertyPanel.webview.displayMode')}>
            <Select value={(v.displayMode as string) || 'webpage'} onChange={val => up('displayMode', val)}
              options={[
                { label: t('editor.propertyPanel.webview.webpage'), value: 'webpage' },
                { label: t('editor.propertyPanel.webview.rss'), value: 'rss' },
                { label: t('editor.propertyPanel.webview.json'), value: 'json' },
              ]} />
          </Form.Item>

          {(v.displayMode as string) === 'webpage' && (<>
            <Form.Item label={t('editor.propertyPanel.webview.url')}>
              <Input value={(v.url as string) || ''} onChange={e => up('url', e.target.value)} placeholder={t('editor.propertyPanel.webview.urlPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('editor.propertyPanel.webview.showScrollbar')}>
              <Select value={((v.showScrollbar as boolean) ?? true) ? 'yes' : 'no'} onChange={val => up('showScrollbar', val === 'yes')}
                options={[
                  { label: t('editor.propertyPanel.webview.scrollShow'), value: 'yes' },
                  { label: t('editor.propertyPanel.webview.scrollHide'), value: 'no' },
                ]} />
            </Form.Item>
          </>)}

          {(v.displayMode as string) === 'rss' && (<>
            <Form.Item label={t('editor.propertyPanel.webview.rssUrl')}>
              <Input value={(v.rssUrl as string) || ''} onChange={e => up('rssUrl', e.target.value)} placeholder={t('editor.propertyPanel.webview.rssUrlPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('editor.propertyPanel.webview.autoRefresh')}>
              <InputNumber min={0} max={3600} value={(v.refreshInterval as number) || 0} style={{ width: '100%' }}
                onChange={val => up('refreshInterval', val ?? 0)} />
            </Form.Item>
          </>)}

          {(v.displayMode as string) === 'json' && (<>
            <Form.Item label={t('editor.propertyPanel.webview.jsonUrl')}>
              <Input value={(v.jsonUrl as string) || ''} onChange={e => up('jsonUrl', e.target.value)} placeholder={t('editor.propertyPanel.webview.jsonUrlPlaceholder')} />
            </Form.Item>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item label={t('editor.propertyPanel.webview.titleField')} style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.titleField as string) || 'title'} onChange={e => up('titleField', e.target.value)} size="small" />
              </Form.Item>
              <Form.Item label={t('editor.propertyPanel.webview.contentField')} style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.descField as string) || 'description'} onChange={e => up('descField', e.target.value)} size="small" />
              </Form.Item>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item label={t('editor.propertyPanel.webview.timeField')} style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.timeField as string) || 'pubDate'} onChange={e => up('timeField', e.target.value)} size="small" />
              </Form.Item>
              <Form.Item label={t('editor.propertyPanel.webview.linkField')} style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.linkField as string) || 'link'} onChange={e => up('linkField', e.target.value)} size="small" />
              </Form.Item>
            </div>
            <Form.Item label={t('editor.propertyPanel.webview.autoRefresh')}>
              <InputNumber min={0} max={3600} value={(v.refreshInterval as number) || 0} style={{ width: '100%' }}
                onChange={val => up('refreshInterval', val ?? 0)} />
            </Form.Item>
          </>)}
        </>)}
      </>)}

      {widget.type === 'media-control' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.media.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.media.displayMode')}>
          <Select value={(v.displayMode as string) || 'always'} onChange={val => up('displayMode', val)}
            options={[
              { label: t('editor.propertyPanel.media.always'), value: 'always' },
              { label: t('editor.propertyPanel.media.playingOnly'), value: 'playing_only' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.media.showCover')} valuePropName="checked">
          <Switch checked={(v.showCover as boolean) ?? true} onChange={val => up('showCover', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.media.showProgress')} valuePropName="checked">
          <Switch checked={(v.showProgress as boolean) ?? true} onChange={val => up('showProgress', val)} />
        </Form.Item>
      </>)}

      {widget.type === 'system-monitor' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.systemMonitor.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.systemMonitor.showCPU')} valuePropName="checked">
          <Switch checked={(v.showCPU as boolean) ?? true} onChange={val => up('showCPU', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.systemMonitor.showMemory')} valuePropName="checked">
          <Switch checked={(v.showMemory as boolean) ?? true} onChange={val => up('showMemory', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.systemMonitor.showDisk')} valuePropName="checked">
          <Switch checked={(v.showDisk as boolean) ?? true} onChange={val => up('showDisk', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.systemMonitor.showNetwork')} valuePropName="checked">
          <Switch checked={(v.showNetwork as boolean) ?? true} onChange={val => up('showNetwork', val)} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.systemMonitor.refreshInterval')}>
          <InputNumber min={1} max={60} value={(v.refreshInterval as number) ?? 2} style={{ width: '100%' }}
            onChange={val => up('refreshInterval', val ?? 2)} />
        </Form.Item>
        <ActionConfigFields widget={v} up={up} />
      </>)}

      {widget.type === 'quick-action' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.quickAction.section')}</Text>
        </div>
        <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
          {t('editor.propertyPanel.quickAction.desc')}
        </Text>
      </>)}

      {widget.type === 'launcher' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.launcher.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.launcher.name')}>
          <Input value={(v.name as string) || ''} onChange={e => up('name', e.target.value)} placeholder={t('editor.propertyPanel.launcher.namePlaceholder')} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.launcher.path')}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input value={(v.path as string) || ''} onChange={e => up('path', e.target.value)} placeholder={t('editor.propertyPanel.launcher.pathPlaceholder')} style={{ flex: 1 }} />
            <Button size="small" onClick={async () => {
              try {
                const { open } = await import('@tauri-apps/plugin-dialog');
                const file = await open({
                  filters: [
                    { name: t('editor.propertyPanel.launcher.appFilter'), extensions: ['exe', 'lnk', 'app'] },
                    { name: t('editor.propertyPanel.launcher.allFilter'), extensions: ['*'] },
                  ],
                  multiple: false,
                });
                if (!file) return;
                const result = await tauriInvoke<{ name: string; resolved_path: string }>('resolve_launcher_path', { path: file });
                up('name', result.name);
                up('path', result.resolved_path);
                // 提取应用图标
                try {
                  const iconData = await tauriInvoke<string>('extract_app_icon', { path: result.resolved_path });
                  if (iconData) up('icon', iconData);
                } catch { /* 图标提取失败时忽略，保留默认占位图 */ }
              } catch (e) { message.error(String(e)); }
            }}>
              {t('editor.propertyPanel.launcher.browse')}
            </Button>
          </div>
        </Form.Item>
      </>)}

      {widget.type === 'clock' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.clock.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.clock.clockDisplay')}>
          <Select value={(v.clockDisplay as string) || 'digital'} onChange={val => up('clockDisplay', val)}
            options={[
              { label: t('editor.propertyPanel.clock.digital'), value: 'digital' },
              { label: t('editor.propertyPanel.clock.analog'), value: 'analog' },
            ]} />
        </Form.Item>

        {(v.clockDisplay as string) === 'digital' && (<>
          <Form.Item label={t('editor.propertyPanel.clock.format24h')} valuePropName="checked">
            <Switch checked={(v.format24h as boolean) ?? true} onChange={val => up('format24h', val)} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.clock.showSeconds')} valuePropName="checked">
            <Switch checked={(v.showSeconds as boolean) ?? true} onChange={val => up('showSeconds', val)} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.clock.showAmpm')} valuePropName="checked">
            <Switch checked={(v.showAmpm as boolean) ?? true} onChange={val => up('showAmpm', val)} />
          </Form.Item>
          <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
            {t('editor.propertyPanel.clock.hint')}
          </Text>
        </>)}

        {(v.clockDisplay as string) === 'analog' && (<>
          <Form.Item label={t('editor.propertyPanel.clock.tickMarks')} valuePropName="checked">
            <Switch checked={(v.tickMarks as boolean) ?? true} onChange={val => up('tickMarks', val)} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.clock.showNumbers')} valuePropName="checked">
            <Switch checked={(v.showNumbers as boolean) ?? true} onChange={val => up('showNumbers', val)} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.clock.handStyle')}>
            <Select value={(v.handStyle as string) || 'classic'} onChange={val => up('handStyle', val)}
              options={[
                { label: t('editor.propertyPanel.clock.classic'), value: 'classic' },
                { label: t('editor.propertyPanel.clock.modern'), value: 'modern' },
                { label: t('editor.propertyPanel.clock.thin'), value: 'thin' },
              ]} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.clock.faceColor')}>
            <ColorInput value={(v.faceColor as string) || '#ffffff'} onChange={val => up('faceColor', val)} />
          </Form.Item>
          <Form.Item label={t('editor.propertyPanel.clock.handColor')} style={{ marginBottom: 0 }}>
            <ColorInput value={(v.handColor as string) || '#333333'} onChange={val => up('handColor', val)} />
          </Form.Item>
        </>)}
      </>)}

      {widget.type === 'date' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.date.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.date.dateFormat')}>
          <Select
            value={(v.dateFormat as string) || 'YYYY年MM月DD日 星期X'}
            onChange={val => up('dateFormat', val)}
            options={[
              { label: t('editor.propertyPanel.date.format1'), value: 'YYYY年MM月DD日 星期X' },
              { label: t('editor.propertyPanel.date.format2'), value: 'YYYY-MM-DD 星期X' },
              { label: t('editor.propertyPanel.date.format3'), value: 'MM月DD日 星期X' },
              { label: t('editor.propertyPanel.date.format4'), value: 'YYYY年MM月DD日' },
              { label: t('editor.propertyPanel.date.format5'), value: 'MM/DD/YYYY' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.date.customFormat')}>
          <Input value={(v.dateFormat as string) || 'YYYY年MM月DD日 星期X'} onChange={e => up('dateFormat', e.target.value)} placeholder={t('editor.propertyPanel.date.customPlaceholder')} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.date.showLunar')} valuePropName="checked">
          <Switch checked={(v.showLunar as boolean) ?? true} onChange={val => up('showLunar', val)} />
        </Form.Item>
        <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
          {t('editor.propertyPanel.date.hint')}
        </Text>
      </>)}

      {widget.type === 'calendar' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.calendar.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.calendar.viewMode')}>
          <Radio.Group value={(v.viewMode as string) || 'month'} onChange={e => up('viewMode', e.target.value)}>
            <Radio.Button value="month">{t('editor.propertyPanel.calendar.month')}</Radio.Button>
            <Radio.Button value="week">{t('editor.propertyPanel.calendar.week')}</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.calendar.highlightToday')} valuePropName="checked">
          <Switch checked={(v.highlightToday as boolean) ?? true} onChange={val => up('highlightToday', val)} />
        </Form.Item>
        <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
          {t('editor.propertyPanel.calendar.hint')}
        </Text>
      </>)}

      {widget.type === 'card' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.card.section')}</Text>
        </div>
        <Form.Item label={t('editor.propertyPanel.card.title')}>
          <Input value={(v.cardTitle as string) || ''} onChange={e => up('cardTitle', e.target.value)} placeholder={t('editor.propertyPanel.card.titlePlaceholder')} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.card.desc')}>
          <Input.TextArea value={(v.cardDesc as string) || ''} onChange={e => up('cardDesc', e.target.value)} rows={3} placeholder={t('editor.propertyPanel.card.descPlaceholder')} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.card.image')}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button size="small" onClick={handleCardImageUpload}>{t('editor.propertyPanel.card.upload')}</Button>
            {(v.cardImage as string) && <Tag color="blue">{t('editor.propertyPanel.card.set')}</Tag>}
          </div>
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.card.imagePosition')}>
          <Select value={(v.cardImagePosition as string) || 'top'} onChange={val => up('cardImagePosition', val)}
            options={[
              { label: t('editor.propertyPanel.card.top'), value: 'top' },
              { label: t('editor.propertyPanel.card.left'), value: 'left' },
              { label: t('editor.propertyPanel.card.right'), value: 'right' },
            ]} />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.card.tags')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {((v.cardTags as string[]) || []).map((tag, idx) => (
              <Tag key={idx} closable onClose={() => up('cardTags', ((v.cardTags as string[]) || []).filter((_, i) => i !== idx))}>
                {tag}
              </Tag>
            ))}
          </div>
          <Input
            placeholder={t('editor.propertyPanel.card.addTag')}
            size="small"
            onPressEnter={(e) => {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) {
                up('cardTags', [...((v.cardTags as string[]) || []), val]);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </Form.Item>
        <Form.Item label={t('editor.propertyPanel.card.footer')}>
          <Input value={(v.cardFooter as string) || ''} onChange={e => up('cardFooter', e.target.value)} placeholder={t('editor.propertyPanel.card.footerPlaceholder')} />
        </Form.Item>
      </>)}
      {/* 组件联动配置 - 所有控件通用 */}
      <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>{t('editor.propertyPanel.actionConfig.linkage')}</Text>
        <Form.Item label={t('editor.propertyPanel.actionConfig.triggerEvent')} style={{ marginBottom: 8 }}>
          <Select
            value={(v.triggerEvent as string) || ''}
            onChange={val => {
              up('triggerEvent', val || undefined);
              if (!val) up('targetWidgetId', undefined);
            }}
            allowClear
            placeholder={t('editor.propertyPanel.actionConfig.none')}
            options={[
              { label: t('editor.propertyPanel.actionConfig.switch_page'), value: 'switch_page' },
              { label: t('editor.propertyPanel.actionConfig.toggle_widget'), value: 'toggle_widget' },
              { label: t('editor.propertyPanel.actionConfig.update_data'), value: 'update_data' },
              { label: t('editor.propertyPanel.actionConfig.trigger_action'), value: 'trigger_action' },
            ]} />
        </Form.Item>
        {(v.triggerEvent as string) && (
          <Form.Item label={t('editor.propertyPanel.actionConfig.targetWidget')} style={{ marginBottom: 0 }}>
            <Select
              value={(v.targetWidgetId as string) || ''}
              onChange={val => up('targetWidgetId', val || undefined)}
              allowClear
              placeholder={t('editor.propertyPanel.actionConfig.selectWidget')}
              options={theme.pages[activePageIdx]?.widgets
                .filter(w => w.id !== selectedWidgetId)
                .map(w => ({ label: `${w.label || w.id} (${w.type})`, value: w.id })) || []} />
          </Form.Item>
        )}
      </div>

    </Form>
  );
}


export default function PropertyPanel({ onAddPage }: { onAddPage: () => void }) {
  const { t } = useTranslation();
  const { selectedWidgetId } = useEditorStore();
  return (
    <div className="editor-prop">
      <PageManager onAddPage={onAddPage} />
      <div className="ep-section">
        <div className="ep-title">{selectedWidgetId ? t('editor.propertyPanel.widgetTitle') : t('editor.propertyPanel.pageTitle')}</div>
        {selectedWidgetId ? <WidgetProperties /> : <PageProperties />}
      </div>
    </div>
  );
}
