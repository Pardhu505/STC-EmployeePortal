import React, { useState, useEffect, useMemo } from "react";
import { employeeAPI, managerAPI } from "../Services/api";
import { useAuth, AuthProvider } from "../contexts/AuthContext";
import { getHolidaysForYear } from "./Holidays";
import { ChevronRight, ChevronDown, Calendar } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


// ---------- HELPERS ----------
const getCode = (r) => r?.empCode || r?.["Emp code"] || r?.code || "";
const getName = (r) => r?.empName || r?.Name || r?.["Emp Name"] || "";

// ---------- MANAGER REPORT ----------
const ReportingManagerReport = () => {
  const { user, loading: authLoading } = useAuth();
  const [managerDetails, setManagerDetails] = useState({ managerName: null, managerId: null, team: [] });
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState({});

  // ---------- LOAD MANAGER DETAILS FROM API ----------
  useEffect(() => {
    const loadManagerDetails = async () => {
      if (!user?.email || authLoading) return;

      setLoading(true);
      setError(null);

      try {
        // Use the centralized API function to get manager details
        const employee = await employeeAPI.getEmployeeByEmail(user.email);

        if (!employee) {
          throw new Error("Manager not found for this email");
        }

        // Use the detailed profile from the API call
        const managerId = getCode(employee); // Extracts empCode
        const managerName = employee.name; // Extracts name

        // Use the new managerAPI function from api.js
        const teamResponse = await managerAPI.getManagerTeam(managerId);

        if (!teamResponse?.team) {
          throw new Error(`Team data not found for manager ID: ${managerId}`);
        }

        setManagerDetails({
          managerName,
          managerId,
          team: teamResponse.team
        });

        setError(null);
      } catch (err) {
        console.error("Failed to load manager details:", err);
        setError(err.message || "Failed to load manager details");
        setManagerDetails({ managerName: null, managerId: null, team: [] });
      } finally {
        setLoading(false);
      }
    };

    loadManagerDetails();
  }, [user?.email, authLoading]);

  // ---------- FETCH ATTENDANCE DATA ---------- (unchanged)
  // ---------- FETCH ATTENDANCE DATA ----------
  useEffect(() => {
    if (!managerDetails.managerId || authLoading) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const teamEmpCodes = managerDetails.team.map(emp => getCode(emp)).filter(Boolean);
        const params = {
          managerId: managerDetails.managerId,
          teamEmpCodes,
          year: selectedMonthDate.getFullYear(),
          month: selectedMonthDate.getMonth() + 1,
          signal
        };
  
        // Use the correct API function from the managerAPI export
        const data = await managerAPI.getManagerAttendanceReport(params); // The params object now matches the function signature
        

        if (!data?.teamRecords || !Array.isArray(data.teamRecords)) {
          setAttendanceData([]);
          setLoading(false);
          return;
        }

        const raw = data.teamRecords;
        const merged = managerDetails.team.map((emp) => {
          // For month view, empData is the summary. For day view, it's an array of daily records.
          const empData = raw.find((r) => getCode(r) === getCode(emp));
          return {
            ...emp,
            empCode: getCode(emp),
            empName: emp.Name,
            P: empData?.P ?? 0,
            A: empData?.A ?? 0,
            H: empData?.H ?? 0,
            L: empData?.L ?? 0,
            status: empData?.status ?? "-",
            inTime: empData?.inTime ?? "-",
            outTime: empData?.outTime ?? "-",
            lateBy: empData?.lateBy ?? "00:00",
            totalWorkingHours: empData?.totalWorkingHours ?? "-",
            dailyRecords: empData?.dailyRecords ?? [], // For day-wise range view
          };
        });

        setAttendanceData(merged);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("⚠️ Fetch failed:", e);
          setError("Failed to load attendance data. Check console logs.");
          setAttendanceData([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [managerDetails.managerId, managerDetails.team, selectedMonthDate, authLoading]);

  // Toggle expanded row
  const toggleRow = (empCode) => {
    setExpandedRows(prev => ({ ...prev, [empCode]: !prev[empCode] }));
  };

  // ---------- FILTERED DATA ---------- (unchanged)
  const filteredData = useMemo(() => {
    let data = attendanceData.map((e) => {
      // Process each daily record for the detailed expansion view
      const processedDailyRecords = (e.dailyRecords || []).map(record => {
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
      empCode: getCode(e),
      empName: getName(e),
      // Detailed records for expansion
      dailyRecords: processedDailyRecords,
      P: Number(e.P ?? 0),
      A: Number(e.A ?? 0),
      H: Number(e.H ?? 0),
      L: Number(e.L ?? 0),
    }});

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (e) => e.empName.toLowerCase().includes(q) || e.empCode.toLowerCase().includes(q)
      );
    }

    return data;
  }, [attendanceData, searchQuery]);

  const summaryData = useMemo(() => {
          const year = selectedMonthDate.getFullYear();
          const month = selectedMonthDate.getMonth();
          const totalDays = new Date(year, month + 1, 0).getDate();
          
          // Get holidays for the year and filter for the current month
          const holidaysForYear = getHolidaysForYear(year);
          const monthHolidays = holidaysForYear.filter(holiday => {
            const holidayDate = new Date(holiday.date + 'T00:00:00');
            return holidayDate.getMonth() === month && holidayDate.getFullYear() === year;
          });

          let totalWeekOffs = 0;
          for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            if (date.getDay() === 0) { // Sunday
              totalWeekOffs++;
            }
          }

          // Exclude holidays that fall on a week off (Sunday)
          const holidaysNotOnWeekOff = monthHolidays.filter(h => new Date(h.date + 'T00:00:00').getDay() !== 0).length;
          const totalWorkingDays = totalDays - totalWeekOffs - holidaysNotOnWeekOff;

          return {
            totalEmployees: filteredData.length,
            selectedMonth: selectedMonthDate.toLocaleString("default", { month: "long", year: "numeric" }),
            totalWorkingDays,
            totalWeekOffs,
            monthHolidays,
          };
        }, [filteredData, selectedMonthDate]);

  // ---------- RENDER ---------- (unchanged)
  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4 font-sans">
      <div className="w-full mx-auto">
        <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">Team Attendance Report</h1>

        {loading ? (
          <p className="text-center">Loading...</p>
        ) : error ? (
          <p className="text-red-600 text-center">{error}</p>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700">Total Employees</h3>
                  <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData.totalEmployees}</p>
                </div>
                <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700">Total Working Days</h3>
                  <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData.totalWorkingDays}</p>
                </div>
                <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700">Total Week Offs</h3>
                  <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData.totalWeekOffs}</p>
                </div>
                <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700">Holidays in {summaryData.selectedMonth.split(' ')[0]}</h3>
                  {summaryData.monthHolidays.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm max-h-24 overflow-y-auto">
                      {summaryData.monthHolidays.map(holiday => (
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

            {/* Controls & Search */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start space-x-2">
                <div className="relative">
                    <DatePicker
                      selected={selectedMonthDate}
                      onChange={(date) => setSelectedMonthDate(date)}
                      dateFormat="MMMM yyyy"
                      showMonthYearPicker
                      className="p-2 pl-10 border border-slate-300 rounded-lg shadow-sm w-full"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
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
                    <th className="px-4 py-3 font-semibold text-slate-700 rounded-tl-lg">Emp Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Emp Code</th>                   
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Present</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center">Absent</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-center rounded-tr-lg">Late</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.some(e => e.dailyRecords.length > 0) ? (
                    filteredData.length > 0 ? (
                      filteredData.map((e, i) => (
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
                            <td className="px-4 py-3 text-red-500 font-bold text-center">{e.L}</td>
                          </tr>
                          {expandedRows[e.empCode] && (
                            <tr>
                              <td colSpan="6" className="p-4 bg-slate-50">
                                <h4 className="font-semibold text-slate-800 mb-2">Detailed Report for {e.empName}</h4>
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
                      ))
                    ) : (
                      <tr><td colSpan="5" className="text-center py-4 text-slate-500">No employees match the current filter.</td></tr>
                    )
                  ) : (
                    <tr><td colSpan="5" className="text-center py-4 text-slate-500">No attendance data available for the selected month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ManagerReport = () => (
  <AuthProvider>
    <ReportingManagerReport />
  </AuthProvider>
);

export default ManagerReport;
