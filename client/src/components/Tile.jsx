import { tileSrc, tileName } from '../lib.js';

// Widths are tuned per usage; tiles keep the dataset's 77:123 proportions.
const SIZES = {
  xs: 'w-[18px] sm:w-[22px]',
  sm: 'w-[24px] sm:w-[30px]',
  md: 'w-[34px] sm:w-[40px]',
  hand: 'w-[46px] sm:w-[54px] lg:w-[60px]',
};

export default function Tile({ tile, size = 'sm', faceDown = false, selected = false, onClick, glow = false, className = '', animate = '', disabled = false, dim = false }) {
  const down = faceDown || !tile?.key;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={down ? 'Hidden tile' : tileName(tile.key)}
      className={`relative shrink-0 select-none transition-transform duration-150 ${SIZES[size]} ${selected ? '-translate-y-3' : ''} ${onClick && !disabled ? 'cursor-pointer active:scale-95' : ''} ${animate} ${className}`}
    >
      <img src={tileSrc(down ? null : tile.key)} alt="" draggable="false" className={`tile-img ${down ? 'tile-back-img' : ''} ${dim ? 'opacity-60' : ''}`} />
      {glow && <span className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-gold-soft shadow-[0_0_14px_3px_rgba(243,220,155,.7)]" />}
      {selected && <span className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-gold" />}
    </Tag>
  );
}
