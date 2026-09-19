export interface UploadRecord {
  id: string;
  theme_id: string;
  theme_name: string;
  version: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  hash: string;
  size: number;
  category: string;
  tags: string[];
  description: string;
  screenshots: string[];
  review_comment?: string;
}
