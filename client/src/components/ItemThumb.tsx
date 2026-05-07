import type { Item } from "@shared/schema";

// SVG silhouettes per category. Color fills with item.colorHex.
function ShirtSilhouette({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path
        d="M30 20 L40 16 L45 22 Q50 28 55 22 L60 16 L70 20 L82 30 L74 38 L70 35 L70 82 L30 82 L30 35 L26 38 L18 30 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.6"
      />
    </svg>
  );
}
function PantsSilhouette({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path
        d="M30 18 L70 18 L72 38 L66 84 L54 84 L50 50 L46 84 L34 84 L28 38 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.6"
      />
    </svg>
  );
}
function ShoesSilhouette({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path
        d="M14 60 Q20 50 36 50 L62 50 Q78 50 84 56 Q88 60 84 66 L82 72 Q80 76 70 76 L20 76 Q14 76 14 70 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.6"
      />
      <path d="M40 50 L42 56 M50 50 L52 56" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
    </svg>
  );
}
function SocksSilhouette({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path
        d="M40 16 L60 16 L60 60 L72 70 L72 80 L46 80 L40 72 L40 60 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.6"
      />
      <rect x="40" y="22" width="20" height="2" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}
function WatchSilhouette({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="42" y="22" width="16" height="6" fill={fill} opacity="0.6" />
      <rect x="42" y="72" width="16" height="6" fill={fill} opacity="0.6" />
      <circle cx="50" cy="50" r="20" fill={fill} stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="14" fill="rgba(255,255,255,0.85)" />
      <line x1="50" y1="50" x2="50" y2="40" stroke="rgba(0,0,0,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="50" y1="50" x2="58" y2="52" stroke="rgba(0,0,0,0.7)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function AccessorySilhouette({ fill, name }: { fill: string; name: string }) {
  // tie vs belt vs blazer
  if (/blazer/i.test(name)) {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path
          d="M28 20 L42 16 L50 32 L58 16 L72 20 L80 36 L74 84 L26 84 L20 36 Z"
          fill={fill}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="0.6"
        />
        <path d="M50 32 L46 84 M50 32 L54 84" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      </svg>
    );
  }
  if (/belt/i.test(name)) {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <rect x="10" y="44" width="80" height="12" fill={fill} stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
        <rect x="42" y="40" width="14" height="20" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      </svg>
    );
  }
  // tie
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path
        d="M44 18 L56 18 L60 30 L54 36 L62 80 L50 90 L38 80 L46 36 L40 30 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.6"
      />
    </svg>
  );
}

export function ItemThumb({ item }: { item: Item }) {
  if (item.imagePath) {
    return (
      <img
        src={`/api/images/${item.imagePath}`}
        alt={item.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    );
  }
  const fill = item.colorHex;
  const props = { fill };
  switch (item.category) {
    case "shirt":
      return <ShirtSilhouette {...props} />;
    case "pants":
      return <PantsSilhouette {...props} />;
    case "shoes":
      return <ShoesSilhouette {...props} />;
    case "socks":
      return <SocksSilhouette {...props} />;
    case "watch":
      return <WatchSilhouette {...props} />;
    case "accessory":
      return <AccessorySilhouette fill={fill} name={item.name} />;
    default:
      return null;
  }
}
