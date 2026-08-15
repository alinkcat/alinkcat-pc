import { useState, useEffect } from 'react';
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
  message,
} from 'antd';
import { SaveOutlined, RobotOutlined, ReloadOutlined, BugOutlined } from '@ant-design/icons';
import { useAIStore } from '../store/aiStore';
import { exportEncryptedLogs } from '../utils/errorExport';
import { getLogs } from '../utils/logger';
import { devConfig, config as appConfig } from '../config';
import { getDeveloperPassword } from '../utils/md5';
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
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [saved, setSaved] = useState(loadSettings());
  const { config, updateConfig } = useAIStore();
  const [fetchingAi, setFetchingAi] = useState(false);
  const [devMode, setDevMode] = useState(devConfig.enabled);
  const [devApiUrl, setDevApiUrl] = useState(appConfig.apiBaseUrl);
  const [clickCount, setClickCount] = useState(0);
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
      message.success('设置已保存');
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
      message.success('AI 设置已保存');
    } catch {
      // validation failed
    }
  };

  const handleFetchAIModels = async () => {
    const apiUrl = aiForm.getFieldValue('apiUrl');
    const apiKey = aiForm.getFieldValue('apiKey');
    if (!apiUrl) return message.warning('请先填写 API 地址');
    setFetchingAi(true);
    try {
      const url = `${apiUrl.replace(/\/$/, '')}/models`;
      const resp = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const ids: string[] = (json.data || []).map((m: { id: string }) => m.id).filter(Boolean);
      if (ids.length === 0) throw new Error('未找到模型列表');
      aiForm.setFieldsValue({ models: ids.join('\n'), defaultModel: ids[0] });
      message.success(`已获取 ${ids.length} 个模型`);
    } catch (e) {
      message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setFetchingAi(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      await exportEncryptedLogs();
      message.success('诊断日志已导出（已加密）');
    } catch (e) {
      message.info(String(e instanceof Error ? e.message : e));
    }
  };

  const handleDevSave = () => {
    // 解析完整 URL，分离 host 和 port
    let url = devApiUrl.replace(/\/+$/, '');
    if (url.includes('://')) {
      // 完整 URL 格式：http://top.atqx.cn:8080
      const parsed = new URL(url);
      devConfig.host = url;
      devConfig.port = parsed.port || '80';
    } else if (url.includes(':')) {
      // host:port 格式：top.atqx.cn:8080
      const [h, p] = url.split(':');
      devConfig.host = h;
      devConfig.port = p;
    } else {
      // 纯 host 格式：top.atqx.cn
      devConfig.host = url;
      devConfig.port = '80';
    }
    message.success('服务器地址已更新，下次请求生效');
  };

  const handleTitleClick = () => {
    const next = clickCount + 1;
    setClickCount(next);
    if (next >= 5) {
      setClickCount(0);
      // 连续点击 5 次 → 弹出动态密码验证
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
      message.success('开发者模式已开启');
    } else {
      setPwdError('密码错误');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title" style={{ cursor: 'pointer' }} onClick={handleTitleClick}>系统设置</h1>
        <p className="page-subtitle">配置应用偏好和系统参数</p>
      </div>

      <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        {/* 端口配置（短） */}
        <Card style={{ maxWidth: 560 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={saved}
          requiredMark="optional"
        >
          <Form.Item
            name="ws_port"
            label="WebSocket 端口号"
            rules={[{ required: true, message: '请输入端口号' }]}
            extra="修改后需重启服务生效"
          >
            <InputNumber
              min={1024}
              max={65535}
              style={{ width: '100%' }}
              placeholder="9527"
            />
          </Form.Item>

          <Form.Item
            name="data_interval"
            label="数据采集间隔（ms）"
            rules={[{ required: true, message: '请输入采集间隔' }]}
            extra="设备数据上报的最小间隔"
          >
            <InputNumber
              min={100}
              max={60000}
              step={100}
              style={{ width: '100%' }}
              placeholder="1000"
            />
          </Form.Item>

          <Form.Item
            name="auto_start"
            label="开机自启动"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="log_level"
            label="日志级别"
            rules={[{ required: true, message: '请选择日志级别' }]}
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
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
      {/* 诊断日志（短，放在左侧第二行） */}
      <Card style={{ marginTop: 16 }}>
        <Alert
          message="诊断日志"
          description="日志包含错误信息、运行版本和时间戳，导出后请勿随意发送他人，避免信息泄露。请将文件发送给开发者排查问题。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginBottom: 12, fontSize: 12, color: '#999' }}>
          当前捕获 {getLogs().length} 条日志（最多保留 200 条）
        </div>
        <Space>
          <Button icon={<BugOutlined />} onClick={handleExportLogs}>
            导出日志
          </Button>
        </Space>
      </Card>
      </Col>
      <Col xs={24} md={12}>
      <Card title={<span><RobotOutlined style={{ marginRight: 8 }} />AI 设置</span>}>
        <Alert
          message="AI 对接协议说明"
          description={
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              本系统使用 <Typography.Text code>OpenAI Chat Completions API</Typography.Text> 兼容协议。<br />
              支持任何提供该接口的 AI 服务（DeepSeek、OpenAI、Anthropic 等）。<br />
              <b>接口地址：</b><Typography.Text code>POST {`{apiUrl}/chat/completions`}</Typography.Text><br />
              <b>认证方式：</b><Typography.Text code>Authorization: Bearer {`{apiKey}`}</Typography.Text><br />
              <b>模型列表：</b><Typography.Text code>GET {`{apiUrl}/models`}</Typography.Text>（点击按钮自动拉取）<br />
              <b>多轮对话：</b>支持 system/user/assistant 角色，自动截断历史<br />
              <b>流式输出：</b>支持 SSE（Server-Sent Events）流式响应<br />
              <b>Body 参数：</b><Typography.Text code>{`{ model, messages, stream, temperature }`}</Typography.Text>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={aiForm} layout="vertical">
          <Form.Item name="apiUrl" label="API 地址" rules={[{ required: true, message: '请输入 API 地址' }]}>
            <Input placeholder="https://api.deepseek.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Form.Item label="模型列表" required>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Button size="small" icon={<ReloadOutlined />} loading={fetchingAi} onClick={handleFetchAIModels}>
                从 API 获取模型列表
              </Button>
              <Form.Item name="models" noStyle rules={[{ required: true, message: '请至少添加一个模型' }]}>
                <Input.TextArea rows={4} placeholder={'deepseek-chat\ndeepseek-coder\ngpt-4o'} />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="defaultModel" label="默认模型">
            <Select
              allowClear
              placeholder="选择默认模型"
              options={config.models.map((m) => ({ label: m, value: m }))}
            />
          </Form.Item>
          <Form.Item name="autoExecute" label="自动执行指令" valuePropName="checked" extra="开启后跳过 AI 指令确认步骤">
            <Switch />
          </Form.Item>
          <Form.Item name="streamOutput" label="流式输出" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="maxTurns" label="最大对话轮数">
            <InputNumber min={5} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAI}>
              保存 AI 设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
      </Col>
      {devMode && (
        <Col xs={24} md={12}>
          <Card title="🔧 开发者模式">
            <Alert
              message="API 服务器地址"
              description="支持格式：localhost:8080 / top.atqx.cn:8080 / http://top.atqx.cn:8080 / https://api.example.com"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>服务器地址</div>
                <Input
                  value={devApiUrl}
                  onChange={(e) => setDevApiUrl(e.target.value)}
                  placeholder="localhost:8080"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>
                当前解析：<code>{appConfig.apiBaseUrl}</code>
              </div>
              <Space>
                <Button type="primary" onClick={handleDevSave}>保存</Button>
                <Button onClick={() => { setDevMode(false); devConfig.enabled = false; }}>关闭开发者模式</Button>
              </Space>
            </Space>
          </Card>
        </Col>
      )}
      </Row>

      {/* 开发者密码验证弹窗 */}
      <Modal
        title="开发者验证"
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={handlePwdVerify}
        okText="验证"
        width={360}
      >
        <div style={{ marginBottom: 12 }}>
          <Input.Password
            value={pwdInput}
            onChange={(e) => setPwdInput(e.target.value)}
            placeholder="请输入开发者密码"
            onPressEnter={handlePwdVerify}
            status={pwdError ? 'error' : undefined}
            autoFocus
          />
          {pwdError && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{pwdError}</div>}
        </div>
        <div style={{ fontSize: 12, color: '#999' }}>
          请联系开发者获取授权密码。
        </div>
      </Modal>
    </div>
  );
}
