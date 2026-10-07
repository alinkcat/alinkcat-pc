import type { EditorWidget } from '../../types';

export default function CardWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const cardTitle = (v.cardTitle as string) || '';
  const cardDesc = (v.cardDesc as string) || '';
  const cardImage = (v.cardImage as string) || '';
  const cardImagePosition = (v.cardImagePosition as string) || 'top';
  const cardTags = (v.cardTags as string[]) || [];
  const cardFooter = (v.cardFooter as string) || '';
  const br = (widget.borderRadius as number) ?? 6;
  const bg = (widget.backgroundColor as string) || '#f0f2f5';
  const textColor = (widget.textColor as string) || '#333333';
  const fontSize = (widget.fontSize as number) || 12;

  const containerStyle: React.CSSProperties = {
    borderRadius: br,
    background: bg,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: cardImagePosition === 'top' ? 'column' : 'row',
    height: '100%',
    width: '100%',
  };

  const imageStyle: React.CSSProperties = {
    objectFit: 'cover',
    width: cardImagePosition === 'top' ? '100%' : '40%',
    height: cardImagePosition === 'top' ? '50%' : '100%',
    flexShrink: 0,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: Math.max(fontSize, 14),
    fontWeight: 'bold',
    color: textColor,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: 4,
  };

  const descStyle: React.CSSProperties = {
    fontSize,
    color: textColor,
    opacity: 0.75,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
    flex: 1,
    marginBottom: 4,
  };

  const tagsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 4,
  };

  const tagStyle: React.CSSProperties = {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 10,
    background: textColor + '22',
    color: textColor,
    whiteSpace: 'nowrap',
  };

  const footerStyle: React.CSSProperties = {
    fontSize: fontSize - 2,
    color: textColor,
    opacity: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const orderContent = cardImagePosition === 'top' ? undefined : cardImagePosition === 'left' ? 1 : 0;
  const orderImage = cardImagePosition === 'left' ? 0 : 1;

  return (
    <div style={containerStyle}>
      {/* image area */}
      <div style={{ ...imageStyle, order: orderImage }}>
        {cardImage ? (
          <img src={cardImage} alt={cardTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: textColor + '11',
            fontSize: 24,
          }}>
            📷
          </div>
        )}
      </div>

      {/* text content area */}
      <div style={{ ...contentStyle, order: orderContent }}>
        {cardTitle && <div style={titleStyle}>{cardTitle}</div>}
        {cardDesc && <div style={descStyle}>{cardDesc}</div>}
        {cardTags.length > 0 && (
          <div style={tagsStyle}>
            {cardTags.map((tag, i) => (
              <span key={i} style={tagStyle}>{tag}</span>
            ))}
          </div>
        )}
        {cardFooter && <div style={footerStyle}>{cardFooter}</div>}
      </div>
    </div>
  );
}