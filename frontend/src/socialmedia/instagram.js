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
  TrendingUp,
  Activity,
  ArrowUp,
  ArrowDown,
  Filter,
  ChevronDown,
  Search,
  Calendar,
  Layers,
  ListFilter,
  Trophy,
  RefreshCw,
  Download,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ─── Change this to your live backend URL ──────────────────────────────────
const API_BASE = "https://marking-avi-islands-atmosphere.trycloudflare.com";

/* -------------------------
   KPI CARD
------------------------- */
const KPI = ({ label, value, color, icon: Icon, trend, caption, link }) => (
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
        <div className="text-[9px] leading-tight text-gray-500 mt-1 line-clamp-2 font-medium pr-2 h-6" title={caption}>
          {caption}
        </div>
      )}
      {trend && (
        <div className={`text-xs font-bold mt-1 flex items-center ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
          {trend > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-[9px] text-[#E1306C] hover:underline mt-1 block font-bold pdf-hide"
        >
          View Post →
        </a>
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
  const [selectedHandles, setSelectedHandles] = useState([]);
  const [timeRange, setTimeRange] = useState("All Time");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [topN, setTopN] = useState(20);
  const [postType, setPostType] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "likes", direction: "desc" });
  const dropdownRef = useRef(null);
  const dashboardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

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
    // All Time (All or Normal)
    return { fromDate: "", toDate: "" };
  }, [timeRange, customStartDate, customEndDate]);

  /* ── fetch from backend whenever filters change ──────────────────────────── */
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedHandles.length > 0) {
        params.set("handle", selectedHandles.join(","));
      }
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
  }, [selectedHandles, fromDate, toDate, postType, topN]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  /* ── destructure ─────────────────────────────────────────────────────────── */
  const { accounts, kpi, charts, topPosts } = data;

  /* ── filtered accounts for search dropdown ───────────────────────────────── */
  const filteredAccounts = useMemo(
    () => accounts.filter((a) => a.handle.toLowerCase().includes(searchTerm.toLowerCase())),
    [accounts, searchTerm]
  );

  const handleAccountToggle = (handle) => {
    setSelectedHandles((prev) => {
      if (prev.includes(handle)) return prev.filter((h) => h !== handle);
      return [...prev, handle];
    });
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedPosts = useMemo(() => {
    let sortableItems = [...topPosts];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (typeof valA === "string") {
          return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      });
    }
    return sortableItems;
  }, [topPosts, sortConfig]);
  const downloadPDF = async () => {
    if (!dashboardRef.current) return;
    setDownloading(true);
    try {
      const element = dashboardRef.current;

      // 1. Force a fixed width and style for the capture to prevent responsive shifts
      const originalStyle = element.style.cssText;
      element.style.width = "1200px";
      element.style.maxWidth = "none";
      element.style.overflow = "visible";

      // 2. Hide buttons and filter bar for a clean report
      const toHide = element.querySelectorAll("button, .pdf-hide");
      toHide.forEach(el => el.style.visibility = "hidden");

      // 3. Small delay to let charts re-adjust to the new width
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 2, // 2 is usually plenty for fixed-width 1200px
        useCORS: true,
        logging: false,
        backgroundColor: "#f9fafb",
        width: 1200,
        height: element.scrollHeight,
        windowWidth: 1200,
        y: 0,
        scrollX: 0,
        scrollY: 0
      });

      // 4. Restore original styles and visibility
      element.style.cssText = originalStyle;
      toHide.forEach(el => el.style.visibility = "visible");

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const canvasImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = canvasImgHeight;
      let position = 0;

      // Add pages correctly
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, canvasImgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - canvasImgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, canvasImgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Instagram_Performance_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Check console for details.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div ref={dashboardRef} className="p-2 md:p-6 bg-gray-50 min-h-screen text-gray-800 w-full max-w-full overflow-x-hidden">
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-3xl font-bold text-[#E1306C] flex items-center gap-2">
            <Instagram /> Instagram Party In-House Tracking Tool
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#E1306C] transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              onClick={downloadPDF}
              disabled={downloading || loading}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#E1306C] transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Download size={14} className={downloading ? "animate-pulse" : ""} />
              {downloading ? "Generating PDF..." : "Download Report"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* FILTERS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pdf-hide">

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
                    {selectedHandles.length === 0
                      ? `All Accounts (${accounts.length})`
                      : `${selectedHandles.length} Selected`}
                  </span>
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden flex flex-col z-40">
                <div className="p-2 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 mb-2">
                    <Search size={14} className="text-gray-400 mr-2" />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      className="w-full text-sm outline-none text-gray-700 placeholder-gray-400"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedHandles(accounts.map(a => a.handle))}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedHandles([])}
                      className="text-xs text-red-600 hover:underline font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  {filteredAccounts.map((acc) => (
                    <div
                      key={acc.handle}
                      onClick={() => handleAccountToggle(acc.handle)}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer text-sm mb-1"
                    >
                      <input
                        type="checkbox"
                        checked={selectedHandles.includes(acc.handle)}
                        readOnly
                        className="mr-2 h-4 w-4 text-[#E1306C] rounded border-gray-300 focus:ring-[#E1306C]"
                      />
                      <span className="truncate">{acc.handle}</span>
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
                  <option>All Time</option>
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
        <KPI label="Most Liked Post" value={kpi.mostLiked.likes.toLocaleString()} color="#FCAF45" icon={Heart} caption={kpi.mostLiked.caption} link={kpi.mostLiked.post_url} />
        <KPI label="Most Commented Post" value={kpi.mostCommented.comments.toLocaleString()} color="#833AB4" icon={MessageCircle} caption={kpi.mostCommented.caption} link={kpi.mostCommented.post_url} />
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
          const maxMetric = Math.max(tp.likes, tp.comments, 1);
          const metrics = [
            { label: "Likes", val: tp.likes, pct: Math.round((tp.likes / maxMetric) * 100), color: "#E1306C" },
            { label: "Comments", val: tp.comments, pct: Math.round((tp.comments / maxMetric) * 100), color: "#833AB4" },
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
                <Bar dataKey="engagement" name="Engagement" fill="url(#contentEngGradient)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profile Rate (single account) */}
        {selectedHandles.length === 1 && (
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
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" angle={-45} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        if (!d) return null;

                        let periodLabel = "Period: " + (label || "N/A");
                        if (String(label).length === 4) periodLabel = "Year: " + label;
                        else if (String(label).length === 7) periodLabel = "Month: " + label;
                        else if (String(label).includes("-") && (d.posts || 0) > 1) {
                          periodLabel = "Week Starting: " + label;
                        }

                        return (
                          <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl text-xs">
                            <div className="font-bold text-gray-800 mb-2 border-b border-gray-50 pb-1">{periodLabel}</div>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-500 font-medium flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-[#E1306C]" /> Total Posts:
                                </span>
                                <span className="font-bold text-gray-900">{(d.posts || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-500 font-medium flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-[#FCAF45]" /> Avg. Eng.:
                                </span>
                                <span className="font-bold text-gray-900">{(d.engagementRate || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-500 font-medium flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-[#833AB4]" /> Best Post:
                                </span>
                                <span className="font-bold text-[#833AB4]">{(d.topPostEng || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line yAxisId="left" type="monotone" dataKey="posts" name="Total Posts" stroke="#E1306C" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "white" }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="engagementRate" name="Avg. Engagement" stroke="#FCAF45" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "white" }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="stepAfter" dataKey="topPostEng" name="Top Post Performance" stroke="#833AB4" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Accounts by Engagement (all accounts) */}
        {selectedHandles.length !== 1 && (
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
        {selectedHandles.length !== 1 && (
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">

        {/* Likes Trend */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Heart size={18} className="text-[#E1306C]" /> Likes Trend
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval="auto" angle={-45} textAnchor="end" height={70} />
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
                          <div>Likes: <span className="font-semibold">{d.likes ? d.likes.toLocaleString() : "0"}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <defs>
                  <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E1306C" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#E1306C" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="likes" stroke="#E1306C" fill="url(#likesGradient)" fillOpacity={1} />
              </AreaChart>
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
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval="auto" angle={-45} textAnchor="end" height={70} />
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
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval="auto" angle={-45} textAnchor="end" height={70} />
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
                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => requestSort('caption')}>
                  <div className="flex items-center gap-1">
                    Post Content {sortConfig.key === 'caption' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => requestSort('handle')}>
                  <div className="flex items-center gap-1">
                    Account {sortConfig.key === 'handle' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => requestSort('type')}>
                  <div className="flex items-center gap-1">
                    Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-100" onClick={() => requestSort('likes')}>
                  <div className="flex items-center justify-end gap-1">
                    Likes {sortConfig.key === 'likes' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-100" onClick={() => requestSort('comments')}>
                  <div className="flex items-center justify-end gap-1">
                    Comments {sortConfig.key === 'comments' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-100" onClick={() => requestSort('engagement')}>
                  <div className="flex items-center justify-end gap-1">
                    Eng {sortConfig.key === 'engagement' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-100" onClick={() => requestSort('date')}>
                  <div className="flex items-center justify-end gap-1">
                    Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
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
              {!loading && sortedPosts.map((post) => (
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
                  <td className="px-4 py-3 text-right text-[#FCAF45] font-bold">{(post.likes + post.comments).toLocaleString()}</td>
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
