import { useState } from 'react';
import { Modal, Form, Input, Switch, InputNumber, Button, Space, Typography, message, Alert } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useAIStore } from '../../../../store/aiStore';

const { Text } = Typography;

export default function AIPanelSettings() {
  const { settingsOpen, toggleSettings, config, updateConfig, model, setModel } = useAIStore();
  const [form] = Form.useForm();
  const [fetching, setFetching] = useState(false);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const models = values.models.split('\n').map((s: string) => s.trim()).filter(Boolean);
      updateConfig({
        apiUrl: values.apiUrl,
        apiKey: values.apiKey,
        models,
        autoExecute: values.autoExecute,
        streamOutput: values.streamOutput,
        maxTurns: values.maxTurns,
      });
      setModel(models.includes(values.defaultModel) ? values.defaultModel : model);
      message.success('AI 设置已保存');
      toggleSettings();
    } catch { /* validation */ }
  };

  const handleFetchModels = async () => {
    const apiUrl = form.getFieldValue('apiUrl');
    const apiKey = form.getFieldValue('apiKey');
    if (!apiUrl) return message.warning('请先填写 API 地址');
    setFetching(true);
    try {
      const url = `${apiUrl.replace(/\/$/, '')}/models`;
      const resp = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const ids: string[] = (json.data || []).map((m: { id: string }) => m.id).filter(Boolean);
      if (ids.length === 0) throw new Error('未找到模型列表');
      form.setFieldsValue({
        models: ids.join('\n'),
        defaultModel: ids[0],
      });
      message.success(`已获取 ${ids.length} 个模型`);
    } catch (e) {
      message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setFetching(false);
    }
  };

  return (
    <Modal title="AI 设置" open={settingsOpen} onCancel={toggleSettings} onOk={handleSave} width={520} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          models: config.models.join('\n'),
          defaultModel: config.defaultModel,
          autoExecute: config.autoExecute,
          streamOutput: config.streamOutput,
          maxTurns: config.maxTurns,
        }}
      >
        <Alert
          message="AI 对接协议说明"
          description={
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              本系统使用 <Text code>OpenAI Chat Completions API</Text> 兼容协议。<br />
              支持任何提供该接口的 AI 服务（DeepSeek、OpenAI、Anthropic 等）。<br />
              <b>接口地址：</b><Text code>POST {`{apiUrl}/chat/completions`}</Text><br />
              <b>认证方式：</b><Text code>Authorization: Bearer {`{apiKey}`}</Text><br />
              <b>模型列表：</b><Text code>GET {`{apiUrl}/models`}</Text>（自动拉取）<br />
              <b>多轮对话：</b>支持 system/user/assistant 角色，自动截断历史<br />
              <b>流式输出：</b>支持 SSE（Server-Sent Events）流式响应<br />
              <b>Body 参数：</b><Text code>{`{ model, messages, stream, temperature }`}</Text>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form.Item name="apiUrl" label="API 地址" rules={[{ required: true, message: '请输入 API 地址' }]}>
          <Input placeholder="https://api.deepseek.com/v1" />
        </Form.Item>
        <Form.Item name="apiKey" label="API Key">
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item label="模型列表" required>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Button size="small" icon={<ReloadOutlined />} loading={fetching} onClick={handleFetchModels}>
              从 API 获取模型列表
            </Button>
            <Form.Item name="models" noStyle rules={[{ required: true, message: '请至少添加一个模型' }]}>
              <Input.TextArea rows={4} placeholder={'deepseek-chat\ndeepseek-coder\ngpt-4o'} />
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item name="defaultModel" label="默认模型">
          <Input placeholder="deepseek-chat" />
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
      </Form>
    </Modal>
  );
}