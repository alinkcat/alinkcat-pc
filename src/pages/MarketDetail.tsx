import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Spin, Tag, Rate, Typography, Card, Descriptions, Space, Empty, Row, Col, Input, List, Avatar, Divider,
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { themeApi } from '../api/themeApi';
import { commentApi } from '../api/commentApi';
import { versionApi } from '../api/versionApi';
import { useMessage } from '../hooks/useMessage';
import { downloadToQueue } from '../utils/downloadTheme';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import FavoriteButton from '../components/FavoriteButton';
import UserRating from '../components/UserRating';
import type { ThemeItem, ThemeComment, ThemeVersion } from '../api/types';

const { Title, Text, Paragraph } = Typography;

const CATEGORY_LABELS: Record<string, string> = {
  desktop: '桌面', streaming: '直播', office: '办公', gaming: '游戏', other: '其他',
};

function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue},65%,58%), hsl(${(hue + 40) % 360},65%,45%))`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message: msg } = useMessage();
  const [item, setItem] = useState<ThemeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [comments, setComments] = useState<ThemeComment[]>([]);
  const [versions, setVersions] = useState<ThemeVersion[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      themeApi.detail(Number(id)),
      commentApi.list(id),
      versionApi.list(id),
    ]).then(([themeResp, commentResp, versionResp]) => {
      if (themeResp.code === 200 && themeResp.data) setItem(themeResp.data);
      if (commentResp.code === 200) setComments(commentResp.data?.records ?? []);
      if (versionResp.code === 200) setVersions(Array.isArray(versionResp.data) ? versionResp.data : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!item) return;
    setDownloading(true);
    try {
      await downloadToQueue(item);
      msg.success(`「${item.name}」已下载，请在主题包管理页导入`);
    } catch (e) { msg.error(String(e)); }
    finally { setDownloading(false); }
  };

  const handlePostComment = async () => {
    if (!item || !commentText.trim()) return;
    try {
      const resp = await commentApi.create(item.themeId, commentText.trim());
      if (resp.code === 200) {
        msg.success('评论已发布');
        setCommentText('');
        setCommentOpen(false);
        const r = await commentApi.list(item.themeId);
        if (r.code === 200) setComments(r.data?.records ?? []);
      }
    } catch (e) { msg.error(String(e)); }
  };

  if (loading) {
    return <div className="page-container" style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>;
  }

  if (!item) {
    return (
      <div className="page-container">
        <Empty description="主题包不存在或已下架" style={{ padding: '80px 0' }}>
          <Button onClick={() => navigate('/market')}>返回市场</Button>
        </Empty>
      </div>
    );
  }

  const tags = item.tags ? item.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="page-container">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/market')} style={{ marginBottom: 16 }}>返回市场</Button>

      <Card>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={10}>
            <div style={{
              background: coverGradient(item.themeId || item.name),
              height: 280, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {item.ossCoverUrl ? (
                <img src={resolveImageUrl(item.ossCoverUrl)} alt={item.name}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="market-cover-name" style={{ fontSize: 20 }}>{item.name}</span>
              )}
            </div>
          </Col>
          <Col xs={24} md={14}>
            <Title level={3} style={{ marginTop: 0 }}>{item.name}</Title>
            <Space wrap style={{ marginBottom: 8 }}>
              <Tag color="blue">{CATEGORY_LABELS[item.category] || item.category}</Tag>
              <Rate disabled allowHalf value={item.rating} style={{ fontSize: 14 }} />
              <Text type="secondary">({item.ratingCount} 条评分)</Text>
              <Tag>v{item.version}</Tag>
            </Space>
            <Paragraph type="secondary">{item.description || '暂无描述'}</Paragraph>
            <Descriptions column={2} size="small" style={{ margin: '12px 0' }}>
              <Descriptions.Item label="作者">{item.author || '-'}</Descriptions.Item>
              <Descriptions.Item label="大小">{formatFileSize(item.fileSize)}</Descriptions.Item>
              <Descriptions.Item label="下载次数">{item.downloadCount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="浏览次数">{item.viewCount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="发布时间" span={2}>{new Date(item.createdAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            {tags.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>标签：</Text>
                <Space wrap>{tags.map((t) => <Tag key={t}>{t}</Tag>)}</Space>
              </div>
            )}
            <UserRating themeId={item.themeId} serverRating={item.rating} serverRatingCount={item.ratingCount} />
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" icon={<DownloadOutlined />} loading={downloading} onClick={handleDownload}>下载</Button>
              <FavoriteButton themeId={item.themeId} showLabel />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Version History */}
      {versions.length > 0 && (
        <Card title="版本历史" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={versions}
            renderItem={(v) => (
              <List.Item>
                <List.Item.Meta
                  title={<Space><Tag>v{v.version}</Tag>{v.name}</Space>}
                  description={<Space direction="vertical" size={0}>
                    {v.description && <Text type="secondary">{v.description}</Text>}
                    <Text type="secondary" style={{ fontSize: 12 }}>{new Date(v.createdAt).toLocaleString()} · {formatFileSize(v.fileSize)}</Text>
                  </Space>}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Comments */}
      <Card title="评论区" style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Button type={commentOpen ? 'primary' : 'default'} onClick={() => setCommentOpen(!commentOpen)}>
            {commentOpen ? '取消' : '发表评论'}
          </Button>
        </Space>
        {commentOpen && (
          <div style={{ marginBottom: 16 }}>
            <Input.TextArea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写下你的评价..."
            />
            <Button type="primary" style={{ marginTop: 8 }} onClick={handlePostComment}>发布</Button>
          </div>
        )}
        <Divider />
        {comments.length === 0 ? (
          <Empty description="暂无评论，来发表第一条吧" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={comments}
            renderItem={(c) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar src={c.avatar} style={{ background: '#4F6EF7' }}>{c.username[0]}</Avatar>}
                  title={
                    <Space>
                      <Text strong>{c.username}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{new Date(c.createdAt).toLocaleString()}</Text>
                    </Space>
                  }
                  description={<Text style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}