import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
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
import { Button } from './ui/button';

import { Users, BarChart3, Bell, MessageSquare, Gift, Shield, CalendarCheck, Map as MapIcon, Video } from 'lucide-react';

import EAttendance from './EMPAttedence';
import ManagerReport from './Manger Attendence';
import AttendanceReport from './AdminAttedenceReport';
import HRAttendance from './HRAttendance';

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
    <div className="text-center font-mono text-lg font-semibold text-white mb-2" suppressHydrationWarning>
      <span className="bg-black/10 px-2 py-1 rounded-md">{formatTime(time)}</span>
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
  // Blank cells for days before the 1st of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(<div key={`blank-${i}`} className="w-1 h-2"></div>);
  }

  // Cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === currentDate;

    calendarDays.push(
      <div key={day} className={`w-3 h-3 flex items-center justify-center relative rounded-full ${isToday ? 'bg-[#225F8B]' : ''}`}>
        <span className={`text-xs ${isToday ? 'font-bold text-transparent' : 'text-gray-700'}`}>
          {day}
        </span>
        {isToday && (
          <div className="absolute bottom-1 w-1.5 h-1.5 bg-white rounded-full"></div>
        )}
      </div>
    );
  }

  return (
  <div className="p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-md w-48" suppressHydrationWarning>
      <div className="text-center text-xs font-semibold text-gray-800 mb-2">
        <span>{monthNames[month]} {year}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
        {dayNames.map((day, i) => <div key={`${day}-${i}`} className="w-3 h-3 flex items-center justify-center">{day}</div>)}

      </div>
      <div className="grid grid-cols-7 gap-1">{calendarDays}</div>
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

const Dashboard = () => {

  const location = useLocation();
  const { user, isAdmin, loading: authLoading, navigationTarget } = useAuth();
  const [activeSection, setActiveSection] = useState('portals');
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
      case 'portals': return <PortalCards />;
      case 'announcements': return <Announcements announcements={announcements} setAnnouncements={setAnnouncements} fetchAnnouncements={fetchAnnouncements} />;
      case 'projects': return <Projects />;
      case 'profile': return <UserProfile />;
      case 'communication': return <InternalCommunication />;

      case 'meetings': return <Meetings />;

      case 'admin': 
        // Use the new isAdmin check from AuthContext
        return isAdmin ? <AdminPanel /> : <PortalCards />;
      // case 'payslips': return <PayslipManagement />;

      case 'attendance':
        // Use the new isAdmin check from AuthContext
        if (isAdmin) return <AttendanceReport />;
        if (
          user?.email === 'tejaswini@showtimeconsulting.in' ||
          user?.email === 'shashidhar.kumar@showtimeconsulting.in'
        ) return <HRAttendance />;
        if (user?.designation === 'Reporting manager') return <ManagerReport />;
        return <EAttendance />;
      default: return <PortalCards />;
    }
  };

  const navigationItems = [
    { id: 'portals', label: 'Portal Access', icon: BarChart3 },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'projects', label: 'Projects', icon: MapIcon },
    { id: 'communication', label: 'Communication', icon: MessageSquare },

    { id: 'meetings', label: 'Meetings', icon: Video },

    { id: 'attendance', label: user?.isAdmin ? 'Attendance Report' : 'Attendance', icon: CalendarCheck },
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
          <Card className="bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white border-0 shadow-xl mb-8">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}!</h1>
                  <p className="text-blue-100 text-lg">{user?.designation} • {user?.department}</p>
                  <p className="text-blue-200 text-sm mt-2">Access your workspace portals and stay updated with company announcements</p>
                  {announcements.some(a => a.type === 'birthday') && (
                    <div className="mt-4 flex items-center space-x-2">
                      <Gift className="h-5 w-5 text-yellow-300" />
                      <span className="text-yellow-200 text-sm">
                        {announcements.filter(a => a.type === 'birthday').length} birthday
                        {announcements.filter(a => a.type === 'birthday').length > 1 ? 's' : ''} today! 🎉
                      </span>
                    </div>
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="flex flex-col items-center" suppressHydrationWarning>

                    <DateTimeWidget />

                    <CalendarWidget />

                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="mb-8 flex flex-wrap gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={activeSection === item.id ? 'default' : 'outline'}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2 transition-all duration-200 ${
                    activeSection === item.id
                      ? 'bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white shadow-lg'
                      : 'hover:bg-blue-50 hover:border-[#225F8B]/50 bg-white/80 backdrop-blur-sm'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>

          {/* Content */}
          <div className="transition-all duration-300">
            {renderContent()}
          </div>
        </div>
        <Footer />

      </div>
    </div>
  );
};

export default Dashboard;
