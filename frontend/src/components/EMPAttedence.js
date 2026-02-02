import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, AuthProvider } from "../contexts/AuthContext";
import { API_BASE_URL } from '../config/api';
import { getHolidaysForYear } from './Holidays';
import { Calendar, ChevronRight, ChevronDown } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Main component for displaying attendance
const ATTENDANCE_API_URL = `${API_BASE_URL}/api/attendance-report`;

const EMPAttendance = () => {
  
  const { user, loading: authLoading } = useAuth();
  const [employeeDetails, setEmployeeDetails] = useState({ empCode: null, empName: null });

  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);

 
useEffect(() => {
  if (user) {
    // The user object from login already contains the empCode.
    // We check for multiple possible casings to be safe.
    const code = user.empCode || user['Emp code'] || user.emp_code;
    if (code) {
      setEmployeeDetails({ empCode: code, empName: user.name });
    } else {
      setError("Employee code not found for this user.");
    }
  }
}, [user]);




  const fetchAttendanceData = useCallback(async () => {
    if (authLoading || !employeeDetails.empCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    let url = `${ATTENDANCE_API_URL}/user/${employeeDetails.empCode}`;
    
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth() + 1;
    url += `?view_type=month&year=${year}&month=${month}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setAttendanceData(data.dailyRecords || []);
    } catch (e) {
      console.error("Failed to fetch attendance data:", e);
      setError('Failed to load attendance data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [authLoading, employeeDetails.empCode, selectedMonthDate]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  // --- Detailed Day-wise Report Data (for expansion) ---
  const detailedDayWiseData = useMemo(() => {
    if (!attendanceData) return [];

    return attendanceData
      .map(record => {
        let statusText = 'Not Recorded';
        let statusColor = 'text-gray-500';

        if (record.status === 'P' && record.lateBy && record.lateBy !== '00:00') {
          statusText = 'Present (Late)';
          statusColor = 'text-orange-500';
        } else if (record.status === 'P') {
          statusText = 'Present';
          statusColor = 'text-green-500';
        } else if (record.status === 'A') {
          statusText = 'Absent';
          statusColor = 'text-red-500';
        } else if (record.status === 'WO' || record.status === 'S') {
          statusText = 'Week Off';
          statusColor = 'text-blue-500';
        } else if (record.status === 'Holiday') { // Changed from 'H' to 'Holiday' as stored in DB
          statusText = 'Holiday';
          statusColor = 'text-blue-500';
        }

        return {
          ...record,
          formattedDate: new Date(record.date).toLocaleDateString('en-CA'), // YYYY-MM-DD
          statusText,
          statusColor,
        };
      }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
  }, [attendanceData]);

  // --- Monthly Stats ---
  const monthlyStats = useMemo(() => {
    const currentMonth = selectedMonthDate.getMonth(); // 0-11
    const currentYear = selectedMonthDate.getFullYear();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Get all holidays for the year and filter for the current month
    const allHolidaysForYear = getHolidaysForYear(currentYear); // Get all holidays for the year
    const monthHolidays = allHolidaysForYear.filter(holiday => {
        const holidayDate = new Date(holiday.date + 'T00:00:00'); // Treat as local time to avoid timezone shift
        return holidayDate.getMonth() === currentMonth && holidayDate.getFullYear() === currentYear;
    });

    // Count all Sundays in the month
    let totalWeekOffs = 0;
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      if (date.getDay() === 0) { // 0 is Sunday
        totalWeekOffs++;
      }
    }

    // Calculate total working days: Total Days - Week Offs - Holidays (that are not already week offs)
    const holidaysNotOnWeekOff = monthHolidays.filter(h => new Date(h.date + 'T00:00:00').getDay() !== 0).length;
    const finalTotalWorkingDays = totalDaysInMonth - totalWeekOffs - holidaysNotOnWeekOff;

    let daysPresent = 0, absentDays = 0, lateDays = 0;
    attendanceData.forEach(dayData => {
      // Check if the day is a holiday before counting it as absent
      const isHoliday = monthHolidays.some(holiday => {
        const holidayDate = new Date(holiday.date + 'T00:00:00');
        const recordDate = new Date(dayData.date);
        return holidayDate.getFullYear() === recordDate.getFullYear() && holidayDate.getMonth() === recordDate.getMonth() && holidayDate.getDate() === recordDate.getDate();
      });

      if (dayData.status === 'P') daysPresent++;
      if (dayData.status === 'A' && !isHoliday) absentDays++; // Only count as absent if it's not a holiday
      if (dayData.status === 'P' && dayData.lateBy && dayData.lateBy !== '00:00') lateDays++;
    });

    const selectedMonth = selectedMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return {
      daysPresent,
      absentDays,
      lateDays,
      totalDaysInMonth,
      selectedMonth,
      totalWorkingDays: finalTotalWorkingDays,
      totalWeekOffs,
      monthHolidays,
    };
  }, [attendanceData, selectedMonthDate]);

  const renderLoading = () => (
    <div className="flex justify-center items-center h-full">
      <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
    </div>
  );

  const renderError = () => (
    <div className="p-4 text-center text-red-600 bg-red-100 border border-red-300 rounded-lg shadow-inner">
      <p>{error}</p>
    </div>
  );

  // --- Month-wise Report ---
  const renderMonthReport = () => {
    if (!monthlyStats) return null;
    if (attendanceData.length === 0) {
      return (
        <div className="p-6 rounded-xl text-center text-slate-500 bg-slate-50">
          No attendance data available for the selected month.
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <div className="text-right text-sm text-[#225F8B] mb-2 pr-2">
          Note: All time values are in HH:MM format.
        </div>
        {/* <h3 className="text-xl font-semibold mb-4 text-center">Monthly Summary for {monthlyStats.selectedMonth}</h3> */}
        <table className="min-w-full bg-white rounded-lg shadow-md overflow-hidden">
          <thead className="bg-sky-100">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider">Employee Name</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 uppercase tracking-wider">Present Days</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 uppercase tracking-wider">Absent Days</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 uppercase tracking-wider">Late Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <React.Fragment>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <div className="flex items-center">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="mr-2 p-1 rounded-full hover:bg-slate-200">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {employeeDetails.empName}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 font-bold text-center">{monthlyStats.daysPresent}</td>
                <td className="px-4 py-3 text-slate-600 font-bold text-center">{monthlyStats.absentDays}</td>
                <td className="px-4 py-3 text-red-500 font-bold text-center">{monthlyStats.lateDays}</td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan="4" className="p-4 bg-slate-50">
                    <h4 className="font-semibold text-slate-800 mb-2">Detailed Report for {monthlyStats.selectedMonth}</h4>
                    <table className="w-full table-auto text-left bg-white rounded-md shadow">
                      <thead className="bg-sky-100">
                        <tr>
                          <th className="px-3 py-2 text-sm font-semibold text-slate-600">Date</th>
                          <th className="px-3 py-2 text-sm font-semibold text-slate-600 text-center">Status</th>
                          <th className="px-3 py-2 text-sm font-semibold text-slate-600 text-center">In Time</th>
                          <th className="px-3 py-2 text-sm font-semibold text-slate-600 text-center">Out Time</th>
                          <th className="px-3 py-2 text-sm font-semibold text-slate-600 text-center">Late By</th>
                          <th className="px-3 py-2 text-sm font-semibold text-slate-600 text-center">Total Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedDayWiseData.map(record => (
                          <tr key={record.date} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-3 py-2 text-sm text-slate-700">{record.formattedDate}</td>
                            <td className={`px-3 py-2 text-sm font-bold text-center ${record.statusColor}`}>{record.statusText}</td>
                            <td className="px-3 py-2 text-sm text-slate-700 text-center">{record.inTime || '-'}</td>
                            <td className="px-3 py-2 text-sm text-slate-700 text-center">{record.outTime || '-'}</td>
                            <td className="px-3 py-2 text-sm text-red-500 text-center">{record.lateBy || '00:00'}</td>
                            <td className="px-3 py-2 text-sm text-slate-700 text-center">{record.totalWorkingHours || '00:00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-2xl"> 
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">My Attendance Report</h2>

          {/* --- Summary Cards --- */}
          {monthlyStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-700">Selected Month</h3>
                <p className="text-3xl font-bold text-[#225F8B] mt-2">{monthlyStats.selectedMonth}</p>
              </div>
              <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-700">Total Working Days</h3>
                <p className="text-3xl font-bold text-[#225F8B] mt-2">{monthlyStats.totalWorkingDays}</p>
              </div>
              <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-700">Total Week Offs</h3>
                <p className="text-3xl font-bold text-[#225F8B] mt-2">{monthlyStats.totalWeekOffs}</p>
              </div>
              <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-700">Holidays in {monthlyStats.selectedMonth}</h3>
                {monthlyStats.monthHolidays.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {monthlyStats.monthHolidays.map(holiday => (
                      <li key={holiday.name} className="flex justify-between">
                        <span className="font-medium text-[#225F8B]">{holiday.name}</span>
                        <span className="text-[#225F8B]">{new Date(holiday.date + 'T00:00:00').toLocaleString('default', { month: 'short', day: 'numeric' })}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#225F8B] mt-2">
                    No holidays in this month.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* --- Centered Buttons + Calendar --- */}
          <div className="flex flex-col sm:flex-row items-center justify-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="w-full sm:w-auto">
              <div className="relative">
                <DatePicker
                  selected={selectedMonthDate}
                  onChange={(date) => setSelectedMonthDate(date)}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  className="p-2 pl-10 border border-slate-300 rounded-full shadow-sm w-full"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* --- Report Table --- */}
          {authLoading || loading ? renderLoading() : error ? renderError() : (
            <>
              {renderMonthReport()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App component
const EAttendance = () => (
  <AuthProvider>
    <EMPAttendance />
  </AuthProvider>
);

export default EAttendance;
