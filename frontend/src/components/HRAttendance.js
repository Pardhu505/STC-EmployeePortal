
import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
const HRAttendance = () => {
  const { user } = useAuth();
  const [allAttendanceData, setAllAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewType, setViewType] = useState('month'); // 'day' or 'month'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  // State for checkbox filters
  const [checkedNames, setCheckedNames] = useState({});
  const [checkedCodes, setCheckedCodes] = useState({});
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [checkedStatuses, setCheckedStatuses] = useState({}); // New state for status checkboxes
  const [showStatusDropdown, setShowStatusDropdown] = useState(false); // New state for status dropdown visibility

  // This useEffect will now fetch data based on the selected view type and date.
  useEffect(() => {
    const fetchAllAttendance = async () => {
      setLoading(true);
      setError(null);

      // Construct the API URL with query parameters for filtering
      const params = new URLSearchParams();
      params.append('view_type', viewType);

      if (viewType === 'day') {
        // Format date as YYYY-MM-DD
        params.append('date', selectedDate.toISOString().split('T')[0]);
      } else if (viewType === 'month') {
        params.append('year', selectedDate.getFullYear());
        params.append('month', selectedDate.getMonth() + 1); // API expects month 1-12
      }

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
  }, [user, viewType, selectedDate]); // Re-fetch when user, viewType, or selectedDate changes

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
    // Always initialize statuses as checked by default
    setCheckedStatuses({ 'P': true, 'A': true });
  }, [allAttendanceData]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNameDropdown && !event.target.closest('.name-dropdown-container')) setShowNameDropdown(false);
      if (showCodeDropdown && !event.target.closest('.code-dropdown-container')) setShowCodeDropdown(false);
      if (showStatusDropdown && !event.target.closest('.status-dropdown-container')) setShowStatusDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNameDropdown, showCodeDropdown, showStatusDropdown]);

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

    // Only apply the status filter for the day-wise view
    if (viewType === 'day') {
      // Apply status filter: an employee is included if at least one of their daily records
      // (already filtered by date/month by API) has a status that is currently checked.
      data = data.filter(emp => {
        if (emp.dailyRecords && emp.dailyRecords.length > 0) {
          return emp.dailyRecords.some(record => checkedStatuses[record.status]);
        }
        return false; // Exclude employees with no records for the period or no checked statuses
      });
    }

    return data;
  }, [allAttendanceData, searchQuery, checkedNames, checkedCodes, checkedStatuses, viewType]);

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

  // Toggle individual status check
  const toggleStatusCheck = (status) => {
    setCheckedStatuses(prev => ({ ...prev, [status]: !prev[status] }));
  };

  // Select All / Clear All helpers for statuses
  const setAllStatusesChecked = (checked) => {
    setCheckedStatuses({ 'P': checked, 'A': checked });
  };

  const reportData = useMemo(() => {
    // The data from the API is already filtered by date.
    // We just need to process it for display.
    if (viewType === 'day') {
      return filteredData.map(emp => {
        // Since the API filters to one day, there should be at most one record.
        const dayRecord = emp.dailyRecords?.[0];

        let statusText = '-';
        let statusColor = 'text-gray-500';

        if (dayRecord) {
          if (dayRecord.status === 'P' && dayRecord.lateBy && dayRecord.lateBy !== '00:00') {
            statusText = 'Present (Late)';
            statusColor = 'text-orange-500';
          } else if (dayRecord.status === 'P') {
            statusText = 'Present';
            statusColor = 'text-green-500';
          } else if (dayRecord.status === 'A') {
            statusText = 'Absent';
            statusColor = 'text-red-500';
          } else if (dayRecord.status === 'WO' || dayRecord.status === 'S') {
            statusText = 'Week Off';
            statusColor = 'text-gray-500';
          }
        }

        return {
          empName: emp.empName,
          empCode: emp.empCode,
          statusText,
          statusColor,
          inTime: dayRecord?.inTime || '-',
          outTime: dayRecord?.outTime || '-',
          lateBy: dayRecord?.lateBy || '-',
          totalWorkingHours: dayRecord?.totalWorkingHours || '-',
        };
      });
    } else { // month view
      return filteredData.map(emp => {
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;

        // The API has already filtered records for the correct month.
        emp.dailyRecords.forEach(record => {
          if (record.status === 'P') presentCount++;
          if (record.status === 'A') absentCount++;
          if (record.lateBy && record.lateBy !== '00:00' && record.status === 'P') lateCount++;
        });

        return {
          empName: emp.empName,
          empCode: emp.empCode,
          P: presentCount,
          A: absentCount,
          L: lateCount,
        };
      });
    }
  }, [filteredData, viewType]); // selectedDate is no longer needed here

  const summaryData = useMemo(() => {
    if (viewType === 'day') {
      return {
        totalEmployees: reportData.length > 0 ? reportData.length : '-',
        selectedDate: selectedDate.toDateString(),
        isWeekOff: selectedDate.getDay() === 0,
      };
    }

    if (viewType === 'month') {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

      let totalWorkingDays = 0;
      let totalWeekOffs = 0;

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const date = new Date(year, month, day);
        if (date.getDay() !== 0) { // Not a Sunday
          totalWorkingDays++;
        } else {
          totalWeekOffs++;
        }
      }

      return {
        totalEmployees: reportData.length > 0 ? reportData.length : '-',
        selectedMonth: selectedDate.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        }),
        totalWorkingDays,
        totalWeekOffs,
      };
    }

    return {};
  }, [reportData, viewType, selectedDate]);

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
        {viewType === 'month' && (
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
        )}

        {viewType === 'day' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl shadow-lg border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-700">Total Employees</h3>
              <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.totalEmployees}</p>
            </div>
            <div className="p-4 rounded-xl shadow-lg border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-700">Selected Date</h3>
              <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.selectedDate}</p>
            </div>
            <div className="p-4 rounded-xl shadow-lg border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-700">Day Status</h3>
              <p className={`text-3xl font-bold mt-2 ${summaryData?.isWeekOff ? 'text-red-500' : 'text-[#225F8B]'}`}>
                {summaryData?.isWeekOff ? 'Week Off' : 'Working Day'}
              </p>
            </div>
          </div>
        )}

        {/* Controls & Search */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
          <div className="flex flex-wrap items-center justify-center md:justify-start space-x-2">
            <button onClick={() => setViewType("day")} className={`py-2 px-4 rounded-lg font-semibold transition-colors ${viewType === "day" ? "bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white shadow-md" : "hover:bg-blue-50 hover:border-[#225F8B]/50 text-gray-700"}`}>
              Day-wise
            </button>
            <button onClick={() => setViewType("month")} className={`py-2 px-4 rounded-lg font-semibold transition-colors ${viewType === "month" ? "bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white shadow-md" : "hover:bg-blue-50 hover:border-[#225F8B]/50 text-gray-700"}`}>
              Month-wise
            </button>

            {viewType === "day" && (
              <input type="date" value={selectedDate.toISOString().substring(0, 10)} onChange={(e) => setSelectedDate(new Date(e.target.value))} className="p-2 border border-slate-300 rounded-lg shadow-sm" />
            )}
            {viewType === "month" && (
              <input type="month" value={selectedDate.toISOString().substring(0, 7)} onChange={(e) => setSelectedDate(new Date(e.target.value + "-01"))} className="p-2 border border-slate-300 rounded-lg shadow-sm" />
            )}
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
                {viewType === "day" ? (
                  <>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">
                      Status
                      <div className="inline-block relative ml-2 status-dropdown-container">
                        <button type="button" onClick={() => setShowStatusDropdown(prev => !prev)} className="px-2 py-1 border rounded-lg border-[#225F8B]/80">↴</button>
                        {showStatusDropdown && (
                          <div className="absolute z-10 mt-1 left-0 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto w-40">
                            <label className="flex items-center px-3 py-1 font-semibold border-b">
                              <input type="checkbox" checked={Object.values(checkedStatuses).every(Boolean)} onChange={(e) => setAllStatusesChecked(e.target.checked)} className="mr-2" />
                              Select All
                            </label>
                            {['P', 'A'].map((statusKey) => (
                              <label key={statusKey} className="flex items-center px-3 py-1">
                                <input type="checkbox" checked={!!checkedStatuses[statusKey]} onChange={() => toggleStatusCheck(statusKey)} className="mr-2" />
                                {statusKey === 'P' ? 'Present' : 'Absent'}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">In Time</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Out Time</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Late By</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center rounded-tr-lg">Total Working Hours</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Present</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Absent</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center rounded-tr-lg">Late</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {reportData.length > 0 ? (
                reportData.map((e, i) => (
                  <tr key={i} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-slate-900">{e.empName}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{e.empCode}</td>
                    {viewType === "day" ? (
                      <>
                        <td className={`px-4 py-3 text-center font-bold ${e.statusColor}`}>
                          {e.statusText}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.inTime}</td>
                        <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.outTime}</td>
                        <td className="px-4 py-3 text-red-500 font-bold text-center">{e.lateBy}</td>
                        <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.totalWorkingHours}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.P}</td>
                        <td className="px-4 py-3 text-slate-600 font-bold text-center">{e.A}</td>
                        <td className="px-4 py-3 text-red-500 font-bold text-center">{e.L}</td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={viewType === 'day' ? 7 : 5} className="text-center py-4 text-slate-500">No employees match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HRAttendance;
