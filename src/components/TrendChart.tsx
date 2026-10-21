import { formatDate, formatShortDate } from '../core/dates';

export interface ChartPoint {
  id: string;
  at: string;
  value: number;
  label?: string;
}

export interface ChartSeries {
  id: string;
  label: string;
  points: ChartPoint[];
}

const WIDTH = 760;
const HEIGHT = 300;
const PAD = { top: 22, right: 22, bottom: 38, left: 56 };

export function TrendChart({
  series,
  unit,
  height = 300,
}: {
  series: ChartSeries[];
  unit: string;
  height?: number;
}) {
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) return null;

  const values = allPoints.map((p) => p.value);
  const times = allPoints.map((p) => new Date(p.at).getTime());
  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const padY = (maxY - minY) * 0.12;
  minY -= padY;
  maxY += padY;
  let minX = Math.min(...times);
  let maxX = Math.max(...times);
  if (minX === maxX) {
    minX -= 86400000 * 7;
    maxX += 86400000 * 7;
  }

  const x = (time: number) =>
    PAD.left + ((time - minX) / (maxX - minX)) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + ((maxY - value) / (maxY - minY)) * (HEIGHT - PAD.top - PAD.bottom);

  const ticks = [minY + padY, (minY + maxY) / 2, maxY - padY];
  const dateTicks = [minX, (minX + maxX) / 2, maxX];

  return (
    <div className="chart-wrap">
      <svg
        className="trend-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Observation trend chart with ${allPoints.length} readings, measured in ${unit || 'units'}. A table of the same observations follows.`}
        style={{ height }}
      >
        {ticks.map((tick, index) => (
          <g key={`tick-${index}`}>
            <line
              x1={PAD.left}
              y1={y(tick)}
              x2={WIDTH - PAD.right}
              y2={y(tick)}
              className="chart-grid"
            />
            <text x={PAD.left - 10} y={y(tick) + 4} className="chart-axis" textAnchor="end">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}
        {dateTicks.map((tick, index) => (
          <text
            key={`date-${index}`}
            x={x(tick)}
            y={HEIGHT - 12}
            className="chart-axis"
            textAnchor={index === 0 ? 'start' : index === dateTicks.length - 1 ? 'end' : 'middle'}
          >
            {formatShortDate(new Date(tick).toISOString())}
          </text>
        ))}
        <text x={PAD.left} y={12} className="chart-unit">
          {unit}
        </text>

        {series.map((s, seriesIndex) => {
          const sorted = [...s.points].sort(
            (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
          );
          const path = sorted
            .map((point, index) => {
              const px = x(new Date(point.at).getTime());
              const py = y(point.value);
              return `${index === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
            })
            .join(' ');
          return (
            <g key={s.id} style={{ ['--series' as string]: `var(--chart-${(seriesIndex % 4) + 1})` }}>
              {sorted.length > 1 ? <path d={path} className="chart-line" /> : null}
              {sorted.map((point) => (
                <g key={point.id}>
                  <circle
                    cx={x(new Date(point.at).getTime())}
                    cy={y(point.value)}
                    r={4.2}
                    className="chart-point"
                  >
                    <title>
                      {s.label} · {formatDate(point.at)} · {point.value}
                      {unit ? ` ${unit}` : ''}
                    </title>
                  </circle>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
