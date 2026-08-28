import type { EditorWidget } from '../../types';
import { useTranslation } from 'react-i18next';

export default function MediaWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const showProgress = (v.showProgress as boolean) ?? true;

  return (
    <div className="cw-media">
      <div className="cw-media-art">
        <div className="cw-media-cover">
          <div className="cw-media-cover-inner" />
        </div>
      </div>
      <div className="cw-media-main">
        <div className="cw-media-marquee">
          <span className="cw-media-text">{widget.label || t('common.widgets.notPlaying')}</span>
          <span className="cw-media-sep"> - </span>
          <span className="cw-media-text">ailinkcat</span>
        </div>
        {showProgress && (
          <div className="cw-media-row">
            <span className="cw-media-tag">1:23</span>
            <div className="cw-media-bar"><div className="cw-media-fill" style={{ width: '35%' }} /></div>
            <span className="cw-media-tag">4:15</span>
          </div>
        )}
        <div className="cw-media-row cw-media-ctrls">
          <span className="cw-media-btn cw-media-skip">{'⏮'}</span>
          <span className="cw-media-play-wrap">
            <span className="cw-media-play-icon">{'▶'}</span>
          </span>
          <span className="cw-media-btn cw-media-skip">{'⏭'}</span>
        </div>
      </div>
    </div>
  );
}