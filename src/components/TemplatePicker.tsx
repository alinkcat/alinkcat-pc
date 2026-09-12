import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Row, Col, Card, Typography, Empty, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { TEMPLATES } from '../templates';

const { Text } = Typography;

// 模板分类图标
const CATEGORY_EMOJI: Record<string, string> = {
  monitor: '📊',
  clock: '🕐',
  weather: '⛅',
  media: '🎵',
  blank: '🎨',
  minimal: '⚪',
  dark: '🌙',
  gaming: '🎮',
  business: '💼',
  nature: '🌿',
  allround: '🗂️',
  cute: '🌸',
  retro: '📻',
  sports: '🏃',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function TemplatePicker({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 模板加载
  const handleSelect = (templateId: string) => {
    // 通过路由参数传递模板 ID，Editor 检测到后加载
    navigate(`/themes/edit/new?template=${templateId}`);
    onClose();
  };

  const categories = useMemo(() => {
    // 按分类分组
    const map = new Map<string, typeof TEMPLATES>();
    for (const tpl of TEMPLATES) {
      const cat = tpl.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tpl);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <Modal
      title={t('themes.templates.title')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <div style={{ padding: '8px 0' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          {t('themes.templates.subtitle')}
        </Text>
        {categories.map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <Divider titlePlacement="left" plain style={{ margin: '0 0 12px' }}>
              <span>{CATEGORY_EMOJI[cat] || '📦'} {t(`themes.templates.category.${cat}`)}</span>
            </Divider>
            <Row gutter={[12, 12]}>
              {list.map((tpl) => (
                <Col key={tpl.id} xs={12} sm={8} md={6}>
                  <Card
                    hoverable
                    className="template-card"
                    onClick={() => handleSelect(tpl.id)}
                    style={{ textAlign: 'center', cursor: 'pointer', height: '100%' }}
                  >
                    <div style={{ fontSize: 40, marginBottom: 8 }}>
                      {CATEGORY_EMOJI[tpl.category] || '📦'}
                    </div>
                    <div style={{ fontWeight: 600 }}>{tpl.name}</div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      {tpl.description}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
        {categories.length === 0 && <Empty />}
      </div>
    </Modal>
  );
}