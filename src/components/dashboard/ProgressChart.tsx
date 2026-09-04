'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ConceptMastery } from '@/lib/types';

// Color-codes bars by mastery band rather than one flat color — this is what
// makes a heatmap-style read possible at a glance (red clusters = where a
// student/class is struggling) without a legend or a second look.
function colorFor(score: number) {
  if (score >= 70) return '#1F8A5F'; // leaf — solid
  if (score >= 45) return '#E28A2B'; // saffron — shaky
  return '#DC2626'; // red — weak
}

export function ProgressChart({ conceptMastery }: { conceptMastery: ConceptMastery[] }) {
  const data = [...conceptMastery]
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 12) // weakest first, capped so the chart stays readable
    .map((c) => ({ name: c.concept, score: c.masteryScore, subject: c.subject }));

  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink/50">
        No concept-level data yet — this fills in once quizzes have been taken.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 18) + '…' : v)}
        />
        <Tooltip
          formatter={(value: number) => [`${value}/100`, 'Mastery']}
          labelFormatter={(label: string) => label}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={colorFor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
