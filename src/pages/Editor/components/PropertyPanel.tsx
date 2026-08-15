import { Form, Input, Select, InputNumber, Tag, Button, Slider, Radio, Switch, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEditorStore } from '../store/editorStore';
import type { SnippetItem } from '../types';
import PageManager from './PageManager';
import { Typography } from 'antd';
import { tauriInvoke } from '../../../utils/tauri';

const { Text } = Typography;
const TYPE_LABELS: Record<string, string> = { button: '快捷操作', gauge: '数据表盘', 'snippet-list': '便签', text: '文本标签', shape: '形状', 'system-monitor': '系统监控', 'quick-action': '快捷面板', launcher: '应用启动', 'media-control': '媒体控制', webview: '网页视图', image: '图片', clock: '时钟', date: '日期', calendar: '日历' };

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
  const items = value || [];
  return (
    <div className="pp-snippet-editor">
      {items.map((item, idx) => (
        <div key={item.id} className="pp-snippet-row">
          <Input size="small" placeholder="标签" value={item.label} style={{ width: 80 }}
            onChange={e => onChange?.(items.map((s, i) => i === idx ? { ...s, label: e.target.value } : s))} />
          <Input size="small" placeholder="内容" value={item.content}
            onChange={e => onChange?.(items.map((s, i) => i === idx ? { ...s, content: e.target.value } : s))} />
          <Button size="small" type="text" danger icon={<DeleteOutlined />}
            onClick={() => onChange?.(items.filter((_, i) => i !== idx))} />
        </div>
      ))}
      <Button size="small" type="dashed" icon={<PlusOutlined />} block
        onClick={() => onChange?.([...items, { id: `s-${Date.now()}`, label: '', content: '' }])}>添加便签条目</Button>
    </div>
  );
}

function CommonStyleFields({ widget, up }: { widget: Record<string, unknown>; up: (k: string, v: unknown) => void }) {
  return (
    <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
      <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>样式</Text>
      <Form.Item label="背景颜色" style={{ marginBottom: 8 }}>
        <ColorInput value={(widget.backgroundColor as string) || '#f0f2f5'} onChange={v => up('backgroundColor', v)} />
      </Form.Item>
      <Form.Item label="背景透明度" style={{ marginBottom: 8 }}>
        <Slider min={0} max={100} value={(widget.backgroundOpacity as number) ?? 100} onChange={v => up('backgroundOpacity', v)} />
      </Form.Item>
      <Form.Item label="圆角" style={{ marginBottom: 8 }}>
        <Slider min={0} max={20} value={(widget.borderRadius as number) ?? 6} onChange={v => up('borderRadius', v)} />
      </Form.Item>
      <Form.Item label="文字颜色" style={{ marginBottom: 8 }}>
        <ColorInput value={(widget.textColor as string) || '#333333'} onChange={v => up('textColor', v)} />
      </Form.Item>
      <Form.Item label="文字大小" style={{ marginBottom: 8 }}>
        <Slider min={12} max={48} value={(widget.fontSize as number) ?? 12} onChange={v => up('fontSize', v)} />
      </Form.Item>
      <Form.Item label="文字粗细" style={{ marginBottom: 0 }}>
        <Select value={(widget.fontWeight as string) || 'normal'} onChange={v => up('fontWeight', v)}
          options={[{ label: '正常', value: 'normal' }, { label: '加粗', value: 'bold' }, { label: '更粗', value: 'bolder' }]} />
      </Form.Item>
    </div>
  );
}

function PageProperties() {
  const { theme, activePageIdx, updatePage } = useEditorStore();
  const page = theme.pages[activePageIdx];
  if (!page) return <Text style={{ color: '#888', fontSize: 12 }}>请先添加页面</Text>;

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
      <Form.Item label="页面名称"><Input value={page.label} onChange={e => updatePage(activePageIdx, { label: e.target.value })} /></Form.Item>
      <Form.Item label="布局模式">
        <Select value={page.layoutMode} onChange={v => updatePage(activePageIdx, { layoutMode: v })}
          options={[{ label: '网格布局', value: 'grid' }, { label: '自由布局', value: 'free' }]} />
      </Form.Item>
      {page.layoutMode === 'grid' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item label="列数"><InputNumber value={page.columns} min={2} max={8} onChange={v => updatePage(activePageIdx, { columns: v ?? 4 })} /></Form.Item>
          <Form.Item label="行数"><InputNumber value={page.rows} min={1} max={10} onChange={v => updatePage(activePageIdx, { rows: v ?? 6 })} /></Form.Item>
        </div>
      )}
      {page.layoutMode === 'free' && (
        <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 8 }}>
          自由布局：控件可放置在任意位置，显示十字居中参考线
        </Text>
      )}
      <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>页面背景</Text>
        <Form.Item label="背景颜色" style={{ marginBottom: 8 }}>
          <ColorInput value={page.backgroundColor || '#ffffff'} onChange={v => updatePage(activePageIdx, { backgroundColor: v })} />
        </Form.Item>
        <Form.Item label="背景图片" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button size="small" onClick={handleBgUpload}>上传</Button>
            {page.backgroundImage && <>
              <Tag color="blue">已设置</Tag>
              <Button size="small" type="link" danger onClick={() => updatePage(activePageIdx, { backgroundImage: undefined })}>清除</Button>
            </>}
          </div>
        </Form.Item>
        {page.backgroundImage && (<>
          <Form.Item label="背景模式" style={{ marginBottom: 8 }}>
            <Select value={page.backgroundMode || 'cover'} onChange={v => updatePage(activePageIdx, { backgroundMode: v })}
              options={[{ label: '填充', value: 'cover' }, { label: '适应', value: 'contain' }, { label: '拉伸', value: 'stretch' }, { label: '平铺', value: 'repeat' }]} />
          </Form.Item>
          <Form.Item label="透明度" style={{ marginBottom: 0 }}>
            <Slider min={0} max={100} value={page.backgroundOpacity ?? 100} onChange={v => updatePage(activePageIdx, { backgroundOpacity: v })} />
          </Form.Item>
        </>)}
      </div>
    </Form>
  );
}

function WidgetProperties() {
  const { theme, activePageIdx, selectedWidgetId, updateWidget } = useEditorStore();
  const page = theme.pages[activePageIdx];
  const widget = page?.widgets.find(w => w.id === selectedWidgetId);
  if (!widget || !selectedWidgetId) return null;
  const v = widget as Record<string, unknown>;
  const up = (key: string, val: unknown) => updateWidget(selectedWidgetId, { [key]: val });
  const isGrid = page!.layoutMode === 'grid';

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

  return (
    <Form layout="vertical" size="small">
      <Form.Item label="类型"><Tag color="blue">{TYPE_LABELS[widget.type] || '未知'}</Tag></Form.Item>
      <Form.Item label="标签"><Input value={widget.label} onChange={e => up('label', e.target.value)} /></Form.Item>

      {isGrid ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Form.Item label="列" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridCol} min={0} max={page!.columns - 1} size="small" style={{ width: '100%' }} onChange={v => up('gridCol', v ?? 0)} /></Form.Item>
          <Form.Item label="行" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridRow} min={0} max={page!.rows - 1} size="small" style={{ width: '100%' }} onChange={v => up('gridRow', v ?? 0)} /></Form.Item>
          <Form.Item label="宽" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridW} min={1} max={page!.columns} size="small" style={{ width: '100%' }} onChange={v => up('gridW', v ?? 1)} /></Form.Item>
          <Form.Item label="高" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={widget.gridH} min={1} max={page!.rows} size="small" style={{ width: '100%' }} onChange={v => up('gridH', v ?? 1)} /></Form.Item>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Form.Item label="X%" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeX)} min={0} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeX', v ?? 0)} /></Form.Item>
          <Form.Item label="Y%" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeY)} min={0} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeY', v ?? 0)} /></Form.Item>
          <Form.Item label="W%" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeW)} min={5} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeW', v ?? 30)} /></Form.Item>
          <Form.Item label="H%" style={{ marginBottom: 0, flex: 1 }}><InputNumber value={Math.round(widget.freeH)} min={5} max={100} size="small" style={{ width: '100%' }} onChange={v => up('freeH', v ?? 15)} /></Form.Item>
        </div>
      )}

      <CommonStyleFields widget={v} up={up} />

      {widget.type === 'button' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>快捷操作</Text>
        </div>
        <Form.Item label="图标"><Input value={(v.icon as string) || ''} onChange={e => up('icon', e.target.value)} style={{ width: 80 }} /></Form.Item>
        <Form.Item label="动作类型">
          <Select value={(v.action as Record<string, unknown>)?.type as string || 'keyboard'}
            onChange={val => up('action', { type: val, keys: [], path: '', url: '' })}
            options={[{ label: '键盘按键', value: 'keyboard' }, { label: '打开应用', value: 'open' }, { label: '打开 URL', value: 'url' }]} />
        </Form.Item>
        {((v.action as Record<string, unknown>)?.type === 'keyboard') && (
          <Form.Item label="按键 (逗号分隔)"><Input value={((v.action as Record<string, unknown>)?.keys as string[])?.join(',') || ''}
            onChange={e => up('action', { ...(v.action as Record<string, unknown>), keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="ctrl,c" /></Form.Item>
        )}
        {((v.action as Record<string, unknown>)?.type === 'open') && (
          <Form.Item label="应用路径"><Input value={(v.action as Record<string, unknown>)?.path as string || ''}
            onChange={e => up('action', { ...(v.action as Record<string, unknown>), path: e.target.value })} placeholder="notepad" /></Form.Item>
        )}
        {((v.action as Record<string, unknown>)?.type === 'url') && (
          <Form.Item label="URL"><Input value={(v.action as Record<string, unknown>)?.url as string || ''}
            onChange={e => up('action', { ...(v.action as Record<string, unknown>), url: e.target.value })} placeholder="https://..." /></Form.Item>
        )}
      </>)}

      {widget.type === 'gauge' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>数据表盘</Text>
        </div>
        <Form.Item label="数据源">
          <Select value={(v.dataSource as string) || 'system.cpu.usage'} onChange={val => up('dataSource', val)}
            options={[
              { label: 'CPU 使用率', value: 'system.cpu.usage' },
              { label: '内存使用率', value: 'system.memory.usage' },
              { label: '磁盘使用率', value: 'system.disk.usage' },
              { label: '网络上传', value: 'system.network.upload' },
              { label: '网络下载', value: 'system.network.download' },
              { label: '运行时间', value: 'system.uptime' },
            ]} />
        </Form.Item>
        <Form.Item label="显示样式">
          <Select value={(v.gaugeStyle as string) || 'ring'} onChange={val => up('gaugeStyle', val)}
            options={[{ label: '环形进度', value: 'ring' }, { label: '数字显示', value: 'number' }, { label: '水平进度条', value: 'bar' }]} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item label="最小值" style={{ flex: 1, marginBottom: 8 }}><InputNumber value={(v.minValue as number) ?? 0} style={{ width: '100%' }} onChange={val => up('minValue', val ?? 0)} /></Form.Item>
          <Form.Item label="最大值" style={{ flex: 1, marginBottom: 8 }}><InputNumber value={(v.maxValue as number) ?? 100} style={{ width: '100%' }} onChange={val => up('maxValue', val ?? 100)} /></Form.Item>
        </div>
        <Form.Item label="单位"><Input value={(v.unit as string) || ''} onChange={e => up('unit', e.target.value)} style={{ width: 80 }} placeholder="%" /></Form.Item>
        <Form.Item label="环粗细"><Slider min={1} max={6} value={(v.ringWidth as number) ?? 3} onChange={val => up('ringWidth', val)} /></Form.Item>
        <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>环颜色（按数值分段）</Text>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}><Text style={{ fontSize: 10, color: '#888' }}>低</Text><ColorInput value={(v.ringColorLow as string) || '#52c41a'} onChange={val => up('ringColorLow', val)} /></div>
          <div style={{ flex: 1 }}><Text style={{ fontSize: 10, color: '#888' }}>中</Text><ColorInput value={(v.ringColorMid as string) || '#faad14'} onChange={val => up('ringColorMid', val)} /></div>
          <div style={{ flex: 1 }}><Text style={{ fontSize: 10, color: '#888' }}>高</Text><ColorInput value={(v.ringColorHigh as string) || '#ff4d4f'} onChange={val => up('ringColorHigh', val)} /></div>
        </div>
      </>)}

      {widget.type === 'snippet-list' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>便签</Text>
        </div>
        <Form.Item label="组件模式">
          <Select value={(v.mode as string) || 'note'} onChange={val => up('mode', val)}
            options={[
              { label: '普通便签', value: 'note' },
              { label: '快捷输入', value: 'snippet' },
            ]} />
        </Form.Item>
        <Form.Item label="便签列表"><SnippetEditor value={(v.snippets as SnippetItem[]) || []} onChange={val => up('snippets', val)} /></Form.Item>
      </>)}

      {widget.type === 'image' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>图片</Text>
        </div>
        <Form.Item label="图片">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button size="small" onClick={handleImageUpload}>上传图片</Button>
            {(v.src as string) && <Tag color="blue">已设置</Tag>}
          </div>
        </Form.Item>
        <Form.Item label="缩放模式">
          <Select value={(v.objectFit as string) || 'cover'} onChange={val => up('objectFit', val)}
            options={[{ label: '填充', value: 'cover' }, { label: '适应', value: 'contain' }, { label: '拉伸', value: 'fill' }]} />
        </Form.Item>
      </>)}

      {widget.type === 'text' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>文本标签</Text>
        </div>
        <Form.Item label="文本内容">
          <Input.TextArea value={(v.content as string) || ''} onChange={e => up('content', e.target.value)} rows={3} placeholder="输入文字内容" />
        </Form.Item>
        <Form.Item label="字体大小">
          <Slider min={12} max={72} value={(v.fontSize as number) ?? 16} onChange={val => up('fontSize', val)} />
        </Form.Item>
        <Form.Item label="字体粗细">
          <Select value={(v.fontWeight as string) || 'normal'} onChange={val => up('fontWeight', val)}
            options={[{ label: '常规', value: 'normal' }, { label: '加粗', value: 'bold' }, { label: '更粗', value: 'bolder' }, { label: '更细', value: 'lighter' }]} />
        </Form.Item>
        <Form.Item label="字体颜色">
          <ColorInput value={(v.color as string) || '#333333'} onChange={val => up('color', val)} />
        </Form.Item>
        <Form.Item label="对齐方式">
          <Select value={(v.textAlign as string) || 'left'} onChange={val => up('textAlign', val)}
            options={[{ label: '左对齐', value: 'left' }, { label: '居中', value: 'center' }, { label: '右对齐', value: 'right' }]} />
        </Form.Item>
        <Form.Item label="背景颜色">
          <ColorInput value={(v.backgroundColor as string) || 'transparent'} onChange={val => up('backgroundColor', val)} />
        </Form.Item>
        <Form.Item label="背景透明度">
          <Slider min={0} max={100} value={(v.backgroundOpacity as number) ?? 0} onChange={val => up('backgroundOpacity', val)} />
        </Form.Item>
        <Form.Item label="内边距">
          <Slider min={0} max={20} value={(v.padding as number) ?? 4} onChange={val => up('padding', val)} />
        </Form.Item>
        <Form.Item label="圆角">
          <Slider min={0} max={20} value={(v.borderRadius as number) ?? 0} onChange={val => up('borderRadius', val)} />
        </Form.Item>
      </>)}

      {widget.type === 'shape' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>形状</Text>
        </div>
        <Form.Item label="形状类型">
          <Select value={(v.shapeType as string) || 'rect'} onChange={val => up('shapeType', val)}
            options={[
              { label: '矩形', value: 'rect' },
              { label: '圆角矩形', value: 'rounded-rect' },
              { label: '圆形', value: 'circle' },
              { label: '三角形', value: 'triangle' },
              { label: '菱形', value: 'diamond' },
            ]} />
        </Form.Item>
        <Form.Item label="填充类型">
          <Select value={(v.fillType as string) || 'solid'} onChange={val => up('fillType', val)}
            options={[{ label: '纯色', value: 'solid' }, { label: '渐变', value: 'gradient' }]} />
        </Form.Item>
        {(v.fillType as string) === 'solid' ? (
          <Form.Item label="填充颜色">
            <ColorInput value={(v.fillColor as string) || '#d9d9d9'} onChange={val => up('fillColor', val)} />
          </Form.Item>
        ) : (<>
          <Form.Item label="渐变起始色">
            <ColorInput value={(v.gradientStart as string) || '#4F6EF7'} onChange={val => up('gradientStart', val)} />
          </Form.Item>
          <Form.Item label="渐变结束色">
            <ColorInput value={(v.gradientEnd as string) || '#52c41a'} onChange={val => up('gradientEnd', val)} />
          </Form.Item>
          <Form.Item label="渐变角度">
            <Slider min={0} max={360} value={(v.gradientAngle as number) ?? 90} onChange={val => up('gradientAngle', val)} />
          </Form.Item>
        </>)}
        <Form.Item label="边框颜色">
          <ColorInput value={(v.borderColor as string) || 'transparent'} onChange={val => up('borderColor', val)} />
        </Form.Item>
        <Form.Item label="边框宽度">
          <Slider min={0} max={10} value={(v.borderWidth as number) ?? 0} onChange={val => up('borderWidth', val)} />
        </Form.Item>
        {(v.shapeType as string) === 'rounded-rect' && (
          <Form.Item label="圆角大小">
            <Slider min={0} max={50} value={(v.borderRadius as number) ?? 0} onChange={val => up('borderRadius', val)} />
          </Form.Item>
        )}
        <Form.Item label="整体透明度">
          <Slider min={0} max={100} value={(v.opacity as number) ?? 100} onChange={val => up('opacity', val)} />
        </Form.Item>
      </>)}

      {widget.type === 'webview' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>网页视图</Text>
        </div>

        <Form.Item label="预设模板">
          <div className="pp-preset-cards">
            {[
              { value: 'none', icon: '🌐', label: '无预设', desc: '网页/RSS/JSON' },
              { value: 'bilibili', icon: '📺', label: 'B站直播', desc: '直播状态卡片' },
              { value: 'weather', icon: '🌤️', label: '天气', desc: '实时天气+预报' },
            ].map(p => (
              <div
                key={p.value}
                className={`pp-preset-card${(v.preset as string) === p.value ? ' active' : ''}`}
                onClick={() => up('preset', p.value)}
              >
                <span className="pp-preset-icon">{p.icon}</span>
                <span className="pp-preset-label">{p.label}</span>
                <span className="pp-preset-desc">{p.desc}</span>
              </div>
            ))}
          </div>
        </Form.Item>

        {(v.preset as string) === 'bilibili' && (<>
          <Form.Item label="直播间 ID">
            <Input value={(v.bilibiliRoomId as string) || ''} onChange={e => up('bilibiliRoomId', e.target.value)} placeholder="例如 22625025" />
          </Form.Item>
          <Form.Item label="刷新间隔（秒）">
            <InputNumber min={10} max={3600} value={(v.refreshInterval as number) || 30} style={{ width: '100%' }}
              onChange={val => up('refreshInterval', val ?? 30)} />
          </Form.Item>
        </>)}

        {(v.preset as string) === 'weather' && (<>
          <Form.Item label="城市名称">
            <Input value={(v.weatherCity as string) || ''} onChange={e => up('weatherCity', e.target.value)} placeholder="例如 Beijing" />
          </Form.Item>
          <Form.Item label="API Key">
            <Input.Password value={(v.weatherApiKey as string) || ''} onChange={e => up('weatherApiKey', e.target.value)} placeholder="OpenWeatherMap API Key" />
          </Form.Item>
          <Form.Item label="温度单位">
            <Radio.Group value={(v.weatherUnit as string) || 'c'} onChange={e => up('weatherUnit', e.target.value)}>
              <Radio.Button value="c">℃ 摄氏</Radio.Button>
              <Radio.Button value="f">℉ 华氏</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="刷新间隔（秒）">
            <InputNumber min={60} max={86400} value={(v.refreshInterval as number) || 600} style={{ width: '100%' }}
              onChange={val => up('refreshInterval', val ?? 600)} />
          </Form.Item>
          <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
            使用 OpenWeatherMap，请在 openweathermap.org 免费申请 API Key
          </Text>
        </>)}

        {(v.preset as string) === 'none' && (<>
          <Form.Item label="显示模式">
            <Select value={(v.displayMode as string) || 'webpage'} onChange={val => up('displayMode', val)}
              options={[
                { label: '网页加载', value: 'webpage' },
                { label: 'RSS 订阅', value: 'rss' },
                { label: 'JSON API', value: 'json' },
              ]} />
          </Form.Item>

          {(v.displayMode as string) === 'webpage' && (<>
            <Form.Item label="URL">
              <Input value={(v.url as string) || ''} onChange={e => up('url', e.target.value)} placeholder="https://example.com" />
            </Form.Item>
            <Form.Item label="显示滚动条">
              <Select value={((v.showScrollbar as boolean) ?? true) ? 'yes' : 'no'} onChange={val => up('showScrollbar', val === 'yes')}
                options={[{ label: '显示', value: 'yes' }, { label: '隐藏', value: 'no' }]} />
            </Form.Item>
          </>)}

          {(v.displayMode as string) === 'rss' && (<>
            <Form.Item label="RSS 订阅地址">
              <Input value={(v.rssUrl as string) || ''} onChange={e => up('rssUrl', e.target.value)} placeholder="https://example.com/feed.xml" />
            </Form.Item>
            <Form.Item label="自动刷新间隔（秒）">
              <InputNumber min={0} max={3600} value={(v.refreshInterval as number) || 0} style={{ width: '100%' }}
                onChange={val => up('refreshInterval', val ?? 0)} />
            </Form.Item>
          </>)}

          {(v.displayMode as string) === 'json' && (<>
            <Form.Item label="JSON API 地址">
              <Input value={(v.jsonUrl as string) || ''} onChange={e => up('jsonUrl', e.target.value)} placeholder="https://api.example.com/data" />
            </Form.Item>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item label="标题字段" style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.titleField as string) || 'title'} onChange={e => up('titleField', e.target.value)} size="small" />
              </Form.Item>
              <Form.Item label="内容字段" style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.descField as string) || 'description'} onChange={e => up('descField', e.target.value)} size="small" />
              </Form.Item>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item label="时间字段" style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.timeField as string) || 'pubDate'} onChange={e => up('timeField', e.target.value)} size="small" />
              </Form.Item>
              <Form.Item label="链接字段" style={{ flex: 1, marginBottom: 8 }}>
                <Input value={(v.linkField as string) || 'link'} onChange={e => up('linkField', e.target.value)} size="small" />
              </Form.Item>
            </div>
            <Form.Item label="自动刷新间隔（秒）">
              <InputNumber min={0} max={3600} value={(v.refreshInterval as number) || 0} style={{ width: '100%' }}
                onChange={val => up('refreshInterval', val ?? 0)} />
            </Form.Item>
          </>)}
        </>)}
      </>)}

      {widget.type === 'media-control' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>媒体控制</Text>
        </div>
        <Form.Item label="显示模式">
          <Select value={(v.displayMode as string) || 'always'} onChange={val => up('displayMode', val)}
            options={[
              { label: '始终显示', value: 'always' },
              { label: '仅播放时显示', value: 'playing_only' },
            ]} />
        </Form.Item>
        <Form.Item label="显示封面" valuePropName="checked">
          <Switch checked={(v.showCover as boolean) ?? true} onChange={val => up('showCover', val)} />
        </Form.Item>
        <Form.Item label="显示进度条" valuePropName="checked">
          <Switch checked={(v.showProgress as boolean) ?? true} onChange={val => up('showProgress', val)} />
        </Form.Item>
      </>)}

      {widget.type === 'system-monitor' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>系统监控</Text>
        </div>
        <Form.Item label="显示 CPU" valuePropName="checked">
          <Switch checked={(v.showCPU as boolean) ?? true} onChange={val => up('showCPU', val)} />
        </Form.Item>
        <Form.Item label="显示内存" valuePropName="checked">
          <Switch checked={(v.showMemory as boolean) ?? true} onChange={val => up('showMemory', val)} />
        </Form.Item>
        <Form.Item label="显示磁盘" valuePropName="checked">
          <Switch checked={(v.showDisk as boolean) ?? true} onChange={val => up('showDisk', val)} />
        </Form.Item>
        <Form.Item label="显示网络" valuePropName="checked">
          <Switch checked={(v.showNetwork as boolean) ?? true} onChange={val => up('showNetwork', val)} />
        </Form.Item>
<Form.Item label="刷新间隔（秒）">
          <InputNumber min={1} max={60} value={(v.refreshInterval as number) ?? 2} style={{ width: '100%' }}
            onChange={val => up('refreshInterval', val ?? 2)} />
        </Form.Item>
      </>)}

      {widget.type === 'quick-action' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>快捷面板</Text>
        </div>
        <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
          2×2 网格，每格支持应用启动或快捷片段。详情请在编辑器预览中查看。
        </Text>
      </>)}

      {widget.type === 'launcher' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>应用启动</Text>
        </div>
        <Form.Item label="名称">
          <Input value={(v.name as string) || ''} onChange={e => up('name', e.target.value)} placeholder="计算器" />
        </Form.Item>
        <Form.Item label="应用路径">
          <div style={{ display: 'flex', gap: 6 }}>
            <Input value={(v.path as string) || ''} onChange={e => up('path', e.target.value)} placeholder="calc" style={{ flex: 1 }} />
            <Button size="small" onClick={async () => {
              try {
                const { open } = await import('@tauri-apps/plugin-dialog');
                const file = await open({
                  filters: [
                    { name: '应用程序', extensions: ['exe', 'lnk', 'app'] },
                    { name: '所有文件', extensions: ['*'] },
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
              浏览...
            </Button>
          </div>
        </Form.Item>
      </>)}

      {widget.type === 'clock' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>时钟</Text>
        </div>
        <Form.Item label="24 小时制" valuePropName="checked">
          <Switch checked={(v.format24h as boolean) ?? true} onChange={val => up('format24h', val)} />
        </Form.Item>
        <Form.Item label="显示秒" valuePropName="checked">
          <Switch checked={(v.showSeconds as boolean) ?? true} onChange={val => up('showSeconds', val)} />
        </Form.Item>
        <Form.Item label="显示 AM/PM" valuePropName="checked">
          <Switch checked={(v.showAmpm as boolean) ?? true} onChange={val => up('showAmpm', val)} />
        </Form.Item>
        <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
          12 小时制下显示 AM/PM 标识，24 小时制下自动隐藏。
        </Text>
      </>)}

      {widget.type === 'date' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>日期</Text>
        </div>
        <Form.Item label="日期格式">
          <Select
            value={(v.dateFormat as string) || 'YYYY年MM月DD日 星期X'}
            onChange={val => up('dateFormat', val)}
            options={[
              { label: 'YYYY年MM月DD日 星期X', value: 'YYYY年MM月DD日 星期X' },
              { label: 'YYYY-MM-DD 星期X', value: 'YYYY-MM-DD 星期X' },
              { label: 'MM月DD日 星期X', value: 'MM月DD日 星期X' },
              { label: 'YYYY年MM月DD日', value: 'YYYY年MM月DD日' },
              { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
            ]} />
        </Form.Item>
        <Form.Item label="自定义格式">
          <Input value={(v.dateFormat as string) || 'YYYY年MM月DD日 星期X'} onChange={e => up('dateFormat', e.target.value)} placeholder="支持 YYYY/MM/DD/星期X" />
        </Form.Item>
        <Form.Item label="显示农历" valuePropName="checked">
          <Switch checked={(v.showLunar as boolean) ?? true} onChange={val => up('showLunar', val)} />
        </Form.Item>
        <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
          农历由 Rust 后端实时计算（如“农历六月廿二”）。
        </Text>
      </>)}

      {widget.type === 'calendar' && (<>
        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>日历</Text>
        </div>
        <Form.Item label="视图模式">
          <Radio.Group value={(v.viewMode as string) || 'month'} onChange={e => up('viewMode', e.target.value)}>
            <Radio.Button value="month">月视图</Radio.Button>
            <Radio.Button value="week">周视图</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="高亮今日" valuePropName="checked">
          <Switch checked={(v.highlightToday as boolean) ?? true} onChange={val => up('highlightToday', val)} />
        </Form.Item>
        <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
          点击任意日期可联动查看农历 / 备忘信息。
        </Text>
      </>)}
    </Form>
  );
}

export default function PropertyPanel({ onAddPage }: { onAddPage: () => void }) {
  const { selectedWidgetId } = useEditorStore();
  return (
    <div className="editor-prop">
      <PageManager onAddPage={onAddPage} />
      <div className="ep-section">
        <div className="ep-title">{selectedWidgetId ? '🎛️ 控件属性' : '📄 页面属性'}</div>
        {selectedWidgetId ? <WidgetProperties /> : <PageProperties />}
      </div>
    </div>
  );
}
