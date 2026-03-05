import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Instagram,
  Users,
  Heart,
  MessageCircle,
  Eye,
  TrendingUp,
  Activity,
  ArrowUp,
  ArrowDown,
  Filter,
  ChevronDown,
  Search,
  Check,
  Calendar,
  Layers,
  ListFilter,
  Trophy,
  RefreshCw,
} from "lucide-react";

// ─── Change this to your live backend URL ──────────────────────────────────
const API_BASE = "https://robert-notify-his-processing.trycloudflare.com";

/* -------------------------
   KPI CARD
------------------------- */
const KPI = ({ label, value, color, icon: Icon, trend, caption }) => (
  <div
    className="bg-white rounded-xl p-4 flex items-center justify-between relative overflow-hidden transition-transform hover:-translate-y-1"
    style={{
      boxShadow: `4px 4px 0px 0px ${color}`,
      border: `2px solid ${color}`,
    }}
  >
    <div className="z-10 flex-1 min-w-0">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-2xl font-black text-gray-800">{value}</div>
      {caption && (
        <div className="text-xs text-gray-500 mt-1 truncate font-medium pr-2" title={caption}>
          {caption}
        </div>
      )}
      {trend && (
        <div className={`text-xs font-bold mt-1 flex items-center ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
          {trend > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    {Icon && (
      <div
        className="p-2 rounded-lg z-10 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)`, color }}
      >
        <Icon size={20} />
      </div>
    )}
    <div
      className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-10 z-0"
      style={{ backgroundColor: color }}
    />
  </div>
);

/* ─── default empty state ─────────────────────────────────────────────────── */
const EMPTY = {
  accounts: [],
  kpi: {
    totalAccounts: 0,
    totalPosts: 0,
    mostLiked: { likes: 0, caption: "N/A", post_url: "" },
    mostCommented: { comments: 0, caption: "N/A", post_url: "" },
  },
  charts: {
    topPostRadarData: [],
    contentPerformance: [],
    activityData: [],
    dailyStats: [],
    topAccountsByEngagement: [],
    topAccountsByPosts: [],
  },
  topPosts: [],
};

export const InstagramTracking = () => {
  /* ── filter state ────────────────────────────────────────────────────────── */
  const [selectedHandle, setSelectedHandle] = useState("All");
  const [timeRange, setTimeRange] = useState("Last 30 Days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [topN, setTopN] = useState(20);
  const [postType, setPostType] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  /* ── data state ──────────────────────────────────────────────────────────── */
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ── close dropdown on outside click ────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── compute fromDate / toDate from timeRange ────────────────────────────── */
  const { fromDate, toDate } = useMemo(() => {
    const today = new Date();
    const fmt = (d) => d.toISOString().split("T")[0];

    if (timeRange === "Last 7 Days") {
      const s = new Date(); s.setDate(today.getDate() - 7);
      return { fromDate: fmt(s), toDate: fmt(today) };
    }
    if (timeRange === "Last 30 Days") {
      const s = new Date(); s.setDate(today.getDate() - 30);
      return { fromDate: fmt(s), toDate: fmt(today) };
    }
    if (timeRange === "This Month") {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { fromDate: fmt(s), toDate: fmt(today) };
    }
    if (timeRange === "Custom") {
      return { fromDate: customStartDate, toDate: customEndDate };
    }
    return { fromDate: "", toDate: "" };
  }, [timeRange, customStartDate, customEndDate]);

  /* ── fetch from backend whenever filters change ──────────────────────────── */
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedHandle && selectedHandle !== "All") params.set("handle", selectedHandle);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (postType !== "All") params.set("postType", postType);
      params.set("topN", topN);

      const res = await fetch(`${API_BASE}/api/instagram/dashboard?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [selectedHandle, fromDate, toDate, postType, topN]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  /* ── destructure ─────────────────────────────────────────────────────────── */
  const { accounts, kpi, charts, topPosts } = data;

  /* ── filtered accounts for search dropdown ───────────────────────────────── */
  const filteredAccounts = useMemo(
    () => accounts.filter((a) => a.handle.toLowerCase().includes(searchTerm.toLowerCase())),
    [accounts, searchTerm]
  );



  return (
    <div className="p-2 md:p-6 bg-gray-50 min-h-screen text-gray-800 w-full max-w-full overflow-x-hidden">
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-3xl font-bold text-[#E1306C] flex items-center gap-2">
            <Instagram /> Instagram Party In-House Tracking Tool
          </h1>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#E1306C] transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* FILTERS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 1. Account Filter */}
          <div className="relative z-30" ref={dropdownRef}>
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
              <Filter size={18} className="text-gray-500" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Account</div>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-gray-700 bg-transparent outline-none"
                >
                  <span className="truncate">
                    {selectedHandle === "All"
                      ? `All Accounts (${accounts.length})`
                      : selectedHandle}
                  </span>
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden flex flex-col z-40">
                <div className="p-2 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1.5">
                    <Search size={14} className="text-gray-400 mr-2" />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      className="w-full text-sm outline-none text-gray-700 placeholder-gray-400"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  <div
                    onClick={() => { setSelectedHandle("All"); setIsDropdownOpen(false); }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm mb-1 ${selectedHandle === "All" ? "bg-pink-50 text-[#E1306C] font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                  >
                    <span>All Accounts</span>
                    {selectedHandle === "All" && <Check size={14} />}
                  </div>
                  {filteredAccounts.map((acc) => (
                    <div
                      key={acc.handle}
                      onClick={() => { setSelectedHandle(acc.handle); setIsDropdownOpen(false); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm mb-1 ${selectedHandle === acc.handle ? "bg-pink-50 text-[#E1306C] font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                    >
                      <span>{acc.handle}</span>
                      {selectedHandle === acc.handle && <Check size={14} />}
                    </div>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">No accounts found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Date Filter */}
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex flex-col justify-center shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-500" />
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Date Range</div>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full text-sm font-medium text-gray-700 bg-transparent outline-none cursor-pointer"
                >
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>This Month</option>
                  <option>Custom</option>
                </select>
              </div>
            </div>
            {timeRange === "Custom" && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                <input
                  type="date" value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded p-1 outline-none focus:border-[#E1306C]"
                />
                <input
                  type="date" value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded p-1 outline-none focus:border-[#E1306C]"
                />
              </div>
            )}
          </div>

          {/* 3. Top Post Range */}
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
            <Layers size={18} className="text-gray-500" />
            <div className="flex-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Top Posts</div>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="w-full text-sm font-medium text-gray-700 bg-transparent outline-none cursor-pointer"
              >
                {[5, 10, 20, 30, 40, 50, 100].map((n) => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Type Filter */}
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
            <ListFilter size={18} className="text-gray-500" />
            <div className="flex-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Post Type</div>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
                className="w-full text-sm font-medium text-gray-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="Reel">Reels</option>
                <option value="Post">Posts</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Active Accounts" value={kpi.totalAccounts.toLocaleString()} color="#E1306C" icon={Users} caption="Accounts that posted in selected range" />
        <KPI label="Total Posts" value={kpi.totalPosts.toLocaleString()} color="#F77737" icon={Activity} />
        <KPI label="Most Liked Post" value={kpi.mostLiked.likes.toLocaleString()} color="#FCAF45" icon={Heart} caption={kpi.mostLiked.caption} />
        <KPI label="Most Commented Post" value={kpi.mostCommented.comments.toLocaleString()} color="#833AB4" icon={MessageCircle} caption={kpi.mostCommented.caption} />
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">

        {/* Top Performing Post — styled card */}
        {(() => {
          const tp = topPosts[0];
          if (!tp) return (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex items-center justify-center text-gray-400 text-sm" style={{ minHeight: 260 }}>
              <span>No data available</span>
            </div>
          );
          const eng = tp.likes + tp.comments;
          const maxMetric = Math.max(tp.likes, tp.comments, tp.views, 1);
          const metrics = [
            { label: "Likes", val: tp.likes, pct: Math.round((tp.likes / maxMetric) * 100), color: "#E1306C" },
            { label: "Comments", val: tp.comments, pct: Math.round((tp.comments / maxMetric) * 100), color: "#833AB4" },
            { label: "Views", val: tp.views, pct: Math.round((tp.views / maxMetric) * 100), color: "#F77737" },
          ];
          return (
            <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: "2px solid #E1306C" }}>
              {/* gradient header */}
              <div style={{ background: "linear-gradient(135deg,#E1306C,#833AB4,#F77737)" }} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-white" />
                  <span className="text-white text-xs font-bold uppercase tracking-wider">Top Performing Post</span>
                </div>
                <span className="text-[10px] text-white/70 font-medium">{tp.type}</span>
              </div>

              {/* body */}
              <div className="bg-white p-4 flex flex-col gap-3">
                {/* account + date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "linear-gradient(135deg,#E1306C,#833AB4)" }}>
                      {tp.handle ? tp.handle[0].toUpperCase() : "?"}
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{tp.handle}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{tp.date}</span>
                </div>

                {/* caption */}
                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                  {tp.caption || "(no caption)"}
                </p>

                {/* mini bar metrics */}
                <div className="flex flex-col gap-2">
                  {metrics.map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between text-[10px] font-semibold mb-0.5">
                        <span className="text-gray-500">{m.label}</span>
                        <span style={{ color: m.color }}>{m.val.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* engagement pill */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400 font-medium">Total Engagement</span>
                  <span className="text-xs font-bold" style={{ color: "#E1306C" }}>{eng.toLocaleString()}</span>
                </div>

                {/* link */}
                {tp.post_url && (
                  <a href={tp.post_url} target="_blank" rel="noreferrer"
                    className="text-[10px] text-center font-semibold py-1.5 rounded-lg text-white block"
                    style={{ background: "linear-gradient(90deg,#E1306C,#833AB4)" }}
                  >
                    View Post →
                  </a>
                )}
              </div>
            </div>
          );
        })()}

        {/* Content Performance — Reels & Posts */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <MessageCircle size={18} className="text-[#E1306C]" /> Content Performance
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.contentPerformance} layout="vertical" margin={{ left: 20 }}>
                <defs>
                  <linearGradient id="contentViewsGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="#F77737" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#F77737" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="contentEngGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="#833AB4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#833AB4" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={60} tick={{ fontSize: 12, fontWeight: 500 }} />
                <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
                <Legend />
                <Bar dataKey="views" name="Views" fill="url(#contentViewsGradient)" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="engagement" name="Engagement" fill="url(#contentEngGradient)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profile Rate (single account) */}
        {selectedHandle !== "All" && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Activity size={18} className="text-[#833AB4]" /> Profile Rate
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="posts" name="Posts/Day" stroke="#E1306C" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="engagementRate" name="Eng. Rate (%)" stroke="#FCAF45" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Accounts by Engagement (all accounts) */}
        {selectedHandle === "All" && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Trophy size={18} className="text-[#FCAF45]" /> Top by Engagement
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.topAccountsByEngagement} layout="vertical" margin={{ left: 0 }}>
                  <defs>
                    <linearGradient id="topAccEngGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="5%" stopColor="#E1306C" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#E1306C" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="handle" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: "transparent" }} />
                  <Bar dataKey="engagement" fill="url(#topAccEngGradient)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Accounts by Posts (all accounts) */}
        {selectedHandle === "All" && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Trophy size={18} className="text-[#833AB4]" /> Top by Postings
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.topAccountsByPosts} layout="vertical" margin={{ left: 0 }}>
                  <defs>
                    <linearGradient id="topAccPostGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="5%" stopColor="#833AB4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#833AB4" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="handle" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: "transparent" }} />
                  <Bar dataKey="posts" fill="url(#topAccPostGradient)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* TREND CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Views Trend */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Eye size={18} className="text-[#833AB4]" /> Views Trend
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                          <div className="font-bold text-gray-700 mb-1">{d.handle}</div>
                          <div className="text-gray-500 mb-1 truncate max-w-[200px]">{d.fullCaption}</div>
                          <div>Views: <span className="font-semibold">{d.views.toLocaleString()}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#833AB4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#833AB4" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <Bar dataKey="views" fill="url(#viewsGradient)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Comments Trend */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <MessageCircle size={18} className="text-[#F77737]" /> Comments Trend
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                          <div className="font-bold text-gray-700 mb-1">{d.handle}</div>
                          <div className="text-gray-500 mb-1 truncate max-w-[200px]">{d.fullCaption}</div>
                          <div>Comments: <span className="font-semibold">{d.comments.toLocaleString()}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <defs>
                  <linearGradient id="commentsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F77737" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#F77737" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="comments" stroke="#F77737" fill="url(#commentsGradient)" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Engagement Trend */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <TrendingUp size={18} className="text-[#FCAF45]" /> Engagement Trend
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                          <div className="font-bold text-gray-700 mb-1">{d.handle}</div>
                          <div className="text-gray-500 mb-1 truncate max-w-[200px]">{d.fullCaption}</div>
                          <div>Engagement: <span className="font-semibold">{d.engagement.toLocaleString()}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <defs>
                  <linearGradient id="engagementTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FCAF45" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#FCAF45" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="engagement" stroke="#FCAF45" fill="url(#engagementTrendGradient)" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* TOP POSTS TABLE */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-700 flex items-center gap-2 text-lg">
            <TrendingUp size={20} className="text-[#E1306C]" /> Top Performing Posts
          </h3>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Sorted by Engagement
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Post Content</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold text-right">Likes</th>
                <th className="px-4 py-3 font-semibold text-right">Comments</th>
                <th className="px-4 py-3 font-semibold text-right">Views</th>
                <th className="px-4 py-3 font-semibold text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw size={18} className="animate-spin inline mr-2" /> Loading data…
                  </td>
                </tr>
              )}
              {!loading && topPosts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No posts found for the selected filters.
                  </td>
                </tr>
              )}
              {!loading && topPosts.map((post) => (
                <tr key={post.id || post.post_url} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-xs">
                    {post.post_url
                      ? <a href={post.post_url} target="_blank" rel="noreferrer" className="hover:text-[#E1306C] hover:underline">{post.caption || "(no caption)"}</a>
                      : (post.caption || "(no caption)")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{post.handle}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${post.type === "Reel" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                      {post.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{post.likes.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{post.comments.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{post.views.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">{post.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
