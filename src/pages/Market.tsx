import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Input, Select, Row, Col, Card, Pagination, Spin, Empty, Button,
  Tag, Rate, Typography, Space,
} from 'antd';
import { SearchOutlined, DownloadOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMarketStore } from '../store/marketStore';
import { useMessage } from '../hooks/useMessage';
import { downloadToQueue } from '../utils/downloadTheme';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import FavoriteButton from '../components/FavoriteButton';

const { Text } = Typography;

function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue},65%,58%), hsl(${(hue + 40) % 360},65%,45%))`;
}

export default function Market() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: msg } = useMessage();
  const { list, total, page, pageSize, category, sortBy, loading, setSearch, setCategory, setSort, setPage, fetchList } = useMarketStore();

  const [inputValue, setInputValue] = useState('');

  const CATEGORY_OPTIONS = [
    { label: t('market.allCategories'), value: '' },
    { label: t('market.category_desktop'), value: 'desktop' },
    { label: t('market.category_streaming'), value: 'streaming' },
    { label: t('market.category_office'), value: 'office' },
    { label: t('market.category_gaming'), value: 'gaming' },
    { label: t('market.category_other'), value: 'other' },
  ];

  const SORT_OPTIONS = [
    { label: t('market.sort_hot'), value: 'downloadCount' },
    { label: t('market.sort_newest'), value: 'createdAt' },
    { label: t('market.sort_rating'), value: 'rating' },
    { label: t('market.sort_views'), value: 'viewCount' },
  ];

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearchChange = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  };

  const handleDownload = async (item: typeof list[0]) => {
    try {
      await downloadToQueue(item);
      msg.success(t('market.downloadedHint', { name: item.name }));
    } catch (e) {
      msg.error(String(e));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1 className="page-title">{t('market.title')}</h1>
        <p className="page-subtitle">{t('market.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0', alignItems: 'center' }}>
        <Input
          placeholder={t('market.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          allowClear
          style={{ maxWidth: 320 }}
        />
        <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} style={{ width: 130 }} />
        <Select value={sortBy} onChange={setSort} options={SORT_OPTIONS} style={{ width: 120 }} />
        <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
          {t('market.refresh')}
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
      ) : list.length === 0 ? (
        <Empty description={t('market.noMatch')} style={{ padding: '60px 0' }} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {list.map((item) => (
              <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  className="market-card"
                  onClick={() => navigate(`/market/${item.id}`)}
                  cover={
                    <div className="market-cover" style={{ background: coverGradient(item.themeId || item.name) }}>
                      {item.ossCoverUrl ? (
                        <img src={resolveImageUrl(item.ossCoverUrl)} alt={item.name}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      ) : null}
                      <span className="market-cover-name">{item.name}</span>
                      <Tag style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.9)', border: 'none' }}>
                        {CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label || item.category}
                      </Tag>
                    </div>
                  }
                >
                  <div className="market-card-title">{item.name}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>v{item.version} - {item.author}</Text>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Rate disabled allowHalf value={item.rating} style={{ fontSize: 12 }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {item.rating > 0 ? `${item.rating} (${item.ratingCount})` : t('market.noRating')}
                    </Text>
                  </div>
                  {item.tags && (
                    <div style={{ marginTop: 6 }}>
                      {item.tags.split(',').slice(0, 3).map((tag) => (
                        <Tag key={tag} style={{ fontSize: 10, marginRight: 4 }}>{tag.trim()}</Tag>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={12}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        <DownloadOutlined /> {(item.downloadCount ?? 0).toLocaleString()}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        <EyeOutlined /> {(item.viewCount ?? 0).toLocaleString()}
                      </Text>
                    </Space>
                    <Space size={4}>
                      <FavoriteButton themeId={item.themeId} size="small" />
                      <Button size="small" icon={<DownloadOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                        {t('market.download')}
                      </Button>
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={setPage}
              showTotal={(total) => t('market.totalCount', { total })}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
