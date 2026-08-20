// Mirage mark — a refracted disc: a token dissolving into heat-haze bands,
// jade cooling to amber. Geometry generated from a sheared-circle model.
// `id` must be unique per instance so multiple marks don't share one gradient.
const BANDS: [number, number, number][] = [
  [18.46, 7.72, 23.01],
  [14.05, 13.97, 37.83],
  [12.7, 20.23, 45.15],
  [11.04, 26.48, 48.41],
  [8.69, 32.73, 48.41],
  [7.33, 38.98, 45.15],
  [9.49, 45.23, 37.83],
  [17.98, 51.48, 23.01],
];

export function MarkIcon({
  size = 32,
  id = "mirage-mark",
  className,
}: {
  size?: number;
  id?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Mirage"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#3AEBD0" />
          <stop offset="48%" stopColor="#17B6A6" />
          <stop offset="100%" stopColor="#F2A24A" />
        </linearGradient>
      </defs>
      {BANDS.map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={4.8} rx={2.4} fill={`url(#${id})`} />
      ))}
    </svg>
  );
}
