import { useEffect, useState } from 'react';
import { Modal, Tree, Typography, Space, Empty } from 'antd';
import { FolderOutlined, FileOutlined, FileImageOutlined, FileTextOutlined } from '@ant-design/icons';
import { tauriInvoke } from '../utils/tauri';

const { Text } = Typography;

interface ThemeFile {
  name: string;
  isDir: boolean;
  size: number;
}

interface TreeNode {
  key: string;
  title: React.ReactNode;
  isLeaf: boolean;
  children?: TreeNode[];
  icon?: React.ReactNode;
  size?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(name: string) {
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp'))
    return <FileImageOutlined style={{ color: '#52c41a' }} />;
  if (name.endsWith('.svg'))
    return <FileImageOutlined style={{ color: '#eb2f96' }} />;
  if (name === 'theme.json')
    return <FileTextOutlined style={{ color: '#4F6EF7' }} />;
  return <FileOutlined style={{ color: '#999' }} />;
}

function buildTree(files: ThemeFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode[]>();

  for (const f of files) {
    const parts = f.name.replace(/\\/g, '/').split('/');
    let parent = root;
    let path = '';
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      path = path ? `${path}/${parts[i]}` : parts[i];

      if (isLast && !f.isDir) {
        // 叶子节点（文件）
        parent.push({
          key: path,
          isLeaf: true,
          title: (
            <Space>
              {getFileIcon(parts[i])}
              <Text>{parts[i]}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{formatSize(f.size)}</Text>
            </Space>
          ),
          size: f.size,
        });
      } else {
        // 中间节点（文件夹）
        let children = map.get(path);
        if (!children) {
          children = [];
          map.set(path, children);
          parent.push({
            key: path,
            isLeaf: false,
            title: (
              <Space>
                <FolderOutlined style={{ color: '#faad14' }} />
                <Text strong>{parts[i]}</Text>
              </Space>
            ),
            children,
          });
        }
        parent = children;
      }
    }
  }
  return root;
}

interface Props {
  themeId: string;
  open: boolean;
  onClose: () => void;
}

export default function ThemeFileManager({ themeId, open, onClose }: Props) {
  const [files, setFiles] = useState<ThemeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const result = await tauriInvoke<ThemeFile[]>('list_theme_files', { id: themeId });
      setFiles(result);
      // 默认展开所有文件夹
      setExpandedKeys(result.filter((f) => f.isDir).map((f) => f.name));
    } catch (e) {
      console.error('Failed to list theme files:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && themeId) fetchFiles();
  }, [open, themeId]);

  const treeData = buildTree(files);
  const totalSize = files.filter((f) => !f.isDir).reduce((s, f) => s + f.size, 0);
  const totalFiles = files.filter((f) => !f.isDir).length;

  return (
    <Modal
      title={`主题文件 - ${themeId}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999' }}>
        共 {totalFiles} 个文件，总计 {formatSize(totalSize)}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
      ) : treeData.length === 0 ? (
        <Empty description="暂无文件" />
      ) : (
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          showLine
          style={{ fontSize: 13 }}
        />
      )}
    </Modal>
  );
}