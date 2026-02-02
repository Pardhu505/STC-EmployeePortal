import React, { useEffect, useState, useRef } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { ChevronDown, ArrowUp, ArrowDown, Trophy, Eye, ThumbsUp, MessageCircle, ExternalLink, Video, MonitorPlay, TrendingUp, Zap, Calendar, Filter } from "lucide-react";

const toNumber = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(String(v).replace(/,/g, "")) || 0;
};

const sortVideosByViews = (a, b, direction) => {
  const viewsA = toNumber(a.views);
  const viewsB = toNumber(b.views);
  return direction === 'asc' ? viewsA - viewsB : viewsB - viewsA;
};

/* -------------------------
   KPI CARD
------------------------- */
const KPI = ({ label, value, color, icon: Icon }) => (
  <div 
    className="bg-white rounded-xl p-4 flex items-center justify-between relative overflow-hidden transition-transform hover:-translate-y-1"
    style={{ 
      boxShadow: `4px 4px 0px 0px ${color}`,
      border: `2px solid ${color}`
    }}
  >
    <div className="z-10">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-black text-gray-800">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
    {Icon && (
      <div 
        className="p-2 rounded-lg z-10"
        style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)`, color: color }}
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

/* -------------------------
   MAIN COMPONENT
------------------------- */
export function YoutubeTracking() {
  const [data, setData] = useState(null);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [videoType, setVideoType] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "views", direction: "asc" });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  useEffect(() => {
    // Fetch directly from the scraper service
    fetch(`https://corsproxy.io/?${encodeURIComponent("https://youtube-hgci.onrender.com/raw-data")}`)
      .then((res) => res.json())
      .then((json) => {
        const raw = json.raw_videos || [];
        
        // Transform raw data to the format expected by the dashboard
        const trending = raw.map(v => ({
          id: v.video_id,
          title: v.video_title,
          views: v.viewCount,
          likes: v.likeCount,
          comments: v.commentCount,
          channel: v.channel_handle,
          channel_id: v.channel_id,
          upload_date: v.publishedAt || v.retrieved_at,
          thumbnail: v.thumbnail_url
        }));

        const uniqueChannels = [];
        const seen = new Set();
        raw.forEach(v => {
            if (v.channel_handle && !seen.has(v.channel_handle)) {
                seen.add(v.channel_handle);
                uniqueChannels.push({ handle: v.channel_handle, id: v.channel_id });
            }
        });

        const summary = {
            channelsCount: uniqueChannels.length,
            totalVideos: raw.length
        };

        setData({ trending, channels: uniqueChannels, summary });
      })
      .catch((err) => console.error("API error:", err));
  }, []);

  const globallySortedVideos = React.useMemo(() => {
    if (!data?.trending) return [];

    let sorted = [...data.trending];

    // Client-side Date Filtering
    if (fromDate) {
      const start = new Date(fromDate);
      sorted = sorted.filter(v => new Date(v.upload_date) >= start);
    }
    if (toDate) {
      const end = new Date(toDate);
      // Set end date to end of day to include the selected day
      end.setHours(23, 59, 59, 999);
      sorted = sorted.filter(v => new Date(v.upload_date) <= end);
    }

    sorted.sort((a, b) => {
      const { key, direction } = sortConfig;
      let primaryDiff = 0;

      // --- Primary Sort Logic ---
      switch (key) {
        case 'views': {
          primaryDiff = sortVideosByViews(a, b, direction);
          break;
        }
        case 'likes':
        case 'comments':
        case 'subscribers': {
          const valA = toNumber(a[key]);
          const valB = toNumber(b[key]);
          primaryDiff = direction === 'asc' ? valA - valB : valB - valA;
          break;
        }
        case 'engagement': {
          const engagementA = toNumber(a.likes) + toNumber(a.comments);
          const engagementB = toNumber(b.likes) + toNumber(b.comments);
          primaryDiff = direction === 'asc' ? engagementA - engagementB : engagementB - engagementA;
          break;
        }
        case 'upload_date': {
          const dateA = new Date(a.upload_date || 0).getTime();
          const dateB = new Date(b.upload_date || 0).getTime();
          primaryDiff = direction === 'asc' ? dateA - dateB : dateB - dateA;
          break;
        }
        default: { // For string columns like 'channel', 'title'
          const strA = String(a[key] || '');
          const strB = String(b[key] || '');
          primaryDiff = direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
          break;
        }
      }

      // If primary sort is not a tie, return the difference
      if (primaryDiff !== 0) {
        return primaryDiff;
      }

      // --- TIE-BREAKER (Secondary Sort: older to newer) ---
      // This ensures a stable sort order when primary values are equal.
      const dateA = new Date(a.upload_date || "1970-01-01").getTime();
      const dateB = new Date(b.upload_date || "1970-01-01").getTime();
      return dateA - dateB;
    });

    return sorted;
  }, [data, sortConfig, fromDate, toDate]);

  const finalVideos = React.useMemo(() => {
    let filtered = globallySortedVideos;
    if (selectedChannels.length > 0) {
      filtered = filtered.filter((v) => selectedChannels.includes(v.channel));
    }
    if (videoType === "Shorts") {
      filtered = filtered.filter(v => (v.title || "").toLowerCase().includes("#shorts"));
    } else if (videoType === "Videos") {
      filtered = filtered.filter(v => !(v.title || "").toLowerCase().includes("#shorts"));
    }
    return filtered;
  }, [globallySortedVideos, selectedChannels, videoType]);

  const filteredVideosForCharts = React.useMemo(() => {
    if (!data?.trending) return [];
    if (selectedChannels.length === 0) return data.trending;
    return data.trending.filter((v) => selectedChannels.includes(v.channel));
  }, [data, selectedChannels]);

  const top10ByViews = React.useMemo(() => {
    return [...filteredVideosForCharts].sort((a, b) => toNumber(b.views) - toNumber(a.views)).slice(0, 10);
  }, [filteredVideosForCharts]);

  const top10ByLikes = React.useMemo(() => {
    return [...filteredVideosForCharts].sort((a, b) => toNumber(b.likes) - toNumber(a.likes)).slice(0, 10);
  }, [filteredVideosForCharts]);

  const top10ByComments = React.useMemo(() => {
    return [...filteredVideosForCharts].sort((a, b) => toNumber(b.comments) - toNumber(a.comments)).slice(0, 10);
  }, [filteredVideosForCharts]);

  const insights = React.useMemo(() => {
    if (!finalVideos.length) return [];
    
    const totalE = finalVideos.reduce((a, b) => a + toNumber(b.likes) + toNumber(b.comments), 0);

    const days = {};
    finalVideos.forEach(v => {
        const d = new Date(v.upload_date).toLocaleDateString('en-US', { weekday: 'long' });
        if(!days[d]) days[d] = 0;
        days[d] += toNumber(v.views);
    });
    const bestDay = Object.keys(days).reduce((a, b) => days[a] > days[b] ? a : b, "Monday");

    return [
        { icon: Zap, color: "#facc15", label: "Total Engagement", value: totalE.toLocaleString(), sub: "Likes + Comments" },
        { icon: Calendar, color: "#60a5fa", label: "Best Posting Day", value: bestDay, sub: "Highest Views" },
        { icon: TrendingUp, color: "#34d399", label: "Active Videos", value: finalVideos.length, sub: "In selection" }
    ];
  }, [finalVideos]);

  if (!data) {
    return <div className="p-10 text-center">Loading dashboard...</div>;
  }

  const channelHandles = Array.from(new Set((data.channels || []).map((c) => c.handle)));

  const handleChannelToggle = (handle) => {
    setSelectedChannels((prev) => {
      if (prev.includes(handle)) return prev.filter((h) => h !== handle);
      return [...prev, handle];
    });
  };

  const requestSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  let kpiChannels = data.summary?.channelsCount || 0;
  let kpiVideos = data.summary?.totalVideos || 0;
  let channelLabel = "Channels";

  if (selectedChannels.length > 0) {
    kpiChannels = selectedChannels.length;
    channelLabel = "Selected Channels";
    kpiVideos = finalVideos.length;
  }

  const totalViews = finalVideos.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const totalLikes = finalVideos.reduce((acc, curr) => acc + (curr.likes || 0), 0);
  const totalComments = finalVideos.reduce((acc, curr) => acc + (curr.comments || 0), 0);

  return (
    <div className="p-2 md:p-6 bg-gray-50 min-h-screen text-gray-800 w-full max-w-full overflow-x-hidden">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 md:mb-6 gap-4">
        <h1 className="text-xl md:text-3xl font-bold text-[#225F8B] text-center md:text-left">
          Youtube Live Dashboard Of Party In-House Channels
        </h1>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          {["All", "Videos", "Shorts"].map(type => (
            <button
              key={type}
              onClick={() => setVideoType(type)}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                videoType === type 
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md" 
                : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Date Range</div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* FILTER + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4 mb-4 md:mb-6">
        <div 
          className="bg-white rounded-xl p-4 relative flex flex-col justify-center transition-transform hover:-translate-y-1 z-30" 
          ref={dropdownRef}
          style={{ 
            boxShadow: "4px 4px 0px 0px #cbd5e1",
            border: "2px solid #cbd5e1"
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
              <Filter size={16} />
            </div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Channel Handles
            </label>
          </div>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex justify-between items-center bg-gray-50 hover:bg-gray-100 rounded-lg p-2 text-sm font-medium text-gray-700 transition-colors border border-gray-200"
          >
            <span className="truncate">
              {selectedChannels.length > 0 ? `${selectedChannels.length} Selected` : "Select Channels"}
            </span>
            <ChevronDown size={16} />
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto z-10 p-2">
              <div className="flex items-center justify-between mb-2 pb-2 border-b sticky top-0 bg-white z-20">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedChannels(channelHandles)}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedChannels([])}
                    className="text-xs text-red-600 hover:underline font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {channelHandles.map((h) => (
                  <div key={h} className="flex items-center hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      id={`ch-${h}`}
                      checked={selectedChannels.includes(h)}
                      onChange={() => handleChannelToggle(h)}
                      className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor={`ch-${h}`} className="text-sm text-gray-700 break-all cursor-pointer w-full">
                      {h}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <KPI label={channelLabel} value={kpiChannels} color="#60a5fa" icon={MonitorPlay} />
        <KPI label="Videos" value={kpiVideos} color="#f87171" icon={Video} />
        <KPI label="Total Views" value={totalViews} color="#818cf8" icon={Eye} />
        <KPI label="Total Likes" value={totalLikes} color="#34d399" icon={ThumbsUp} />
        <KPI label="Total Comments" value={totalComments} color="#fbbf24" icon={MessageCircle} />
      </div>

      {/* INSIGHTS STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {insights.map((insight, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-full" style={{ background: `linear-gradient(135deg, ${insight.color}15, ${insight.color}30)`, color: insight.color }}>
              <insight.icon size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase">{insight.label}</div>
              <div className="text-lg font-bold text-gray-800">{insight.value}</div>
              <div className="text-[10px] text-gray-500">{insight.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        {/* TOP VIDEO */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0">
          <div className="bg-gradient-to-r from-indigo-400 to-purple-400 p-3 text-white flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Trophy size={12} className="text-yellow-300" /> Top Performing Video
              </div>
              <h3 className="font-bold text-sm leading-tight line-clamp-1" title={top10ByViews[0]?.title}>
                {top10ByViews[0]?.title || "No Data"}
              </h3>
              <p className="text-indigo-100 text-[10px] mt-0.5">{top10ByViews[0]?.channel}</p>
            </div>
            {top10ByViews[0] && (
               <a 
                 href={`https://www.youtube.com/watch?v=${top10ByViews[0].id}`} 
                 target="_blank" 
                 rel="noreferrer"
                 className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors"
               >
                 <ExternalLink size={14} className="text-white" />
               </a>
            )}
          </div>

          {top10ByViews[0] ? (
            <div className="p-3 flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                 <div className="flex gap-2 w-full justify-between">
                    <div className="flex flex-col">
                       <span className="text-[10px] text-gray-500 flex items-center gap-1"><Eye size={10}/> Views</span>
                       <span className="font-bold text-gray-800 text-sm">{top10ByViews[0].views?.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] text-gray-500 flex items-center gap-1"><ThumbsUp size={10}/> Likes</span>
                       <span className="font-bold text-gray-800 text-sm">{top10ByViews[0].likes?.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] text-gray-500 flex items-center gap-1"><MessageCircle size={10}/> Comments</span>
                       <span className="font-bold text-gray-800 text-sm">{top10ByViews[0].comments?.toLocaleString()}</span>
                    </div>
                 </div>
              </div>
              
              <div className="flex-1 h-24 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Views', views: top10ByViews[0].views }]} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                       <defs>
                          <linearGradient id="viewGradient" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#818cf8" stopOpacity={1}/>
                             <stop offset="100%" stopColor="#c084fc" stopOpacity={1}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                       <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                       <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat('en', { notation: "compact", compactDisplay: "short" }).format(value)} axisLine={false} tickLine={false} />
                       <Tooltip 
                          cursor={{fill: 'transparent'}}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-gray-800 text-white text-[10px] p-1 rounded shadow">
                                  {payload[0].value.toLocaleString()}
                                </div>
                              );
                            }
                            return null;
                          }}
                       />
                       <Bar dataKey="views" fill="url(#viewGradient)" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400 text-xs">No data available</div>
          )}
        </div>

        {/* TOP 10 VIEWS */}
        <ChartBox
          title="Top 10 Videos By Views"
          data={top10ByViews}
          dataKey="views"
          color1="#818cf8"
          color2="#c084fc"
          icon={Eye}
        />

        {/* TOP 10 LIKES */}
        <ChartBox
          title="Top 10 Videos By Likes"
          data={top10ByLikes}
          dataKey="likes"
          color1="#34d399"
          color2="#2dd4bf"
          icon={ThumbsUp}
        />

        {/* TOP 10 COMMENTS */}
        <ChartBox
          title="Top 10 Videos By Comments"
          data={top10ByComments}
          dataKey="comments"
          color1="#fbbf24"
          color2="#fb923c"
          icon={MessageCircle}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-lg p-2 md:p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-semibold">Videos Table</div>
        </div>
        <div className="overflow-x-auto max-h-72 w-full">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Video</th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200" onClick={() => requestSort('channel')}>
                  <div className="flex items-center justify-between">
                    <span>Channel Handle</span>
                    {sortConfig.key === 'channel' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200" onClick={() => requestSort('channel_id')}>
                  <div className="flex items-center justify-between">
                    <span>Channel ID</span>
                    {sortConfig.key === 'channel_id' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200" onClick={() => requestSort('views')}>
                  <div className="flex items-center justify-between">
                    <span>View Count</span>
                    {sortConfig.key === 'views' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200" onClick={() => requestSort('likes')}>
                  <div className="flex items-center justify-between">
                    <span>Like Count</span>
                    {sortConfig.key === 'likes' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200" onClick={() => requestSort('comments')}>
                  <div className="flex items-center justify-between">
                    <span>Comment Count</span>
                    {sortConfig.key === 'comments' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200" onClick={() => requestSort('engagement')}>
                  <div className="flex items-center justify-between">
                    <span>Engagement</span>
                    {sortConfig.key === 'engagement' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200" onClick={() => requestSort('upload_date')}>
                  <div className="flex items-center justify-between">
                    <span>Date Posted</span>
                    {sortConfig.key === 'upload_date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {finalVideos.map((v) => {
                const channel = (data.channels || []).find(
                  (c) => c.handle === v.channel
                );
                const url = `https://www.youtube.com/watch?v=${v.id}`;
                const engagementCount = toNumber(v.likes) + toNumber(v.comments);
                
                return (
                  <tr key={v.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-9 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                          <img src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col max-w-[200px]">
                          <a href={url} target="_blank" rel="noreferrer" className="font-medium text-gray-900 truncate hover:text-blue-600 text-xs" title={v.title}>
                            {v.title}
                          </a>
                          <span className="text-[10px] text-gray-400">{v.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-100 inline-block max-w-[150px] truncate shadow-sm" title={v.channel}>
                        {v.channel}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[100px] truncate" title={channel?.id}>{channel?.id}</td>
                    <td className="px-3 py-2">{v.views ? v.views.toLocaleString() : 0}</td>
                    <td className="px-3 py-2">{v.likes ? v.likes.toLocaleString() : 0}</td>
                    <td className="px-3 py-2">{v.comments ? v.comments.toLocaleString() : 0}</td>
                    <td className="px-3 py-2 font-bold text-gray-600">{engagementCount.toLocaleString()}</td>
                    <td className="px-3 py-2">{v.upload_date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   REUSABLE CHART
------------------------- */
const ChartBox = ({ title, data, dataKey, color1, color2, icon: Icon }) => {
  const gradientId = `gradient-${dataKey}`;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0">
      <div 
        className="p-3 text-white flex items-center gap-2"
        style={{ background: `linear-gradient(to right, ${color1}, ${color2})` }}
      >
        {Icon && <Icon size={16} className="text-white/90" />}
        <div className="font-bold text-sm">{title}</div>
      </div>
      <div className="p-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color1} stopOpacity={1} />
                <stop offset="100%" stopColor={color2} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="title"
              angle={-40}
              textAnchor="end"
              interval={0}
              height={60}
              tick={{ fontSize: 10 }}
              tickFormatter={(val) => {
                const words = String(val).split(" ");
                return words.length > 2 ? `${words.slice(0, 2).join(" ")}...` : val;
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10 }} 
              width={30} 
              tickFormatter={(value) => new Intl.NumberFormat('en', { notation: "compact", compactDisplay: "short" }).format(value)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-gray-800 text-white text-[10px] p-1 rounded shadow">
                      <div className="font-semibold mb-1">{payload[0].payload.title}</div>
                      <div>{dataKey.charAt(0).toUpperCase() + dataKey.slice(1)}: {payload[0].value.toLocaleString()}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey={dataKey}
              fill={`url(#${gradientId})`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
