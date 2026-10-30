'use client'
import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { movingAverage, type TrainingHistory } from '@/lib/evaluation'

const WINDOW = 10

const MONO_TICK = { fill: 'var(--text-3)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }

interface Row {
  step: number
  reward: number
  avg: number
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: Row }>; label?: number }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="tooltip-box">
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Logged step {label}</p>
      <p className="num" style={{ fontSize: 13, color: 'var(--text-1)' }}>reward {row.reward.toFixed(3)}</p>
      <p className="num" style={{ fontSize: 13, color: 'var(--accent)' }}>{WINDOW}-step avg {row.avg.toFixed(3)}</p>
    </div>
  )
}

/**
 * GRPO training reward per logged step, straight from results/grpo_rewards.csv.
 * The y-axis is auto-scaled (rewards go negative), with a zero line.
 */
export default function TrainingRewardChart({ history }: { history: TrainingHistory }) {
  const data: Row[] = useMemo(() => {
    const avg = movingAverage(history.points, WINDOW)
    return history.points.map((p, i) => ({ step: p.step, reward: p.reward, avg: avg[i].reward }))
  }, [history])

  return (
    <div style={{ width: '100%', height: 300 }} role="img" aria-label={`Line chart of GRPO training reward over ${history.stats.n} logged steps, from ${history.stats.min.toFixed(2)} to ${history.stats.max.toFixed(2)}, mean ${history.stats.mean.toFixed(3)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 24, left: 4 }}>
          <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="step"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={MONO_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            label={{ value: 'Training step (logged)', position: 'insideBottom', offset: -12, fill: 'var(--text-3)', fontSize: 12 }}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={MONO_TICK}
            tickFormatter={(v: number) => v.toFixed(1)}
            tickLine={false}
            axisLine={false}
            width={44}
            label={{ value: 'Mean reward', angle: -90, position: 'insideLeft', fill: 'var(--text-3)', fontSize: 12, dx: 4 }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="var(--border-2)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="reward" name="Reward per logged step" stroke="var(--text-4)" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg" name={`${WINDOW}-step moving average`} stroke="var(--accent)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
