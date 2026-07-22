import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion, animate, useMotionValue } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { fetchWithRetry } from '../utils/fetchRetry';
import Header from './Header';
import Footer from './Footer'; // Import the new Footer component
import PortalCards from './PortalCards';
import Announcements from './Announcements';
import UserProfile from './UserProfile';

import Projects from '@/components/Projects';
import InternalCommunication from './InternalCommunication';
import AdminPanel from './AdminPanel';

import Meetings from './Meetings'; // Import the new Meetings component

// import PayslipManagement from './PayslipManagement';

import { Card, CardContent } from './ui/card';

import { Users, BarChart3, Bell, MessageSquare, Gift, Shield, CalendarCheck, Map as MapIcon, Video, Fingerprint, LogIn, Clock, Timer, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';

import AttendanceReport from './AdminAttedenceReport';
import HRAttendance from './HRAttendance';
import BiometricPanel from './BiometricPanel';
import { hasFullBiometricAccess } from '../config/biometricAccess';
import BiometricMyTeam from './BiometricMyTeam';

import { fetchEmployeesWorkDetails } from '../api'; // Import the centralized fetch function

const DateTimeWidget = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex items-center justify-center gap-2 text-white mb-2" suppressHydrationWarning>
      <Clock className="h-3.5 w-3.5 text-cyan-300" />
      <span className="font-mono text-base font-semibold tracking-wide">{formatTime(time)}</span>
    </div>
  );
};


const CalendarWidget = () => {

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentDate = today.getDate();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(<div key={`blank-${i}`} className="h-6"></div>);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === currentDate;
    calendarDays.push(
      <div key={day} className="h-6 flex items-center justify-center">
        <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[12px] ${
          isToday ? 'bg-cyan-400 text-slate-900 font-bold shadow-md' : 'text-white/90'}`}>
          {day}
        </span>
      </div>
    );
  }

  return (
    <div className="w-60 text-white" suppressHydrationWarning>
      <div className="flex items-center justify-between mb-1.5 px-1">
        <ChevronLeft className="h-4 w-4 text-white/60" />
        <span className="text-sm font-semibold">{monthNames[month]} {year}</span>
        <ChevronRight className="h-4 w-4 text-white/60" />
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-teal-100/70 mb-0.5">
        {dayNames.map((day, i) => <div key={`${day}-${i}`} className="h-5 flex items-center justify-center">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">{calendarDays}</div>
    </div>
  );
};

// Helper to check for birthdays
const checkBirthdays = (employees) => {
  const today = new Date();
  const todayMonth = today.getMonth() + 1; // JS months are 0-indexed
  const todayDay = today.getDate();

  return employees.filter(employee => {
    if (!employee.date_of_birth) return false;
    const dob = new Date(employee.date_of_birth);
    const dobMonth = dob.getMonth() + 1;
    const dobDay = dob.getDate();
    return dobMonth === todayMonth && dobDay === todayDay;
  });
};

// Helper to generate birthday announcements
const generateBirthdayAnnouncements = (birthdayEmployees, currentUser) => {
  return birthdayEmployees.map(employee => {
    // Check if the current user is the one having a birthday
    if (currentUser && currentUser.email === employee.email) {
      // Message for the birthday person
      return {
        id: `birthday-personal-${employee.email}`,
        type: 'birthday-personal',
        title: `Happy Birthday, ${employee.name}!`,
        content: `We wish you all the best on your special day. Thank you for being a valuable part of our team. Have a wonderful celebration! 🎂`,
        author: 'Showtime Consulting',
        date: new Date().toISOString(),
        priority: 'high',
      };
    }
    // Message for everyone else
    return {
      id: `birthday-announcement-${employee.email}`,
      type: 'birthday',
      title: `It's ${employee.name}'s Birthday!`,
      content: `Join us in wishing ${employee.name} a very happy birthday today! 🎉`,
      author: 'Showtime HR',
      date: new Date().toISOString(),
      priority: 'medium',
    };
  });
};

// Count-up number that respects reduced-motion
function AnimatedNumber({ value = 0, duration = 1.1 }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const controls = animate(mv, value, {
      duration, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return controls.stop;
  }, [value, duration, reduce, mv]);
  return <>{display}</>;
}

const statChipVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// Circular icon badge with a rotating dashed ring (matches the reference design)
function RingIcon({ color, ring, children }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-[72px] w-[72px] flex items-center justify-center">
      <motion.svg
        className="absolute inset-0" width="72" height="72" viewBox="0 0 72 72"
        animate={reduce ? {} : { rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="36" cy="36" r="33" fill="none" stroke={ring} strokeWidth="2.5"
          strokeDasharray="3 7" strokeLinecap="round" opacity="0.85" />
      </motion.svg>
      <div className="h-[56px] w-[56px] rounded-full flex items-center justify-center shadow-lg"
        style={{ background: color }}>
        {children}
      </div>
    </div>
  );
}

// "08:52" -> "08:52 AM"
function to12h(hhmm) {
  if (!hhmm || hhmm.indexOf(':') < 0) return { time: '—', ap: '' };
  let [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, ap };
}

const Dashboard = () => {

  const location = useLocation();
  const { user, isAdmin, loading: authLoading, navigationTarget } = useAuth();
  const [activeSection, setActiveSection] = useState('portals');
  const [portalViewerOpen, setPortalViewerOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [meStats, setMeStats] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/biometric/me`, {
          headers: { Authorization: `Bearer ${btoa(JSON.stringify(user))}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const emp = data.employee;
        if (!emp) return;
        const todayISO = new Date().toISOString().slice(0, 10);
        const toMin = (hhmm) => {
          if (!hhmm || hhmm.indexOf(':') < 0) return null;
          const [h, m] = hhmm.split(':').map(Number);
          return h * 60 + m;
        };
        const today = (emp.days || []).find((d) => d.date === todayISO && d.status === 'Present');
        const shortDays = (emp.days || []).filter(
          (d) => d.status === 'Present' && toMin(d.working_hours) !== null && toMin(d.working_hours) < 450
        ).length;
        if (!cancelled) {
          setMeStats({
            todayLogin: today ? today.first_in : null,
            todayLate: today ? today.late : false,
            lateMonth: emp.late_days || 0,
            shortDays,
          });
        }
      } catch (e) { /* stats are optional; ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState(new Set());
  const [announcements, setAnnouncements] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  // Handle navigation from other components that pass state
  useEffect(() => {
    if (location.state?.section) {
      setActiveSection(location.state.section);
      // Clear the state to prevent it from persisting on re-navigation or refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state]);


  const fetchAnnouncements = useCallback(async () => {
    // Do not fetch if user is not yet available
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements`);
      if (!response.ok) throw new Error('Failed to fetch announcements');
      const data = await response.json();
      
      // Generate birthday announcements
      // Check for birthdays using the 'allEmployees' state
      const birthdayEmployees = checkBirthdays(allEmployees);
      const birthdayAnns = generateBirthdayAnnouncements(birthdayEmployees, user);

      // Combine fetched announcements with birthday announcements
      // Use a function for state update to avoid stale state issues
      setAnnouncements(prev => [...data, ...birthdayAnns]);

    } catch (error) {
      console.error("Dashboard: Failed to fetch announcements", error);
    }
  }, [user, allEmployees]);

  useEffect(() => {
    // Fetch employees only once when the user is available
    const fetchAllEmployees = async () => {
      if (!user) return;
      try {
        const employees = await fetchEmployeesWorkDetails();
        setAllEmployees(employees);
      } catch (error) {
        console.error("Dashboard: Failed to fetch employees", error);
      }
    };
    fetchAllEmployees();
  }, [user]); // Only depends on the user

  useEffect(() => {
    fetchAnnouncements();
  

    const handleNewAnnouncement = (event) => {
      const message = event.detail;
      if (message.type === 'new_announcement') {
        setAnnouncements(prev => {
          // Prevent adding duplicate announcements
          if (prev.some(ann => ann.id === message.data.id)) {
            return prev;
          }
          return [message.data, ...prev];
        });
      }
    };
    
    window.addEventListener('websocket-message', handleNewAnnouncement);
    return () => window.removeEventListener('websocket-message', handleNewAnnouncement);  }, [user, allEmployees, fetchAnnouncements]); // Now this is safe because allEmployees is set elsewhere



  // Periodically re-fetch announcements to catch newly active scheduled ones
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAnnouncements();
    }, 120000); // Re-fetch every 2 minutes to reduce load
    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, [fetchAnnouncements]); // Empty dependency array ensures this runs only once

  // Handle navigation from notifications
  useEffect(() => {
    if (navigationTarget && navigationTarget.section) {
      // Check if the target section is different from the active one to avoid unnecessary re-renders
      if (activeSection !== navigationTarget.section) {
        setActiveSection(navigationTarget.section);
      }
    }
  }, [navigationTarget, activeSection]);

  // Load and manage user-specific read announcement IDs
  useEffect(() => {
    if (user?.email) {
      const saved = localStorage.getItem(`readAnnouncementIds_${user.email}`);
      setReadAnnouncementIds(saved ? new Set(JSON.parse(saved)) : new Set());
    }
  }, [user?.email]);

  const handleReadAnnouncement = (announcementId) => {
    if (!user?.email) return; // Do not save if user is not identified

    setReadAnnouncementIds(prev => {
      const newSet = new Set(prev).add(announcementId);
      localStorage.setItem(`readAnnouncementIds_${user.email}`, JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  const renderContent = () => {
    if (authLoading) return <div className="flex justify-center items-center h-64">Loading...</div>;

    switch (activeSection) {
      case 'portals': return <PortalCards onViewerChange={setPortalViewerOpen} />;
      case 'announcements': return <Announcements announcements={announcements} setAnnouncements={setAnnouncements} fetchAnnouncements={fetchAnnouncements} />;
      case 'projects': return <Projects />;
      case 'profile': return <UserProfile />;
      case 'communication': return <InternalCommunication />;

      case 'meetings': return <Meetings />;

      case 'admin': 
        // Use the new isAdmin check from AuthContext
        return isAdmin ? <AdminPanel /> : <PortalCards onViewerChange={setPortalViewerOpen} />;
      // case 'payslips': return <PayslipManagement />;

      case 'biometric':
        return <BiometricPanel />;

      case 'attendance':
        // Use the new isAdmin check from AuthContext
        if (isAdmin) return <AttendanceReport />;
        if (
          user?.email === 'tejaswini@showtimeconsulting.in' ||
          user?.email === 'shashidhar.kumar@showtimeconsulting.in'
        ) return <HRAttendance />;
        // Managers -> biometric team report; employees -> own biometric records
        return <BiometricMyTeam />;
      default: return <PortalCards onViewerChange={setPortalViewerOpen} />;
    }
  };

  const navigationItems = [
    { id: 'portals', label: 'Portal Access', icon: BarChart3 },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'projects', label: 'Projects', icon: MapIcon },
    { id: 'communication', label: 'Communication', icon: MessageSquare },

    { id: 'meetings', label: 'Meetings', icon: Video },

    { id: 'attendance', label: user?.isAdmin ? 'Attendance Report' : 'Attendance', icon: CalendarCheck },
    ...(hasFullBiometricAccess(user, isAdmin)
        ? [{ id: 'biometric', label: 'Live Attendance', icon: Fingerprint }] : []),
    // { id: 'payslips', label: 'Payslips', icon: FileText },
    // Use the new isAdmin check from AuthContext to show/hide the Admin Panel button
    ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: Shield }] : []),
    { id: 'profile', label: 'Profile', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* ... (rest of the component is unchanged) ... */}
      <div className="absolute inset-0 opacity-10">
        <img 
          src="https://showtimeconsulting.in/web/images/thm-shape1.png" 
          alt="Background Shape" 
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />
      </div>

      <div className="relative z-10">
        <Header 
          onSectionChange={setActiveSection} 
          newAnnouncements={announcements.filter(a => !readAnnouncementIds.has(a.id))}
          onReadAnnouncement={handleReadAnnouncement}
        />
        <div className="container mx-auto px-4 py-8">
          {/* Welcome Card */}
          {!portalViewerOpen && (
          <Card className="border-0 shadow-xl mb-8 overflow-hidden text-white"
            style={{ background: 'linear-gradient(135deg,#0D5E5A 0%,#0A7871 100%)' }}>
            <CardContent className="p-4 lg:p-5">
              <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                {/* Left: greeting */}
                <div className="flex items-center gap-4 shrink-0 xl:w-[300px]">
                  <div className="hidden sm:flex h-20 w-20 rounded-full bg-white/10 ring-2 ring-white/20 items-center justify-center overflow-hidden shrink-0 relative">
                    <span className="text-2xl font-bold text-white">
                      {(user?.name || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    {user?.profilePicture && (
                      <img src={user.profilePicture} alt={user?.name}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl lg:text-2xl font-bold leading-tight">Welcome back, {user?.name}!</h1>
                    <p className="text-teal-100/90 text-sm mt-0.5">{user?.designation} • {user?.department}</p>
                    <p className="text-teal-200/70 text-xs mt-1.5 max-w-xs">Access your workspace portals and stay updated with company announcements</p>
                  </div>
                </div>

                {/* Middle: animated stats */}
                {meStats && (
                  <motion.div
                    className="flex-1 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10"
                    initial="hidden" animate="show"
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } } }}
                  >
                    <motion.div variants={statChipVariants} className="flex flex-col items-center text-center px-3 py-1">
                      <RingIcon color="#14B8A6" ring="#5eead4"><LogIn className="h-7 w-7 text-white" /></RingIcon>
                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-teal-100/80">Today's Login</div>
                      <div className="text-xl font-bold text-white mt-0.5">
                        {to12h(meStats.todayLogin).time}
                        <span className="text-sm font-semibold ml-1">{to12h(meStats.todayLogin).ap}</span>
                      </div>
                      {meStats.todayLogin
                        ? (meStats.todayLate
                            ? <span className="mt-1 text-[11px] font-bold text-slate-900 bg-yellow-400 px-2 py-0.5 rounded-full">Late</span>
                            : <span className="mt-1 text-[11px] font-semibold text-emerald-200">On time</span>)
                        : <span className="mt-1 text-[11px] text-teal-200/60">No punch yet</span>}
                    </motion.div>

                    <motion.div variants={statChipVariants} className="flex flex-col items-center text-center px-3 py-1">
                      <RingIcon color="#22c55e" ring="#86efac"><CalendarPlus className="h-7 w-7 text-white" /></RingIcon>
                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-teal-100/80">Late Logins (Month)</div>
                      <div className="text-xl font-bold text-[#FACC15] mt-0.5"><AnimatedNumber value={meStats.lateMonth} /></div>
                      <span className="mt-1 text-[11px] text-teal-200/70">This Month</span>
                    </motion.div>

                    <motion.div variants={statChipVariants} className="flex flex-col items-center text-center px-3 py-1">
                      <RingIcon color="#F59E0B" ring="#fdba74"><Timer className="h-7 w-7 text-white" /></RingIcon>
                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-teal-100/80">Days under 7h 30m</div>
                      <div className="text-xl font-bold text-[#F59E0B] mt-0.5"><AnimatedNumber value={meStats.shortDays} /></div>
                      <span className="mt-1 text-[11px] text-teal-200/70">This Month</span>
                    </motion.div>
                  </motion.div>
                )}

                {/* Right: clock + calendar in a glass panel */}
                <div className="hidden lg:block shrink-0">
                  <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3">
                    <DateTimeWidget />
                    <CalendarWidget />
                  </div>
                </div>
              </div>

              {announcements.some(a => a.type === 'birthday') && (
                <div className="mt-4 flex items-center space-x-2">
                  <Gift className="h-5 w-5 text-yellow-300" />
                  <span className="text-yellow-200 text-sm">
                    {announcements.filter(a => a.type === 'birthday').length} birthday
                    {announcements.filter(a => a.type === 'birthday').length > 1 ? 's' : ''} today! 🎉
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Navigation */}
          {!portalViewerOpen && (
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-x-visible no-scrollbar -mx-1 px-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`relative shrink-0 whitespace-nowrap flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    active
                      ? 'text-white'
                      : 'text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-teal-50 hover:border-[#0A7871]/50'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-md bg-gradient-to-r from-[#0A7871] to-[#0D5E5A] shadow-lg"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className="h-4 w-4 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>
          )}

          {/* Content */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        {!portalViewerOpen && <Footer />}

      </div>
    </div>
  );
};

export default Dashboard;
