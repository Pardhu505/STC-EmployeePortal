import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { getHolidaysForYear } from './Holidays';
import { ChevronRight, ChevronDown, Calendar } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
const HRAttendance = () => {
  const { user } = useAuth();
  const [allAttendanceData, setAllAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  // State for checkbox filters
  const [checkedNames, setCheckedNames] = useState({});
  const [checkedCodes, setCheckedCodes] = useState({});
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  // This useEffect will now fetch data based on the selected view type and date.
  useEffect(() => {
    const fetchAllAttendance = async () => {
      setLoading(true);
      setError(null);

      // Construct the API URL with query parameters for filtering
      const params = new URLSearchParams();
      params.append('view_type', 'month'); // Always fetch month data
      params.append('year', selectedMonthDate.getFullYear());
      params.append('month', selectedMonthDate.getMonth() + 1); // API expects month 1-12

      try {
        const response = await fetch(`${API_BASE_URL}/api/attendance-report?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch attendance data for all employees.');
        }
        const result = await response.json();
        setAllAttendanceData(result.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (
      user?.email === 'tejaswini@showtimeconsulting.in' ||
      user?.email === 'shashidhar.kumar@showtimeconsulting.in'
    ) {
      fetchAllAttendance();
    }
  }, [user, selectedMonthDate]); // Re-fetch when user or selectedMonthDate changes

  // Initialize checkboxes when data is first loaded
  useEffect(() => {
    if (allAttendanceData.length > 0) {
      const initialNames = {};
      const initialCodes = {};
      allAttendanceData.forEach(emp => {
        initialNames[emp.empName] = true;
        initialCodes[emp.empCode] = true;
      });
      setCheckedNames(initialNames);
      setCheckedCodes(initialCodes);
    }
  }, [allAttendanceData]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNameDropdown && !event.target.closest('.name-dropdown-container')) setShowNameDropdown(false);
      if (showCodeDropdown && !event.target.closest('.code-dropdown-container')) setShowCodeDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNameDropdown, showCodeDropdown]);

  const filteredData = useMemo(() => {
    if (!allAttendanceData) return []; // This data is now pre-filtered by the API

    let data = allAttendanceData;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (e) =>
          e.empName.toLowerCase().includes(q) ||
          e.empCode.toLowerCase().includes(q)
      );
    }

    // Apply checkbox filters (include only employees checked in both lists)
    data = data.filter(emp => checkedNames[emp.empName] && checkedCodes[emp.empCode]);

    // Sort the data alphabetically by employee name
    return data.sort((a, b) => {
      return a.empName.localeCompare(b.empName);
    });
  }, [allAttendanceData, searchQuery, checkedNames, checkedCodes]);

  // Toggle individual checks
  const toggleNameCheck = (empName) => {
    setCheckedNames(prev => ({ ...prev, [empName]: !prev[empName] }));
  };

  const toggleCodeCheck = (empCode) => {
    setCheckedCodes(prev => ({ ...prev, [empCode]: !prev[empCode] }));
  };

  // Select All / Clear All helpers
  const setAllNamesChecked = (checked) => {
    const newState = {};
    allAttendanceData.forEach(emp => { newState[emp.empName] = checked; });
    setCheckedNames(newState);
  };

  const setAllCodesChecked = (checked) => {
    const newState = {};
    allAttendanceData.forEach(emp => { newState[emp.empCode] = checked; });
    setCheckedCodes(newState);
  };

  // Toggle expanded row
  const toggleRow = (empCode) => {
    setExpandedRows(prev => ({ ...prev, [empCode]: !prev[empCode] }));
  };

  const reportData = useMemo(() => {
    // The data from the API is already filtered by date.
    // We just need to process it for display.
    return filteredData.map(emp => {
      // Process daily records for the expansion view
      const processedDailyRecords = (emp.dailyRecords || []).map(record => {
          let statusText = '-';
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
          } else if (record.status === 'Holiday' || record.status === 'H') {
              statusText = 'Holiday';
              statusColor = 'text-blue-500';
          } else if (record.status === 'WO' || record.status === 'S') {
              statusText = 'Week Off';
              statusColor = 'text-blue-500';
          }
          return {
              ...record,
              formattedDate: new Date(record.date).toLocaleDateString('en-CA'),
              statusText,
              statusColor,
          };
      }).sort((a, b) => new Date(a.date) - new Date(b.date));

      return {
        empName: emp.empName,
        empCode: emp.empCode,
        // The API now returns these counts directly for month view
        P: emp.P ?? 0,
        A: emp.A ?? 0,
        H: emp.H ?? 0,
        L: emp.L ?? 0,
        dailyRecords: processedDailyRecords, // Keep detailed records for expansion
      };
    });
  }, [filteredData]);

  const summaryData = useMemo(() => {
      const year = selectedMonthDate.getFullYear();
      const month = selectedMonthDate.getMonth();
      const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
      const holidaysForYear = getHolidaysForYear(year);
      const monthHolidays = holidaysForYear.filter(holiday => {
        const holidayDate = new Date(holiday.date + 'T00:00:00');
        return holidayDate.getMonth() === month && holidayDate.getFullYear() === year;
      });

      let totalWorkingDays = 0;
      let totalWeekOffs = 0;

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const date = new Date(year, month, day);
        if (date.getDay() === 0) { // Sunday
          totalWeekOffs++;
        }
      }

      const holidaysNotOnWeekOff = monthHolidays.filter(h => new Date(h.date + 'T00:00:00').getDay() !== 0).length;
      totalWorkingDays = totalDaysInMonth - totalWeekOffs - holidaysNotOnWeekOff;

      return {
        totalEmployees: reportData.length > 0 ? reportData.length : '-',
        selectedMonth: selectedMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        totalWorkingDays,
        totalWeekOffs,
      };

  }, [reportData, selectedMonthDate]);

  if (loading) {
    return <div className="text-center p-8">Loading attendance data...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4 font-sans">
      <div className="w-full mx-auto">
        <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">HR Attendance Report</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl shadow-lg border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700">Total Employees</h3>
            <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.totalEmployees}</p>
          </div>
          <div className="p-4 rounded-xl shadow-lg border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700">Selected Month</h3>
            <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.selectedMonth}</p>
          </div>
          <div className="p-4 rounded-xl shadow-lg border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700">Total Working Days</h3>
            <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.totalWorkingDays}</p>
          </div>
          <div className="p-4 rounded-xl shadow-lg border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700">Total Week Offs</h3>
            <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.totalWeekOffs}</p>
          </div>
        </div>

        {/* Controls & Search */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
          <div className="flex flex-wrap items-center justify-center md:justify-start space-x-2">
            <input type="month" value={selectedMonthDate.toISOString().substring(0, 7)} onChange={(e) => setSelectedMonthDate(new Date(e.target.value + "-01"))} className="p-2 border border-slate-300 rounded-lg shadow-sm" />
          </div>

          <div className="flex justify-center">
            <div className="relative">
              <input type="text" placeholder="Search by name or code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="p-2 pl-10 border border-slate-300 rounded-lg shadow-sm" />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* TABLES */}
        <div className="p-6 rounded-xl overflow-x-auto">
          <div className="text-right text-sm text-[#225F8B] mb-2 pr-2">
            Note: All time values are in HH:MM format.
          </div>
          <table className="w-full table-auto text-left">
            <thead>
              <tr className="bg-sky-100">
                <th className="px-4 py-3 font-semibold text-slate-700 rounded-tl-lg">
                  Emp Name
                  <div className="inline-block relative ml-2 name-dropdown-container">
                    <button type="button" onClick={() => setShowNameDropdown(prev => !prev)} className="px-2 py-1 border rounded-lg border-[#225F8B]/80">↴</button>
                    {showNameDropdown && (
                      <div className="absolute z-10 mt-1 left-0 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto w-56">
                        <label className="flex items-center px-3 py-1 font-semibold border-b">
                          <input type="checkbox" checked={allAttendanceData.length > 0 && allAttendanceData.every(emp => checkedNames[emp.empName])} onChange={(e) => setAllNamesChecked(e.target.checked)} className="mr-2" />
                          Select All
                        </label>
                        {allAttendanceData.map((emp) => (
                          <label key={emp.empName} className="flex items-center px-3 py-1">
                            <input type="checkbox" checked={!!checkedNames[emp.empName]} onChange={() => toggleNameCheck(emp.empName)} className="mr-2" />
                            {emp.empName}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Emp Code
                  <div className="inline-block relative ml-2 code-dropdown-container">
                    <button type="button" onClick={() => setShowCodeDropdown(prev => !prev)} className="px-2 py-1 border rounded-lg border-[#225F8B]/80">↴</button>
                    {showCodeDropdown && (
                      <div className="absolute z-10 mt-1 left-0 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto w-40">
                        <label className="flex items-center px-3 py-1 font-semibold border-b">
                          <input type="checkbox" checked={allAttendanceData.length > 0 && allAttendanceData.every(emp => checkedCodes[emp.empCode])} onChange={(e) => setAllCodesChecked(e.target.checked)} className="mr-2" />
                          Select All
                        </label>
                        {allAttendanceData.map((emp) => (
                          <label key={emp.empCode} className="flex items-center px-3 py-1">
                            <input type="checkbox" checked={!!checkedCodes[emp.empCode]} onChange={() => toggleCodeCheck(emp.empCode)} className="mr-2" />
                            {emp.empCode}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Present</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Absent</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Holiday</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center rounded-tr-lg">Late</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length > 0 ? (
                filteredData.length > 0 ? (reportData.map((e, i) => (
                  <React.Fragment key={i}>
                    <tr className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center">
                          <button onClick={() => toggleRow(e.empCode)} className="mr-2 p-1 rounded-full hover:bg-slate-200">
                            {expandedRows[e.empCode] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          {e.empName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{e.empCode}</td>
                      <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.P}</td>
                      <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.A}</td>
                      <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.H}</td>
                      <td className="px-4 py-3 text-red-500 font-bold text-center">{e.L}</td>
                    </tr>
                    {expandedRows[e.empCode] && (
                      <tr>
                        <td colSpan="6" className="p-4 bg-slate-50">
                          <h4 className="font-semibold text-slate-800 mb-2">Detailed Report for {e.empName} ({e.dailyRecords.length} days)</h4>
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
                              {e.dailyRecords.map(record => (
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
                ))) : (
                  <tr><td colSpan="6" className="text-center py-4 text-slate-500">No employees match the current filters.</td></tr>
                )
              ) : (
                <tr><td colSpan="6" className="text-center py-4 text-slate-500">No attendance data available for the selected month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HRAttendance;