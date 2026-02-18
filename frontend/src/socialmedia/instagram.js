import React, { useState, useMemo, useRef, useEffect } from "react";
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
  PieChart,
  Pie,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Instagram,
  Users,
  Heart,
  MessageCircle,
  Eye,
  TrendingUp,
  Activity,
  Smartphone,
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
} from "lucide-react";

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
      <div className="text-2xl font-black text-gray-800">
        {value}
      </div>
      {caption && (
        <div className="text-xs text-gray-500 mt-1 truncate font-medium pr-2" title={caption}>
          {caption}
        </div>
      )}
      {trend && (
        <div className={`text-xs font-bold mt-1 flex items-center ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    {Icon && (
      <div
        className="p-2 rounded-lg z-10 flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${color}20, ${color}40)`,
          color: color,
        }}
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

export const InstagramTracking = () => {
  const [timeRange, setTimeRange] = useState("Last 30 Days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedHandle, setSelectedHandle] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [topN, setTopN] = useState(20);
  const [postType, setPostType] = useState("All");
  const dropdownRef = useRef(null);

  const COLORS = ["#E1306C", "#F77737", "#FCAF45", "#833AB4", "#405DE6"];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Real Data from Backend
  const [allAccounts, setAllAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // API URL
  const API_BASE_URL = "http://localhost:8000/api/instagram";

  useEffect(() => {
    fetch(`${API_BASE_URL}/all`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllAccounts(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch Instagram data:", err);
        setLoading(false);
      });
  }, []);

  // Filter accounts for dropdown
  const filteredAccounts = useMemo(() => {
    return allAccounts.filter(acc => acc.handle.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allAccounts, searchTerm]);

  // Aggregate or Select Data
  const dashboardData = useMemo(() => {
    let filteredPosts = [];
    let relevantAccounts = [];

    // 1. Filter Accounts
    if (selectedHandle === "All") {
      relevantAccounts = allAccounts;
    } else {
      relevantAccounts = allAccounts.filter(a => a.handle === selectedHandle);
    }

    // 2. Collect posts
    relevantAccounts.forEach(acc => {
      acc.posts.forEach(p => {
        filteredPosts.push({ ...p, handle: acc.handle });
      });
    });

    // 3. Filter by Date
    const now = new Date();
    filteredPosts = filteredPosts.filter(p => {
      const pDate = new Date(p.date);
      const diffDays = (now - pDate) / (1000 * 60 * 60 * 24);

      if (timeRange === "Custom") {
        if (customStartDate && pDate < new Date(customStartDate)) return false;
        if (customEndDate && pDate > new Date(customEndDate)) return false;
        return true;
      }

      if (timeRange === "Last 7 Days") return diffDays <= 7;
      if (timeRange === "Last 30 Days") return diffDays <= 30;
      if (timeRange === "This Month") return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      return true;
    });

    // 4. Filter by Type
    if (postType !== "All") {
      if (postType === "Videos") {
        filteredPosts = filteredPosts.filter(p => p.type === 'Reel' || p.type === 'Video');
      } else if (postType === "Post") {
        filteredPosts = filteredPosts.filter(p => p.type === 'Post' || p.type === 'Carousel');
      }
    }

    // KPI Calculations
    const totalAccounts = relevantAccounts.length;
    const totalPostsCount = filteredPosts.length;

    let mostLikedPost = { likes: 0, caption: "N/A" };
    let mostCommentedPost = { comments: 0, caption: "N/A" };

    filteredPosts.forEach(p => {
      if (p.likes > mostLikedPost.likes) mostLikedPost = p;
      if (p.comments > mostCommentedPost.comments) mostCommentedPost = p;
    });

    // Sort for Top Posts
    const sortedByEngagement = [...filteredPosts].sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments));
    const topPostsSlice = sortedByEngagement.slice(0, topN);

    // Chart Data Generation
    const targetPosts = filteredPosts;

    // 1. Top Post Radar Data (Single Top Post normalized)
    const maxViews = Math.max(...targetPosts.map(p => p.views), 1);
    const maxLikes = Math.max(...targetPosts.map(p => p.likes), 1);
    const maxComments = Math.max(...targetPosts.map(p => p.comments), 1);
    const maxEngagement = Math.max(...targetPosts.map(p => p.likes + p.comments), 1);


    const topPost = topPostsSlice[0];
    const topAccount = topPost ? relevantAccounts.find(a => a.handle === topPost.handle) : null;
    const topFollowers = topAccount ? topAccount.followers : 0;
    const topPostEngagement = topPost ? (topPost.likes + topPost.comments) : 0;
    const topPostRadarData = topPost ? [
      { subject: 'Engagement', value: (topPostEngagement / maxEngagement) * 100, original: topPostEngagement, max: maxEngagement },
      { subject: 'Likes', value: (topPost.likes / maxLikes) * 100, original: topPost.likes, max: maxLikes },
      { subject: 'Comments', value: (topPost.comments / maxComments) * 100, original: topPost.comments, max: maxComments },
    ] : [];

    // 2. Content Performance (Reels and Posts only)
    const typeStats = { 'Reel': 0, 'Post': 0 };
    targetPosts.forEach(p => {
      if (p.type === 'Reel' || p.type === 'Post') {
        typeStats[p.type] += p.views;
      }
    });
    const contentPerformance = Object.keys(typeStats).map(key => ({
      name: key,
      views: typeStats[key],
      engagement: Math.floor(typeStats[key] * 0.1)
    }));

    // 3. Activity (Views/Comments) - Top Posts
    const activityData = topPostsSlice.map(p => ({
      name: p.caption.length > 15 ? p.caption.substring(0, 15) + "..." : p.caption,
      fullCaption: p.caption,
      handle: p.handle,
      views: p.views,
      comments: p.comments,
      likes: p.likes,
      engagement: p.likes + p.comments
    }));

    // 4. Single Account Daily Stats
    const dailyStatsMap = {};

    // Initialize map with all dates in range to ensure continuity
    const fillDateRange = (startDate, endDate) => {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dailyStatsMap[dateStr] = { date: dateStr, posts: 0, engagement: 0, views: 0 };
      }
    };

    const today = new Date();
    if (timeRange === "Last 7 Days") {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      fillDateRange(start, today);
    } else if (timeRange === "Last 30 Days") {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      fillDateRange(start, today);
    } else if (timeRange === "This Month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      fillDateRange(start, today);
    } else if (timeRange === "Custom" && customStartDate && customEndDate) {
      fillDateRange(new Date(customStartDate), new Date(customEndDate));
    }

    targetPosts.forEach(p => {
      if (!dailyStatsMap[p.date]) {
        dailyStatsMap[p.date] = { date: p.date, posts: 0, engagement: 0, views: 0 };
      }
      dailyStatsMap[p.date].posts += 1;
      dailyStatsMap[p.date].engagement += (p.likes + p.comments);
      dailyStatsMap[p.date].views += p.views;
    });
    const dailyStats = Object.values(dailyStatsMap).sort((a, b) => new Date(a.date) - new Date(b.date)).map(d => ({
      date: d.date,
      posts: d.posts,
      engagementRate: d.views > 0 ? parseFloat(((d.engagement / d.views) * 100).toFixed(2)) : 0
    }));

    // 5. Account Leaderboard (All Accounts Only)
    const accountStats = {};
    if (selectedHandle === "All") {
      relevantAccounts.forEach(acc => {
        accountStats[acc.handle] = { handle: acc.handle, engagement: 0, posts: 0 };
      });
      filteredPosts.forEach(p => {
        if (accountStats[p.handle]) {
          accountStats[p.handle].engagement += (p.likes + p.comments);
          accountStats[p.handle].posts += 1;
        }
      });
    }
    const topAccounts = selectedHandle === "All"
      ? Object.values(accountStats).sort((a, b) => b.engagement - a.engagement).slice(0, 5)
      : [];

    const topAccountsByPosts = selectedHandle === "All"
      ? Object.values(accountStats).sort((a, b) => b.posts - a.posts).slice(0, 5)
      : [];

    return {
      kpi: {
        totalAccounts,
        totalPosts: totalPostsCount,
        mostLiked: mostLikedPost,
        mostCommented: mostCommentedPost
      },
      charts: { topPostRadarData, contentPerformance, activityData, dailyStats, topAccounts, topAccountsByPosts },
      topPosts: topPostsSlice
    };
  }, [selectedHandle, allAccounts, timeRange, postType, topN, customStartDate, customEndDate]);

  const { kpi, charts, topPosts } = dashboardData;

  return (
    <div className="p-2 md:p-6 bg-gray-50 min-h-screen text-gray-800 w-full max-w-full overflow-x-hidden">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-xl md:text-3xl font-bold text-[#E1306C] mb-6 flex items-center gap-2">
          <Instagram /> Instagram Party In-House Tracking Tool
        </h1>

        {/* FILTERS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 1. Account Filter */}
          <div className="relative z-30" ref={dropdownRef}>
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm h-full">
              <Filter size={18} className="text-gray-500" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-gray-400 uppercase">Account</div>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-gray-700 bg-transparent outline-none"
                >
                  <span className="truncate">{selectedHandle === "All" ? `All Accounts (${allAccounts.length})` : selectedHandle}</span>
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
                  {filteredAccounts.map(acc => (
                    <div
                      key={acc.id}
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
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded p-1 outline-none focus:border-[#E1306C]"
                />
                <input
                  type="date"
                  value={customEndDate}
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
                {[5, 10, 20, 30, 40, 50, 100].map(n => (
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
                <option value="Videos">Videos</option>
                <option value="Post">Posts</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Accounts" value={kpi.totalAccounts.toLocaleString()} color="#E1306C" icon={Users} />
        <KPI label="Total Posts" value={kpi.totalPosts.toLocaleString()} color="#F77737" icon={Activity} />
        <KPI label="Most Liked Post" value={kpi.mostLiked.likes.toLocaleString()} color="#FCAF45" icon={Heart} caption={kpi.mostLiked.caption} />
        <KPI label="Most Commented Post" value={kpi.mostCommented.comments.toLocaleString()} color="#833AB4" icon={MessageCircle} caption={kpi.mostCommented.caption} />
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">


        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Trophy size={18} className="text-[#FCAF45]" /> Top Performing Post
            </h3>
          </div>
          {topPosts.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={charts.topPostRadarData}>
                  <PolarGrid gridType="circle" stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name={topPosts[0].handle}
                    dataKey="value"
                    stroke="#E1306C"
                    strokeWidth={3}
                    fill="#E1306C"
                    fillOpacity={0.4}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                            <div className="font-bold text-gray-700 mb-1">{d.subject}</div>
                            <div>Value: <span className="font-semibold">{d.original.toLocaleString()}</span></div>
                            <div className="text-gray-400 text-[10px]">Max: {d.max.toLocaleString()}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>

          )}
        </div>

        {/* Chart: Content Performance (Reels & Posts) */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <MessageCircle size={18} className="text-[#E1306C]" /> Content Performance (Reels & Posts)
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
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="views" name="Views" fill="url(#contentViewsGradient)" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="engagement" name="Engagement" fill="url(#contentEngGradient)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart: Profile Rate (Posting & Engagement) */}
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

        {/* Chart: Account Leaderboard (All Accounts Only) */}
        {selectedHandle === "All" && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Trophy size={18} className="text-[#FCAF45]" /> Top Accounts by Engagement
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.topAccounts} layout="vertical" margin={{ left: 0 }}>
                  <defs>
                    <linearGradient id="topAccEngGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="5%" stopColor="#E1306C" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#E1306C" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="handle" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="engagement" fill="url(#topAccEngGradient)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart: Top Accounts by Posts (All Accounts Only) */}
        {selectedHandle === "All" && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Trophy size={18} className="text-[#833AB4]" /> Top Accounts by Postings
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
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="posts" fill="url(#topAccPostGradient)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Chart: Views Trend */}
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
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                          <div className="font-bold text-gray-700 mb-1">{payload[0].payload.handle}</div>
                          <div className="text-gray-500 mb-1 truncate max-w-[200px]">{payload[0].payload.fullCaption}</div>
                          <div>Views: <span className="font-semibold">{payload[0].payload.views.toLocaleString()}</span></div>
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

        {/* Chart: Comments Trend */}
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
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                          <div className="font-bold text-gray-700 mb-1">{payload[0].payload.handle}</div>
                          <div className="text-gray-500 mb-1 truncate max-w-[200px]">{payload[0].payload.fullCaption}</div>
                          <div>Comments: <span className="font-semibold">{payload[0].payload.comments.toLocaleString()}</span></div>
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

        {/* Chart: Engagement Trend */}
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
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                          <div className="font-bold text-gray-700 mb-1">{payload[0].payload.handle}</div>
                          <div className="text-gray-500 mb-1 truncate max-w-[200px]">{payload[0].payload.fullCaption}</div>
                          <div>Engagement: <span className="font-semibold">{payload[0].payload.engagement.toLocaleString()}</span></div>
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
              {topPosts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-xs">{post.caption}</td>
                  <td className="px-4 py-3 text-gray-600">{post.handle}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${post.type === 'Reel' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{post.type}</span></td>
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
