import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { 
  ArrowUp, 
  ArrowDown, 
  ThumbsUp, 
  MessageCircle, 
  ExternalLink, 
  Share2, 
  FileText, 
  Users, 
  Calendar,
  Filter, 
  ChevronDown,
  MonitorPlay,
  Check,
  X,
  Zap,
  Eye,
} from "lucide-react";

const API_BASE_URL = "https://cheats-slim-leg-cannon.trycloudflare.com";

/* -------------------------
   HELPERS
------------------------- */
const parseFbNumber = (str) => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  let s = String(str).toUpperCase().replace(/,/g, '').trim();
  if (s.includes('K')) {
    return parseFloat(s.replace('K', '')) * 1000;
  }
  if (s.includes('M')) {
    return parseFloat(s.replace('M', '')) * 1000000;
  }
  return parseFloat(s) || 0;
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  // Handle YYYY-MM-DD
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  }
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // YYYY-MM-DD
  }
  return null;
};

/* -------------------------
   KPI CARD
------------------------- */
const KPI = ({ label, value, color, icon: Icon, className }) => (
  <div 
    className="bg-white rounded-xl p-4 flex items-center justify-between relative overflow-hidden transition-transform hover:-translate-y-1"
    style={{ 
      boxShadow: `4px 4px 0px 0px ${color}`,
      border: `2px solid ${color}`
    }}
  >
    <div className="z-10 min-w-0">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`${className || 'text-2xl'} font-black text-gray-800 break-words`} title={typeof value === 'string' ? value : null}>
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

const ArcSlider = ({ 
  value, 
  min, 
  max, 
  onChange, 
  label, 
  colors = { start: "#8A1974", end: "#CC18A8", track: "#fce7f3", text: "#8A1974" },
  size = 200,
  formatValue
}) => {
  const svgRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const gradientId = useRef(`grad-${Math.random().toString(36).substr(2, 9)}`).current;

  // Geometry
  const width = size;
  const height = size * 0.6;
  const cx = width / 2;
  const cy = height * 0.85;
  const r = width * 0.35;
  const strokeWidth = width * 0.08;

  // Convert value to angle (180 to 0)
  const percent = (value - min) / (max - min);
  const angle = 180 - percent * 180;

  // Convert angle to coordinates
  const rad = (a) => (a * Math.PI) / 180;
  const toXY = (a) => ({
    x: cx + r * Math.cos(rad(a)),
    y: cy - r * Math.sin(rad(a))
  });

  const start = toXY(180);
  const end = toXY(0);
  const current = toXY(angle);

  // SVG Paths
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  const progressPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${current.x} ${current.y}`;

  const updateValue = useCallback((clientX, clientY) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * 0.85;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let deg = Math.atan2(dy, dx) * 180 / Math.PI;
    
    let effectiveAngle = 0;
    if (deg < 0) { effectiveAngle = deg; } 
    else { effectiveAngle = deg > 90 ? -180 : 0; }
    
    let pct = (effectiveAngle + 180) / 180;
    if (pct < 0) pct = 0;
    if (pct > 1) pct = 1;
    
    const step = 1; // Assuming step is 1 for this slider
    const rawValue = min + pct * (max - min);
    const newValue = Math.round(rawValue / step) * step;
    onChange(newValue);
  }, [min, max, onChange]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    updateValue(e.clientX, e.clientY);
  };

  useEffect(() => { // Combined mouse and touch handlers
    const handleMouseMove = (e) => { if (isDragging) { e.preventDefault(); updateValue(e.clientX, e.clientY); } };
    const handleMouseUp = () => { setIsDragging(false); };
    const handleTouchMove = (e) => { if (isDragging && e.touches.length > 0) { e.preventDefault(); updateValue(e.touches[0].clientX, e.touches[0].clientY); } };
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, updateValue]);

  const displayValue = formatValue ? formatValue(value) : value;

  return (
    <div className="flex flex-col items-center justify-center w-full select-none py-2" style={{ width: '100%' }}>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${width} ${height}`} className="cursor-pointer touch-none w-full h-full max-h-[250px] overflow-visible" onMouseDown={handleMouseDown} onTouchStart={(e) => { if(e.touches.length > 0) { setIsDragging(true); updateValue(e.touches[0].clientX, e.touches[0].clientY); } }}>
        <defs><linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={colors.start} /><stop offset="100%" stopColor={colors.end} /></linearGradient></defs>
        <path d={trackPath} fill="none" stroke={colors.track} strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={progressPath} fill="none" stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} strokeLinecap="round" />
        <circle cx={current.x} cy={current.y} r={strokeWidth * 0.8} fill="#fff" stroke={colors.text} strokeWidth={3} style={{filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.2))'}} />
        <text x={cx} y={cy - (size * 0.20)} textAnchor="middle" className="font-bold" style={{ fontSize: size * 0.10, fill: colors.text, fontWeight: '800' }}>{displayValue}</text>
        <text x={cx} y={cy - (size * 0.08)} textAnchor="middle" className="font-medium uppercase tracking-wider" style={{ fontSize: size * 0.06, fill: colors.text }}>{label}</text>
      </svg>
    </div>
  );
};

const DateArcSelector = ({ options, selected, onSelect }) => {
  const [hovered, setHovered] = useState(null);
  
  const width = 400;
  const height = 220;
  const cx = 200;
  const cy = 200;
  const rOuter = 180;
  const rInner = 110;
  const gap = 4;

  const totalAngle = 180;
  const count = options.length;
  const segmentAngle = (totalAngle - (count - 1) * gap) / count;

  const createSegmentPath = (index) => {
    const startAngle = 180 - (index * (segmentAngle + gap));
    const endAngle = startAngle - segmentAngle;
    const toRad = (deg) => (deg * Math.PI) / 180;

    const x1 = cx + rOuter * Math.cos(toRad(startAngle));
    const y1 = cy - rOuter * Math.sin(toRad(startAngle));
    const x2 = cx + rOuter * Math.cos(toRad(endAngle));
    const y2 = cy - rOuter * Math.sin(toRad(endAngle));

    const x3 = cx + rInner * Math.cos(toRad(endAngle));
    const y3 = cy - rInner * Math.sin(toRad(endAngle));
    const x4 = cx + rInner * Math.cos(toRad(startAngle));
    const y4 = cy - rInner * Math.sin(toRad(startAngle));

    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`;
  };

  const getTextPos = (index) => {
    const angle = 180 - (index * (segmentAngle + gap)) - segmentAngle / 2;
    const rText = (rOuter + rInner) / 2;
    const toRad = (deg) => (deg * Math.PI) / 180;
    return {
      x: cx + rText * Math.cos(toRad(angle)),
      y: cy - rText * Math.sin(toRad(angle)),
      angle: angle
    };
  };

  return (
    <div className="flex flex-col items-center justify-center w-full select-none py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-h-[250px] overflow-visible drop-shadow-sm">
        {options.map((opt, i) => {
          const isSelected = selected === opt.id;
          const isHovered = hovered === opt.id;
          const path = createSegmentPath(i);
          const { x, y, angle } = getTextPos(i);
          const rotation = 90 - angle;

          return (
            <g key={opt.id} onClick={() => onSelect(opt.id)} onMouseEnter={() => setHovered(opt.id)} onMouseLeave={() => setHovered(null)} className="cursor-pointer transition-all duration-300" style={{ opacity: (selected && !isSelected) ? 0.7 : 1 }}>
              <path d={path} fill={isSelected ? "#DD2A59" : (isHovered ? "#DA7993" : "#FCE7F3")} stroke="white" strokeWidth="2" className="transition-colors duration-300" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={isSelected ? "#fff" : "#DD2A59"} style={{ fontSize: '12px', fontWeight: '700', pointerEvents: 'none', textTransform: 'uppercase' }} transform={`rotate(${rotation}, ${x}, ${y})`}>
                {opt.label}
              </text>
            </g>
          );
        })}
        <text x={cx} y={cy - 20} textAnchor="middle" className="text-xl font-bold uppercase tracking-wider" fill="#DD2A59">Date Range</text>
      </svg>
    </div>
  );
};

const TopAccountsChart = ({ data }) => {
  const [metric, setMetric] = useState('engagement'); // 'engagement' or 'posts'

  const chartData = useMemo(() => {
    const stats = {};
    data.forEach(p => {
       const key = p.page_url;
       if (!stats[key]) {
         stats[key] = { name: p.channel_name || key, engagement: 0, posts: 0 };
       }
       stats[key].engagement += p.engagementVal;
       stats[key].posts += 1;
    });
    
    let arr = Object.values(stats);
    arr.sort((a, b) => b[metric] - a[metric]);
    return arr.slice(0, 10);
  }, [data, metric]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-w-0">
       <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
         <h3 className="font-bold text-sm text-gray-700">Top 10 Accounts</h3>
         <div className="flex gap-1">
           <button 
             onClick={() => setMetric('engagement')}
             className={`px-2 py-1 text-[10px] rounded transition-colors ${metric === 'engagement' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
           >
             Engagement
           </button>
           <button 
             onClick={() => setMetric('posts')}
             className={`px-2 py-1 text-[10px] rounded transition-colors ${metric === 'posts' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
           >
             Posts
           </button>
         </div>
       </div>
       <div className="p-2 flex-1 h-48">
         <ResponsiveContainer width="100%" height="100%">
           <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
             <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
             <XAxis type="number" hide />
             <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 10}} interval={0} />
             <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{fontSize: '12px', borderRadius: '8px'}} />
             <Bar dataKey={metric} fill={metric === 'engagement' ? '#facc15' : '#818cf8'} radius={[0, 4, 4, 0]} barSize={12} />
           </BarChart>
         </ResponsiveContainer>
       </div>
    </div>
  );
};

/* -------------------------
   MAIN COMPONENT
------------------------- */
export function FacebookTracking() {
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "likes", direction: "desc" });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPostDropdownOpen, setIsPostDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const postDropdownRef = useRef(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [datePreset, setDatePreset] = useState('all_time');
  const [postType, setPostType] = useState("All");
  const [topN, setTopN] = useState(20);
  const [kpis, setKpis] = useState({ best_posting_day: "N/A" });

  const PRESET_LABELS = ['All Time', 'Yesterday', 'This Month', 'This Year', 'Custom'];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (postDropdownRef.current && !postDropdownRef.current.contains(event.target)) {
        setIsPostDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef, postDropdownRef]);

  // Handle date range presets
  useEffect(() => {
    const today = new Date();
    const toISODate = (date) => date.toISOString().split('T')[0];

    switch (datePreset) {
      case 'yesterday': {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        setStartDate(toISODate(yesterday));
        setEndDate(toISODate(yesterday));
        break;
      }
      case 'this_month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setStartDate(toISODate(firstDay));
        setEndDate(toISODate(lastDay));
        break;
      }
      case 'this_year': {
        const firstDay = new Date(today.getFullYear(), 0, 1);
        const lastDay = new Date(today.getFullYear(), 11, 31);
        setStartDate(toISODate(firstDay));
        setEndDate(toISODate(lastDay));
        break;
      }
      case 'all_time':
        setStartDate('');
        setEndDate('');
        break;
      default: // Handles 'custom'
    }
  }, [datePreset]);

  const fetchPosts = useCallback(async (pageNum = 1, isReset = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/facebook/data?page=${pageNum}&limit=50`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      
      // Handle both { data: [...] } and raw [...] responses from the new DB source
      let fetchedData = Array.isArray(json) ? json : (json.data || []);
      const paginationData = json.pagination || null;

      if (fetchedData.length > 0) {
        // Backend now prepares the data (flattened posts), so we use it directly

        setPosts(prev => isReset ? fetchedData : [...prev, ...fetchedData]);
        setPagination(paginationData);
      }
    } catch (err) {
      console.error("Failed to load data", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(1, true);
  }, [fetchPosts]);

  useEffect(() => {
    const fetchKpis = async () => {
        try {
            let url = `${API_BASE_URL}/api/facebook/kpis`;
            if (selectedPages.length === 1) {
                url += `?channel_url=${encodeURIComponent(selectedPages[0])}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if (data.best_posting_day) {
                setKpis(prev => ({ ...prev, best_posting_day: data.best_posting_day }));
            }
        } catch (e) {
            console.error(e);
        }
    };
    fetchKpis();
  }, [selectedPages]);

  const pageUrls = useMemo(() => Array.from(new Set(posts.map(p => p.channel_url).filter(Boolean))), [posts]);

  const handlePageToggle = (url) => {
    setSelectedPages((prev) => {
      const newSelection = prev.includes(url) ? prev.filter((p) => p !== url) : [...prev, url];
      // Reset post selection when page selection changes
      setSelectedPostIds([]);
      return newSelection;
    });
  };

  const handlePostToggle = (id) => {
    setSelectedPostIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      return [...prev, id];
    });
  };

  // Available posts for the single selected channel (for the dropdown options)
  const availablePosts = useMemo(() => {
    if (selectedPages.length !== 1) return [];
    return posts
      .filter(p => p.channel_url === selectedPages[0])
      .map((p, i) => ({
        id: p._id || `${p.channel_url}-${i}`,
        caption: p.caption || `Post ${i + 1}`
    }));
  }, [posts, selectedPages]);

  // --- Process Data ---
  const processedData = useMemo(() => {
    let filteredPosts = posts;
    
    if (selectedPages.length > 0) {
      filteredPosts = posts.filter(p => selectedPages.includes(p.channel_url));
    }

    let allPosts = filteredPosts.map((post, index) => ({
      ...post,
      id: post._id || `${post.channel_url}-${index}`,
      page_url: post.channel_url,
      post_url: post.url,
      likesVal: parseFbNumber(post.likes),
      commentsVal: parseFbNumber(post.comments),
      sharesVal: parseFbNumber(post.shares),
      viewsVal: parseFbNumber(post.views),
      engagementVal: (parseFbNumber(post.likes) + parseFbNumber(post.comments) + parseFbNumber(post.shares)),
      mentions: post.mentions || [],
      mentionsVal: (post.mentions || []).length,
      followersVal: parseFbNumber(post.followers),
      label: `Post ${index}`
    }));

    // Filter posts if single page selected and post filter is active
    if (selectedPages.length === 1 && selectedPostIds.length > 0) {
      allPosts = allPosts.filter(p => selectedPostIds.includes(p.id));
    }

    // Filter by Post Type (Videos vs Posts)
    if (postType === "Videos") {
      allPosts = allPosts.filter(p => p.type === "Video" || p.type === "Reel" || (p.post_url && (p.post_url.includes("/videos/") || p.post_url.includes("/reel/"))));
    } else if (postType === "Posts") {
      allPosts = allPosts.filter(p => p.type === "Post" && (!p.post_url || (!p.post_url.includes("/videos/") && !p.post_url.includes("/reel/"))));
    }

    // Filter by Date Range
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      allPosts = allPosts.filter(p => {
        const pDate = parseDate(p.date);
        if (!pDate) return false;
        if (start && pDate < start) return false;
        if (end && pDate > end) return false;
        return true;
      });
    }

    // Sort by Likes and Slice Top N
    allPosts.sort((a, b) => b.likesVal - a.likesVal);
    const slicedPosts = allPosts.slice(0, topN);

    const uniqueChannels = new Set(filteredPosts.map(p => p.channel_url));
    let totalFollowers = 0;
    uniqueChannels.forEach(url => {
        const p = filteredPosts.find(post => post.channel_url === url);
        if (p) totalFollowers += parseFbNumber(p.followers);
    });

    // Calculate Summary
    const summary = {
      totalAccounts: uniqueChannels.size,
      totalFollowers: totalFollowers,
      totalPosts: allPosts.length,
      totalLikes: slicedPosts.reduce((acc, p) => acc + p.likesVal, 0),
      totalComments: slicedPosts.reduce((acc, p) => acc + p.commentsVal, 0),
      totalShares: slicedPosts.reduce((acc, p) => acc + p.sharesVal, 0),
      totalEngagement: slicedPosts.reduce((acc, p) => acc + p.engagementVal, 0),
    };

    return { posts: slicedPosts, summary, allFilteredPosts: allPosts };
  }, [posts, selectedPages, selectedPostIds, startDate, endDate, topN, postType]);

  // --- Display Data (Top N based on selection) ---
  const displayablePosts = useMemo(() => {
    return [...processedData.posts];
  }, [processedData.posts]);

  // --- Sorting ---
  const sortedPosts = useMemo(() => {
    const sorted = [...displayablePosts];
    sorted.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA, valB;

      if (key === 'caption' || key === 'page_url' || key === 'date') {
        valA = a[key] || '';
        valB = b[key] || '';
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        // Numeric sort
        valA = a[key + 'Val'] || 0;
        valB = b[key + 'Val'] || 0;
        return direction === 'asc' ? valA - valB : valB - valA;
      }
    });
    return sorted;
  }, [displayablePosts, sortConfig]);

  // --- Chart Data (Reverse chronological for time graph effect) ---
  const chartData = useMemo(() => {
    // Use displayablePosts (Top 20 or All filtered)
    return [...displayablePosts].reverse();
  }, [displayablePosts]);

  const insights = useMemo(() => {
    if (!processedData.posts.length) return { topLikes: null, topComments: null, topShares: null, bestDay: "N/A" };
    const posts = [...processedData.posts];
    const topLikes = [...posts].sort((a, b) => b.likesVal - a.likesVal)[0];
    const topComments = [...posts].sort((a, b) => b.commentsVal - a.commentsVal)[0];
    const topShares = [...posts].sort((a, b) => b.sharesVal - a.sharesVal)[0];

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const engagementByDay = {};
    posts.forEach(p => {
        const d = parseDate(p.date);
        if (d) {
            const dayName = days[d.getDay()];
            const engagement = p.likesVal + p.commentsVal + p.sharesVal;
            engagementByDay[dayName] = (engagementByDay[dayName] || 0) + engagement;
        }
    });
    let bestDay = "N/A";
    let maxEng = -1;
    Object.entries(engagementByDay).forEach(([day, eng]) => {
        if (eng > maxEng) { maxEng = eng; bestDay = day; }
    });
    return { topLikes, topComments, topShares, bestDay };
  }, [processedData.posts]);

  const requestSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  if (error) return <div className="p-10 text-center text-red-600">Error loading data: {error}</div>;
  if (isLoading && posts.length === 0) return <div className="p-10 text-center">Loading dashboard...</div>;

  return (
    <div className="p-2 md:p-6 bg-gray-50 min-h-screen text-gray-800 w-full max-w-full overflow-x-hidden">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 md:mb-6 gap-4">
        <h1 className="text-xl md:text-3xl font-bold text-[#1877F2] text-center md:text-left">
          Facebook Analytics Dashboard
        </h1>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          {["All", "Videos", "Posts"].map(type => (
            <button
              key={type}
              onClick={() => setPostType(type)}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                postType === type 
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md" 
                : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER + KPIs */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${selectedPages.length === 1 ? 'lg:grid-cols-5' : 'lg:grid-cols-3'} gap-2 md:gap-4 mb-4 md:mb-6`}>
        {/* Custom Dropdown */}
        <div 
          className="bg-white rounded-xl p-4 relative flex flex-col justify-center transition-transform hover:-translate-y-1 z-30" 
          ref={dropdownRef}
          style={{ boxShadow: "4px 4px 0px 0px #cbd5e1", border: "2px solid #cbd5e1" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
              <Filter size={16} />
            </div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Select Pages
            </label>
          </div>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex justify-between items-center bg-gray-50 hover:bg-gray-100 rounded-lg p-2 text-sm font-medium text-gray-700 transition-colors border border-gray-200"
          >
            <span className="truncate text-left flex-1">
              {selectedPages.length === 0 
                ? "All Accounts" 
                : selectedPages.length === 1 
                  ? selectedPages[0] 
                  : `${selectedPages.length} Channels`}
            </span>
            <ChevronDown size={16} className="ml-2 flex-shrink-0" />
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto z-10 p-2">
              <div className="flex items-center justify-between mb-2 pb-2 border-b sticky top-0 bg-white z-20">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPages(pageUrls)}
                    className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    title="Select All"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setSelectedPages([])}
                    className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    title="Clear"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {pageUrls.map((url) => (
                  <div key={url} className="flex items-center hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      id={`pg-${url}`}
                      checked={selectedPages.includes(url)}
                      onChange={() => handlePageToggle(url)}
                      className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor={`pg-${url}`} className="text-sm text-gray-700 cursor-pointer flex-1 min-w-0 truncate" title={url}>
                      {url}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Post Dropdown (Only if 1 page selected) */}
        {selectedPages.length === 1 && (
          <div 
            className="bg-white rounded-xl p-4 relative flex flex-col justify-center transition-transform hover:-translate-y-1 z-30" 
            ref={postDropdownRef}
            style={{ boxShadow: "4px 4px 0px 0px #cbd5e1", border: "2px solid #cbd5e1" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
                <Filter size={16} />
              </div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Select Posts
              </label>
            </div>
            <button
              onClick={() => setIsPostDropdownOpen(!isPostDropdownOpen)}
              className="w-full flex justify-between items-center bg-gray-50 hover:bg-gray-100 rounded-lg p-2 text-sm font-medium text-gray-700 transition-colors border border-gray-200"
            >
              <span className="truncate max-w-[120px]">
                {selectedPostIds.length > 0 ? `${selectedPostIds.length} Selected` : "All Posts"}
              </span>
              <ChevronDown size={16} />
            </button>
            {isPostDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto z-10 p-2">
                <div className="flex items-center justify-between mb-2 pb-2 border-b sticky top-0 bg-white z-20">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedPostIds(availablePosts.map(p => p.id))}
                      className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      title="Select All"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setSelectedPostIds([])}
                      className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      title="Clear"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {availablePosts.map((post) => (
                    <div key={post.id} className="flex items-center hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        id={`post-${post.id}`}
                        checked={selectedPostIds.includes(post.id)}
                        onChange={() => handlePostToggle(post.id)}
                        className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor={`post-${post.id}`} className="text-sm text-gray-700 break-all cursor-pointer w-full truncate" title={post.caption}>
                        {post.caption}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic KPIs based on selection */}
        {selectedPages.length === 1 ? (
          <>
            <KPI label="Channel Name" value={selectedPages[0]} color="#3b82f6" icon={MonitorPlay} className="text-xs md:text-sm" />
            <KPI label="Total Followers" value={processedData.summary.totalFollowers} color="#f472b6" icon={Users} />
            <KPI label="Total Posts" value={processedData.summary.totalPosts} color="#818cf8" icon={FileText} />
          </>
        ) : (
          <>
            <KPI label="Total Accounts" value={processedData.summary.totalAccounts} color="#60a5fa" icon={Users} />
            <KPI label="Total Posts" value={processedData.summary.totalPosts} color="#818cf8" icon={FileText} />
          </>
        )}
      </div>

      {/* INSIGHTS ROW */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${selectedPages.length === 1 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-6`}>
        {/* Top by Likes */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-100 text-emerald-900 rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-white text-emerald-600"><ThumbsUp size={20} /></div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Most Liked</div>
            </div>
            <div className="flex-1">
                <div className="font-bold text-sm line-clamp-2 mb-1 text-emerald-950" title={insights.topLikes?.caption}>
                    {insights.topLikes?.caption || "No Data"}
                </div>
                <div className="text-3xl font-black text-emerald-800">
                    {insights.topLikes?.likesVal?.toLocaleString() || 0}
                </div>
            </div>
             {insights.topLikes?.post_url && (
                <a href={insights.topLikes.post_url} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 text-emerald-500 hover:text-emerald-700">
                    <ExternalLink size={16} />
                </a>
            )}
        </div>

        {/* Top by Comments */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-100 border border-orange-100 text-orange-900 rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-white text-orange-600"><MessageCircle size={20} /></div>
                <div className="text-xs font-bold uppercase tracking-wider text-orange-700">Most Commented</div>
            </div>
            <div className="flex-1">
                <div className="font-bold text-sm line-clamp-2 mb-1 text-orange-950" title={insights.topComments?.caption}>
                    {insights.topComments?.caption || "No Data"}
                </div>
                <div className="text-3xl font-black text-orange-800">
                    {insights.topComments?.commentsVal?.toLocaleString() || 0}
                </div>
            </div>
             {insights.topComments?.post_url && (
                <a href={insights.topComments.post_url} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 text-orange-500 hover:text-orange-700">
                    <ExternalLink size={16} />
                </a>
            )}
        </div>

        {/* Top by Shares */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-100 border border-purple-100 text-purple-900 rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-white text-purple-600"><Share2 size={20} /></div>
                <div className="text-xs font-bold uppercase tracking-wider text-purple-700">Most Shared</div>
            </div>
            <div className="flex-1">
                <div className="font-bold text-sm line-clamp-2 mb-1 text-purple-950" title={insights.topShares?.caption}>
                    {insights.topShares?.caption || "No Data"}
                </div>
                <div className="text-3xl font-black text-purple-800">
                    {insights.topShares?.sharesVal?.toLocaleString() || 0}
                </div>
            </div>
             {insights.topShares?.post_url && (
                <a href={insights.topShares.post_url} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 text-purple-500 hover:text-purple-700">
                    <ExternalLink size={16} />
                </a>
            )}
        </div>

        {/* Best Day */}
        {selectedPages.length === 1 && (
          <div className="bg-gradient-to-br from-pink-50 to-rose-100 border border-pink-100 text-pink-900 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center relative overflow-hidden">
              <div className="p-3 rounded-full bg-white text-pink-600 mb-3">
                  <Calendar size={24} />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider mb-1 text-pink-700">Best Posting Day</div>
              <div className="text-2xl font-black text-pink-800">{kpis.best_posting_day}</div>
          </div>
        )}
      </div>

      {/* CHARTS & CONTROLS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-4 md:mb-6">
        
        {/* 1. CONTROLS CARD */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid lg:grid-cols-2 gap-6 items-center">
            {/* Col 1: Top Posts Arc Slider */}
            <ArcSlider 
              value={topN} 
              min={5} 
              max={100} 
              onChange={setTopN} 
              label="Top Posts"
              colors={{ start: "#8A1974", end: "#CC18A8", track: "#fce7f3", text: "#8A1974" }}
              size={400}
            />

            {/* Col 2: Date Range Timeline */}
            <div className="flex flex-col gap-3 items-center">
              <DateArcSelector 
                options={PRESET_LABELS.map(l => ({ id: l.toLowerCase().replace(' ', '_'), label: l }))}
                selected={datePreset}
                onSelect={setDatePreset}
              />
              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${datePreset === 'custom' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-2 focus:ring-[#DA7993]/30 focus:border-[#DD2A59] block px-3 py-2 transition-all outline-none" />
                  <span className="text-[#DD2A59] font-medium">to</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-2 focus:ring-[#DA7993]/30 focus:border-[#DD2A59] block px-3 py-2 transition-all outline-none" />
                </div>
              </div>
            </div>
        </div>

        {/* 2. LIKES CHART */}
        <TrendChart 
          title="Likes Trend" 
          data={chartData} 
          dataKey="likesVal" 
          color="#34d399" 
          color2="#2dd4bf"
          icon={ThumbsUp} 
        />

        {/* 3. COMMENTS CHART */}
        <TrendChart 
          title="Comments Trend" 
          data={chartData} 
          dataKey="commentsVal" 
          color="#fbbf24" 
          color2="#fb923c"
          icon={MessageCircle} 
        />

        {/* 4. SHARES CHART */}
        <TrendChart 
          title="Shares Trend" 
          data={chartData} 
          dataKey="sharesVal" 
          color="#818cf8" 
          color2="#c084fc"
          icon={Share2} 
        />

        {/* 5. ENGAGEMENT CHART */}
        <TrendChart 
          title="Engagement Trend" 
          data={chartData} 
          dataKey="engagementVal" 
          color="#facc15" 
          color2="#fde047"
          icon={Zap} 
        />

        {/* 6. TOP ACCOUNTS / PROFILE GROWTH */}
        {selectedPages.length === 1 ? (
           <TrendChart 
             title="Views Trend" 
             data={chartData} 
             dataKey="viewsVal" 
             color="#ec4899" 
             color2="#f472b6"
             icon={Eye} 
           />
        ) : (
           <TopAccountsChart data={processedData.allFilteredPosts} />
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-lg p-2 md:p-4">
        
        <div className="overflow-x-auto max-h-96 w-full">
          <table className="min-w-full text-sm">
            <thead className="bg-sky-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('caption')}>
                  Caption {sortConfig.key === 'caption' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('likes')}>
                  Likes {sortConfig.key === 'likes' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('comments')}>
                  Comments {sortConfig.key === 'comments' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('shares')}>
                  Shares {sortConfig.key === 'shares' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('views')}>
                  Views {sortConfig.key === 'views' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('engagement')}>
                  Engagement {sortConfig.key === 'engagement' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('mentions')}>
                  Mentions {sortConfig.key === 'mentions' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-sky-100" onClick={() => requestSort('date')}>
                  Posted {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                </th>
                <th className="px-3 py-2 text-left">Link</th>
              </tr>
            </thead>
            <tbody>
              {sortedPosts.map((p, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 max-w-[300px]">
                    <div className="truncate font-medium text-gray-800" title={p.caption}>{p.caption || "(No Caption)"}</div>
                    <div className="text-[10px] text-gray-400 truncate">{p.page_url}</div>
                  </td>
                  <td className="px-3 py-2">{p.likesVal.toLocaleString()}</td>
                  <td className="px-3 py-2">{p.commentsVal.toLocaleString()}</td>
                  <td className="px-3 py-2">{p.sharesVal.toLocaleString()}</td>
                  <td className="px-3 py-2">{p.viewsVal > 0 ? p.viewsVal.toLocaleString() : "-"}</td>
                  <td className="px-3 py-2 font-semibold text-gray-700">{p.engagementVal.toLocaleString()}</td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="truncate text-xs text-gray-600" title={p.mentions.join(", ")}>{p.mentions.length > 0 ? p.mentions.join(", ") : "-"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{p.date || "-"}</td>
                  <td className="px-3 py-2">
                    <a href={p.post_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      Open <ExternalLink size={10}/>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOAD MORE */}
      <div className="flex justify-center mt-6 mb-10">
        <button
          onClick={() => fetchPosts((pagination?.page || 1) + 1, false)}
          disabled={isLoading || (pagination && pagination.page >= pagination.total_pages)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Loading..." : (pagination && pagination.page < pagination.total_pages) ? "Load More Posts" : "No More Posts"}
        </button>
      </div>
    </div>
  );
}

/* -------------------------
   REUSABLE CHART (AreaChart for Time Graph effect)
------------------------- */
const TrendChart = ({ title, data, dataKey, color, color2, icon: Icon }) => {
  const gradientId = `gradient-${dataKey}`;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0">
      <div 
        className="p-3 text-white flex items-center gap-2"
        style={{ background: `linear-gradient(to right, ${color}, ${color2 || color + 'dd'})`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
      >
        {Icon && <Icon size={16} className="text-white/90" />}
        <div className="font-bold text-sm">{title}</div>
      </div>
      <div className="p-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis hide />
            <YAxis 
              tick={{ fontSize: 10 }} 
              width={30} 
              tickFormatter={(value) => new Intl.NumberFormat('en', { notation: "compact", compactDisplay: "short" }).format(value)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: color, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white text-[10px] p-2 rounded shadow border max-w-xs" style={{ borderColor: color, color: color }}>
                      <div className="font-bold mb-1 break-words">{payload[0].payload.caption || "Post"}</div>
                      <div><span className="font-semibold capitalize">{dataKey.replace('Val', '')}:</span> {payload[0].value.toLocaleString()}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
