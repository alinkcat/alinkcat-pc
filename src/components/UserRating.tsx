import { Rate, Typography, Space, Button } from 'antd';
import { useRatingStore } from '../store/ratingStore';

const { Text } = Typography;

interface Props {
  themeId: string;
  serverRating?: number;
  serverRatingCount?: number;
}

export default function UserRating({ themeId, serverRating = 0, serverRatingCount = 0 }: Props) {
  const { ratings, setRating } = useRatingStore();
  const userRating = ratings[themeId] || 0;

  return (
    <div>
      {serverRating > 0 && (
        <Space style={{ marginBottom: 8 }}>
          <Text type="secondary">综合评分：</Text>
          <Rate disabled allowHalf value={serverRating} style={{ fontSize: 14 }} />
          <Text type="secondary" style={{ fontSize: 13 }}>{serverRating.toFixed(1)} ({serverRatingCount} 人评价)</Text>
        </Space>
      )}
      <div>
        <Space>
          <Text type="secondary">我的评分：</Text>
          <Rate
            allowHalf
            value={userRating}
            onChange={(val) => setRating(themeId, val)}
            style={{ fontSize: 18 }}
          />
          {userRating > 0 && (
            <Button size="small" type="link" onClick={() => setRating(themeId, 0)}>
              取消评分
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}
