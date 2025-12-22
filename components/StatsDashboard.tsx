
import React from 'react';
import { BibEntry } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Added onGenerateInsights and isAnalyzing props definitions to the interface to satisfy App.tsx usage
interface StatsDashboardProps {
  data: BibEntry[];
  insights: string;
  onGenerateInsights: () => void;
  isAnalyzing: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Updated component to use all props and added missing default export
const StatsDashboard: React.FC<StatsDashboardProps> = ({ data, insights, onGenerateInsights, isAnalyzing }) => {
    
    // Process Data for Publication Years
    const yearCounts = data.reduce((acc, curr) => {
        acc[curr.publicationYear] = (acc[curr.publicationYear] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);
    
    const yearData = Object.keys(yearCounts).map(year => ({
        year: year,
        count: yearCounts[parseInt(year)]
    })).sort((a, b) => parseInt(a.year) - parseInt(b.year));

    // Process Data for Translator Gender
    const genderCounts = data.reduce((acc, curr) => {
        const g = curr.translator.gender || 'Unknown';
        acc[g] = (acc[g] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const genderData = Object.keys(genderCounts).map(g => ({
        name: g,
        value: genderCounts[g]
    }));

    // Process Source Languages
    const langCounts = data.reduce((acc, curr) => {
        const l = curr.sourceLanguage || 'Unknown';
        acc[l] = (acc[l] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const langData = Object.keys(langCounts).map(l => ({
        name: l,
        value: langCounts[l]
    }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
      
      {/* AI Insights Panel */}
      <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-xl col-span-1 md:col-span-2 flex flex-col md:flex-row items-center gap-8 border border-indigo-800">
        <div className="flex-1 space-y-4">
            <h3 className="text-2xl font-bold serif text-indigo-100 flex items-center gap-3">
                <span className="text-3xl">✨</span>
                AI Scholarly Interpretations
            </h3>
            {insights ? (
                <div className="text-indigo-50 font-serif italic text-lg leading-relaxed whitespace-pre-wrap">
                    {insights}
                </div>
            ) : (
                <p className="text-indigo-300 font-serif italic text-lg">
                    Generate deep academic observations from your corpus data using Gemini.
                </p>
            )}
        </div>
        <button 
            onClick={onGenerateInsights}
            disabled={isAnalyzing || data.length === 0}
            className="px-10 py-5 bg-white text-indigo-900 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-2xl hover:bg-indigo-50 transition-all disabled:opacity-50 shrink-0"
        >
            {isAnalyzing ? "Analyzing Corpus..." : "Generate Insights"}
        </button>
      </div>

      {/* Temporal Distribution */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 col-span-1 md:col-span-2">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Temporal Distribution (Publication Year)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip cursor={{fill: '#f1f5f9'}} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Publications" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Translator Gender Stats */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Translator Demographics</h3>
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {genderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Source Language Stats */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Source Languages</h3>
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={langData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {langData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;
