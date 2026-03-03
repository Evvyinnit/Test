import React from 'react';
import { getAvatarBorderById } from '../utils/levelSystem';

/**
 * AvatarWithBorder
 * - borderId controls the fancy border style.
 * - size is a Tailwind size class or a number (px). If number, we set inline width/height.
 */
export default function AvatarWithBorder({
  src,
  alt = 'Avatar',
  borderId,
  size = 40,
  className = '',
  imgClassName = '',
  fallbackIcon = 'person'
}) {
  const border = getAvatarBorderById(borderId);
  const numeric = typeof size === 'number';
  const outerStyle = {
    ...(border?.style?.backgroundImage ? { backgroundImage: border.style.backgroundImage } : {}),
    ...(border?.style?.boxShadow ? { boxShadow: border.style.boxShadow } : {}),
    ...(numeric ? { width: size, height: size } : {})
  };

  const outerClass =
    `relative rounded-full p-[3px] ${border?.style?.className || ''} ${numeric ? '' : size} ${className}`;

  const innerStyle = numeric ? { width: '100%', height: '100%' } : {};
  const innerClass = `rounded-full overflow-hidden bg-black/40 w-full h-full`;

  return (
    <div className={outerClass} style={outerStyle} aria-label={border?.name ? `Avatar border: ${border.name}` : 'Avatar'}>
      <div className={innerClass} style={innerStyle}>
        {src ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover ${imgClassName}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <span className="material-icons-outlined" style={{ fontSize: numeric ? Math.max(16, Math.floor(size * 0.55)) : 22 }}>
              {fallbackIcon}
            </span>
          </div>
        )}
      </div>
      {border?.style?.sparkle && (
        <div className="pointer-events-none absolute inset-0 rounded-full opacity-70 mix-blend-screen">
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-white/80 rounded-full blur-[1px] animate-pulse" />
          <div className="absolute top-2 right-1 w-1.5 h-1.5 bg-white/70 rounded-full blur-[1px] animate-pulse" />
          <div className="absolute bottom-1 left-3 w-1 h-1 bg-white/70 rounded-full blur-[1px] animate-pulse" />
        </div>
      )}
    </div>
  );
}
