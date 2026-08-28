import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Modal, Form, Input, Switch, InputNumber, Button, Space, Typography, Alert } from 'antd';
import { message } from '../../../../utils/message';
import { ReloadOutlined } from '@ant-design/icons';
import { useAIStore } from '../../../../store/aiStore';

const { Text } = Typography;

export default function AIPanelSettings() {
  const { t } = useTranslation();
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
      message.success(t('editor.aiPanel.settingsSaved'));
      toggleSettings();
    } catch { /* validation */ }
  };

  const handleFetchModels = async () => {
    const apiUrl = form.getFieldValue('apiUrl');
    const apiKey = form.getFieldValue('apiKey');
    if (!apiUrl) return message.warning(t('editor.aiPanel.fetchHint'));
    setFetching(true);
    try {
      const url = `${apiUrl.replace(/\/$/, '')}/models`;
      const resp = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const ids: string[] = (json.data || []).map((m: { id: string }) => m.id).filter(Boolean);
      if (ids.length === 0) throw new Error(t('editor.aiPanel.fetchNoModels'));
      form.setFieldsValue({
        models: ids.join('\n'),
        defaultModel: ids[0],
      });
      message.success(t('editor.aiPanel.fetchSuccess', { count: ids.length }));
    } catch (e) {
      message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setFetching(false);
    }
  };

  return (
    <Modal title={t('editor.aiPanel.settingsTitle')} open={settingsOpen} onCancel={toggleSettings} onOk={handleSave} width={520} destroyOnHidden>
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
          title={t('editor.aiPanel.protocolTitle')}
          description={
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              {t('editor.aiPanel.protocolDesc', { code1: 'OpenAI Chat Completions API' })}<br />
              {t('editor.aiPanel.protocolDesc2')}<br />
              <b>{t('editor.aiPanel.protocolEndpoint')}</b><Text code>POST {`{apiUrl}/chat/completions`}</Text><br />
              <b>{t('editor.aiPanel.protocolAuth')}</b><Text code>Authorization: Bearer {`{apiKey}`}</Text><br />
              <b>{t('editor.aiPanel.protocolModels')}</b><Text code>GET {`{apiUrl}/models`}</Text>（{t('editor.aiPanel.fetchModels')}）<br />
              <b>{t('editor.aiPanel.protocolMultiTurn')}</b>{t('editor.aiPanel.protocolMultiTurnDesc')}<br />
              <b>{t('editor.aiPanel.protocolStream')}</b>{t('editor.aiPanel.protocolStreamDesc')}<br />
              <b>{t('editor.aiPanel.protocolBody')}</b><Text code>{`{ model, messages, stream, temperature }`}</Text>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form.Item name="apiUrl" label={t('editor.aiPanel.apiUrl')} rules={[{ required: true, message: t('editor.aiPanel.apiUrlRequired') }]}>
          <Input placeholder={t('editor.aiPanel.apiUrlPlaceholder')} />
        </Form.Item>
        <Form.Item name="apiKey" label={t('editor.aiPanel.apiKey')}>
          <Input.Password placeholder={t('editor.aiPanel.apiKeyPlaceholder')} />
        </Form.Item>
        <Form.Item label={t('editor.aiPanel.modelList')} required>
          <Space orientation="vertical" style={{ width: '100%' }} size={8}>
            <Button size="small" icon={<ReloadOutlined />} loading={fetching} onClick={handleFetchModels}>
              {t('editor.aiPanel.fetchModels')}
            </Button>
            <Form.Item name="models" noStyle rules={[{ required: true, message: t('editor.aiPanel.modelsRequired') }]}>
              <Input.TextArea rows={4} placeholder={t('editor.aiPanel.modelsPlaceholder')} />
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item name="defaultModel" label={t('editor.aiPanel.defaultModel')}>
          <Input placeholder={t('editor.aiPanel.defaultModelPlaceholder')} />
        </Form.Item>
        <Form.Item name="autoExecute" label={t('editor.aiPanel.autoExecute')} valuePropName="checked" extra={t('editor.aiPanel.autoExecuteExtra')}>
          <Switch />
        </Form.Item>
        <Form.Item name="streamOutput" label={t('editor.aiPanel.streamOutput')} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="maxTurns" label={t('editor.aiPanel.maxTurns')}>
          <InputNumber min={5} max={100} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}