import { Button, Tooltip } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import { useFavoriteStore } from '../store/favoriteStore';

interface Props {
  themeId: string;
  size?: 'small' | 'middle' | 'large';
  showLabel?: boolean;
}

export default function FavoriteButton({ themeId, size = 'middle', showLabel = false }: Props) {
  const { favorites, toggle } = useFavoriteStore();
  const active = favorites.includes(themeId);

  return (
    <Tooltip title={active ? '取消收藏' : '收藏'}>
      <Button
        size={size}
        type={active ? 'primary' : 'default'}
        ghost={active}
        icon={active ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
        onClick={(e) => { e.stopPropagation(); toggle(themeId); }}
      >
        {showLabel ? (active ? '已收藏' : '收藏') : undefined}
      </Button>
    </Tooltip>
  );
}
