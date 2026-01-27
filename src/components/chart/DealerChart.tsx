"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type CorporateJob = {
  id: string;
  totalPrice?: number;
  commissionRate?: number;
};

export function ChartBar({ data }: { data: CorporateJob[] }) {
  const chart_data = data.map((job) => ({
    name: job.id.trim().length > 10 ? job.id.slice(0, 10) + "..." : job.id,
    value: job.totalPrice! * (job.commissionRate! / 100) || 0,
  }));

  return (
    <div className="w-full min-w-0 h-[250px] min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chart_data}
          margin={{
            top: 5,
            right: 8,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(value) => [value + " tl", ""]} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="value" barSize={32} fill="#8884d8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
