import { useState, useEffect, useRef } from 'react';
import {
  Form,
  InputNumber,
  Switch,
  Select,
  Button,
  Card,
  Input,
  Space,
  Row,
  Col,
  Typography,
  Alert,
  Modal,
  App,
} from 'antd';
import { SaveOutlined, RobotOutlined, ReloadOutlined, BugOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../store/aiStore';
import { useI18nStore } from '../i18n/useI18nStore';
import { exportEncryptedLogs } from '../utils/errorExport';
import { getLogs } from '../utils/logger';
import { devConfig, config as appConfig } from '../config';
import { getDeveloperPassword } from '../utils/md5';
import { tauriInvoke } from '../utils/tauri';
import type { AppSettings } from '../types/theme';
import { DEFAULT_SETTINGS } from '../types/theme';

const STORAGE_KEY = 'ilinkcat_settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [saved, setSaved] = useState(loadSettings());
  const { config, updateConfig } = useAIStore();
  const { lang, changeLang, importLanguage, languages } = useI18nStore();
  const languageInputRef = useRef<HTMLInputElement>(null);
  const [fetchingAi, setFetchingAi] = useState(false);
  const [devMode, setDevMode] = useState(devConfig.enabled);
  const [devApiUrl, setDevApiUrl] = useState(appConfig.apiBaseUrl);
  const [clickCount, setClickCount] = useState(0);

  const handleImportLanguage = () => {
    languageInputRef.current?.click();
  };

  const handleLanguageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const json = JSON.parse(reader.result as string);
        // 兼容两种格式：{code,label,resources} 或 {code,label,common:{}}
        const code = json.code || json.locale || json.language;
        const label = json.label || json.name || code;
        let resources: Record<string, object> = {};
        if (json.resources && typeof json.resources === 'object') {
          resources = json.resources;
        } else {
          // 扁平格式：提取所有非 meta 字段作为 common
          const { code: _c, label: _l, locale: _lo, language: _la, name: _n, ...rest } = json;
          resources = { common: rest };
        }
        if (!code) throw new Error('Missing language code');
        await importLanguage({ code, label, resources });
        message.success(t('settings.languageImported', { label }));
      } catch (err) {
        message.error(t('settings.languageImportFailed'));
      }
    };
    reader.readAsText(file);
  };
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    form.setFieldsValue(saved);
  }, [form, saved]);

  useEffect(() => {
    aiForm.setFieldsValue({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      models: config.models.join('\n'),
      defaultModel: config.defaultModel,
      autoExecute: config.autoExecute,
      streamOutput: config.streamOutput,
      maxTurns: config.maxTurns,
    });
  }, [aiForm, config]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      setSaved(values);
      message.success(t('settings.settings_saved'));
    } catch {
      // validation failed
    }
  };

  const handleSaveAI = async () => {
    try {
      const values = await aiForm.validateFields();
      updateConfig({
        apiUrl: values.apiUrl,
        apiKey: values.apiKey,
        models: values.models.split('\n').map((s: string) => s.trim()).filter(Boolean),
        defaultModel: values.defaultModel,
        autoExecute: values.autoExecute,
        streamOutput: values.streamOutput,
        maxTurns: values.maxTurns,
      });
      message.success(t('settings.ai_saved'));
    } catch {
      // validation failed
    }
  };

  const handleFetchAIModels = async () => {
    const apiUrl = aiForm.getFieldValue('apiUrl');
    const apiKey = aiForm.getFieldValue('apiKey');
    if (!apiUrl) return message.warning(t('settings.ai_fetch_models_hint'));
    setFetchingAi(true);
    try {
      const url = `${apiUrl.replace(/\/$/, '')}/models`;
      const headers: Record<string, string> = {};
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      // 通过 Tauri Rust 后端转发，绕过 CORS
      const result = await tauriInvoke<{ status: number; body: unknown }>('api_request', {
        url,
        method: 'GET',
        headers,
      });

      if (result.status >= 400) throw new Error(`HTTP ${result.status}`);
      const json = result.body as { data?: { id: string }[] };
      const ids: string[] = (json.data || []).map((m: { id: string }) => m.id).filter(Boolean);
      if (ids.length === 0) throw new Error(t('settings.ai_fetch_models_no_models'));
      aiForm.setFieldsValue({ models: ids.join('\n'), defaultModel: ids[0] });
      message.success(t('settings.ai_fetch_models_success', { count: ids.length }));
    } catch (e) {
      message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setFetchingAi(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      await exportEncryptedLogs();
      message.success(t('settings.logs_exported'));
    } catch (e) {
      message.info(String(e instanceof Error ? e.message : e));
    }
  };

  const handleDevSave = () => {
    // 解析完整 URL，分离 host 和 port
    let url = devApiUrl.replace(/\/+$/, '');
    if (url.includes('://')) {
      const parsed = new URL(url);
      devConfig.host = url;
      devConfig.port = parsed.port || '80';
    } else if (url.includes(':')) {
      const [h, p] = url.split(':');
      devConfig.host = h;
      devConfig.port = p;
    } else {
      devConfig.host = url;
      devConfig.port = '80';
    }
    message.success(t('settings.dev_saved'));
  };

  const handleTitleClick = () => {
    const next = clickCount + 1;
    setClickCount(next);
    if (next >= 5) {
      setClickCount(0);
      setPwdOpen(true);
      setPwdInput('');
      setPwdError('');
    }
  };

  const handlePwdVerify = () => {
    if (pwdInput.trim().toLowerCase() === getDeveloperPassword()) {
      setPwdOpen(false);
      setDevMode(true);
      devConfig.enabled = true;
      message.success(t('settings.dev_mode_on'));
    } else {
      setPwdError(t('settings.dev_pwd_error'));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title" style={{ cursor: 'pointer' }} onClick={handleTitleClick}>{t('settings.title')}</h1>
        <p className="page-subtitle">{t('settings.subtitle')}</p>
      </div>

      <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        {/* 语言选择 */}
        <Card style={{ maxWidth: 560, marginBottom: 16 }}>
          <Form.Item
            label={t('settings.language')}
            extra={t('settings.languageDesc')}
          >
            <Space>
              <Select
                value={lang}
                onChange={(value) => changeLang(value)}
                style={{ width: 200 }}
                options={languages.map((l) => ({ label: l.label, value: l.code }))}
              />
              <Button icon={<UploadOutlined />} onClick={handleImportLanguage}>
                {t('settings.importLanguage')}
              </Button>
            </Space>
          </Form.Item>
          <input
            ref={languageInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleLanguageFileChange}
          />
        </Card>

        {/* 端口配置 */}
        <Card style={{ maxWidth: 560 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={saved}
          requiredMark="optional"
        >
          <Form.Item
            name="ws_port"
            label={t('settings.ws_port')}
            rules={[{ required: true, message: t('settings.ws_port_required') }]}
            extra={t('settings.ws_port_extra')}
          >
            <InputNumber
              min={1024}
              max={65535}
              style={{ width: '100%' }}
              placeholder={t('settings.ws_port_placeholder')}
            />
          </Form.Item>

          <Form.Item
            name="data_interval"
            label={t('settings.data_interval')}
            rules={[{ required: true, message: t('settings.data_interval_required') }]}
            extra={t('settings.data_interval_extra')}
          >
            <InputNumber
              min={100}
              max={60000}
              step={100}
              style={{ width: '100%' }}
              placeholder={t('settings.data_interval_placeholder')}
            />
          </Form.Item>

          <Form.Item
            name="auto_start"
            label={t('settings.auto_start')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="log_level"
            label={t('settings.log_level')}
            rules={[{ required: true, message: t('settings.log_level_required') }]}
          >
            <Select
              options={[
                { label: 'ERROR', value: 'ERROR' },
                { label: 'WARN', value: 'WARN' },
                { label: 'INFO', value: 'INFO' },
                { label: 'DEBUG', value: 'DEBUG' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              {t('settings.save_settings')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
      {/* 诊断日志 */}
      <Card style={{ marginTop: 16 }}>
        <Alert
          title={t('settings.diagnostic_logs')}
          description={t('settings.diagnostic_desc')}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginBottom: 12, fontSize: 12, color: '#999' }}>
          {t('settings.current_logs', { count: getLogs().length })}
        </div>
        <Space>
          <Button icon={<BugOutlined />} onClick={handleExportLogs}>
            {t('settings.export_logs')}
          </Button>
        </Space>
      </Card>
      </Col>
      <Col xs={24} md={12}>
      <Card title={<span><RobotOutlined style={{ marginRight: 8 }} />{t('settings.ai_settings')}</span>}>
        <Alert
          title={t('settings.ai_protocol_title')}
          description={
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              {t('common.appName')} <Typography.Text code>OpenAI Chat Completions API</Typography.Text> {t('common.appName')}<br />
              <b>API URL：</b><Typography.Text code>POST {`{apiUrl}/chat/completions`}</Typography.Text><br />
              <b>Auth：</b><Typography.Text code>Authorization: Bearer {`{apiKey}`}</Typography.Text><br />
              <b>Models：</b><Typography.Text code>GET {`{apiUrl}/models`}</Typography.Text><br />
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={aiForm} layout="vertical">
          <Form.Item name="apiUrl" label={t('settings.ai_api_url')} rules={[{ required: true, message: t('settings.ai_api_url_required') }]}>
            <Input placeholder={t('settings.ai_api_url_placeholder')} />
          </Form.Item>
          <Form.Item name="apiKey" label={t('settings.ai_api_key')}>
            <Input.Password placeholder={t('settings.ai_api_key_placeholder')} />
          </Form.Item>
          <Form.Item label={t('settings.ai_models_label')} required>
            <Space orientation="vertical" style={{ width: '100%' }} size={8}>
              <Button size="small" icon={<ReloadOutlined />} loading={fetchingAi} onClick={handleFetchAIModels}>
                {t('settings.ai_fetch_models')}
              </Button>
              <Form.Item name="models" noStyle rules={[{ required: true, message: t('settings.ai_models_required') }]}>
                <Input.TextArea rows={4} placeholder={'deepseek-chat\ndeepseek-coder\ngpt-4o'} />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="defaultModel" label={t('settings.ai_default_model')}>
            <Select
              allowClear
              placeholder={t('settings.ai_default_model_placeholder')}
              options={config.models.map((m) => ({ label: m, value: m }))}
            />
          </Form.Item>
          <Form.Item name="autoExecute" label={t('settings.ai_auto_execute')} valuePropName="checked" extra={t('settings.ai_auto_execute_extra')}>
            <Switch />
          </Form.Item>
          <Form.Item name="streamOutput" label={t('settings.ai_stream_output')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="maxTurns" label={t('settings.ai_max_turns')}>
            <InputNumber min={5} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAI}>
              {t('settings.ai_save')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
      </Col>
      {devMode && (
        <Col xs={24} md={12}>
          <Card title={t('settings.dev_title')}>
            <Alert
              title={t('settings.dev_api_server')}
              description={t('settings.dev_api_desc')}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Space orientation="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{t('settings.dev_server_addr')}</div>
                <Input
                  value={devApiUrl}
                  onChange={(e) => setDevApiUrl(e.target.value)}
                  placeholder={t('settings.dev_server_placeholder')}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>
                {t('settings.dev_current')}：<code>{appConfig.apiBaseUrl}</code>
              </div>
              <Space>
                <Button type="primary" onClick={handleDevSave}>{t('settings.dev_save')}</Button>
                <Button onClick={() => { setDevMode(false); devConfig.enabled = false; }}>{t('settings.dev_close')}</Button>
              </Space>
            </Space>
          </Card>
        </Col>
      )}
      </Row>

      {/* 开发者密码验证弹窗 */}
      <Modal
        title={t('settings.dev_pwd_title')}
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={handlePwdVerify}
        okText={t('settings.dev_pwd_verify')}
        width={360}
      >
        <div style={{ marginBottom: 12 }}>
          <Input.Password
            value={pwdInput}
            onChange={(e) => setPwdInput(e.target.value)}
            placeholder={t('settings.dev_pwd_placeholder')}
            onPressEnter={handlePwdVerify}
            status={pwdError ? 'error' : undefined}
            autoFocus
          />
          {pwdError && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{pwdError}</div>}
        </div>
        <div style={{ fontSize: 12, color: '#999' }}>
          {t('settings.dev_pwd_hint')}
        </div>
      </Modal>
    </div>
  );
}