import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { getHolidaysForYear } from './Holidays'; // Import the holiday list function

// Helper function to parse time strings like "10:40" into minutes
const parseTime = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) {
    return 0;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to format minutes back into HH:MM string
const formatMinutesToTime = (totalMinutes) => {
  if (totalMinutes < 0) return '00:00';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const pad = (num) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
};

// Parse CSV Data
const parseCsvData = (csvData) => {
  const lines = csvData.split('\n');
  const allEmployees = {};
  const dates = [];
  
  // Find header row
  const headerLineIndex = lines.findIndex(line => line.includes('Days,'));
  if (headerLineIndex !== -1) {
    const headerCells = lines[headerLineIndex].split(',');
    for (let i = 0; i < headerCells.length; i++) {
      if (headerCells[i].match(/\d+/)) {
        dates.push({ day: headerCells[i].match(/\d+/)[0], index: i });
      }
    }
  }

  // Month & Year
  const monthYearLine = lines.find(line => line.includes('To'));
  let month = new Date().getMonth() + 1;
  let year = new Date().getFullYear();
  if (monthYearLine) {
    const monthYearMatch = monthYearLine.match(/(\w{3})\s+\d{1,2}\s+(\d{4})/);
    if (monthYearMatch) {
      const monthMap = { 'Jan': '01','Feb': '02','Mar': '03','Apr': '04','May': '05','Jun': '06','Jul': '07','Aug': '08','Sep': '09','Oct': '10','Nov': '11','Dec': '12'};
      month = monthMap[monthYearMatch[1]] || month;
      year = monthYearMatch[2] || year;
    }
  }

  // Get holidays for the parsed year
  const holidaysForYear = getHolidaysForYear(year);

  // Employees
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Emp. Code:')) {
      const empInfoLine = lines[i].split(',');
      const statusLine = lines[i + 1]?.split(',');
      const inTimeLine = lines[i + 2]?.split(',');
      const outTimeLine = lines[i + 3]?.split(',');
      const totalTimeLine = lines[i + 4]?.split(',');

      if (!statusLine || !inTimeLine || !outTimeLine || !totalTimeLine) continue;

      const empCode = empInfoLine[3]?.trim() || '-';
      const nameLabelIndex = empInfoLine.findIndex(cell => cell.trim() === 'Emp. Name:');
      let empName = '-';
      if (nameLabelIndex !== -1) {
        empName = empInfoLine[nameLabelIndex + 5]?.trim() || '-';
      }

      const dailyRecords = [];
      dates.forEach(({ day, index }) => {
        // Create a date object in UTC to avoid timezone issues.
        // The backend will handle timezone conversion.
        const recordDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        
        // Check if the date is a holiday
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isHoliday = holidaysForYear.some(h => h.date === dateString);

        let status = statusLine[index]?.trim() || '-';
        if (isHoliday && (status === 'A' || status === '-')) {
          status = 'H'; // Mark as Holiday
        }
        const inTimeStr = inTimeLine[index]?.trim() || '-';
        const outTimeStr = outTimeLine[index]?.trim() || '-';
        const totalTimeStr = totalTimeLine[index]?.trim() || '-';

        let lateBy = '00:00';
        const inMinutes = parseTime(inTimeStr);
        const lateThreshold = 10 * 60 + 35; // 10:35 AM = 635 minutes
        if (inMinutes > lateThreshold && status === 'P') {
          lateBy = formatMinutesToTime(inMinutes - lateThreshold);
        }
        
        dailyRecords.push({
          // Format the date as YYYY-MM-DDTHH:mm:ss, which Pydantic can parse.
          // The backend will correctly handle this as a datetime object.
          date: recordDate.toISOString().split('.')[0],
          status,
          inTime: inTimeStr,
          outTime: outTimeStr,
          lateBy,
          totalWorkingHours: totalTimeStr,
        });
      });

      allEmployees[empCode] = { empCode, empName, dailyRecords };
    }
  }
  return allEmployees;
};

const AttendanceReport = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFileContent, setUploadedFileContent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Checkbox states
  const [checkedNames, setCheckedNames] = useState({});
  const [checkedCodes, setCheckedCodes] = useState({});
  // Dropdown toggle
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  // Initialize employeeData when file uploaded

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    // Reset dropdowns on new file selection
    setShowNameDropdown(false);
    setShowCodeDropdown(false);

    const reader = new FileReader();

    reader.onload = (e) => {
      const fileContent = e.target.result;
      const fileExtension = file.name.split('.').pop().toLowerCase();

      if (fileExtension === 'xls' || fileExtension === 'xlsx') {
        // Handle Excel file
        let combinedCsvData = '';
        const workbook = XLSX.read(fileContent, { type: 'binary' });
        // Iterate over all sheets and combine their data
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(worksheet);
          combinedCsvData += csvData + '\n'; // Add a newline to separate sheet data
        });
        setUploadedFileContent(combinedCsvData);
      } else {
        // Handle CSV file (as before)
        setUploadedFileContent(fileContent);
      }
      setLoading(false);
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      setLoading(false);
    };

    // For Excel, read as binary string. For CSV, read as text. readAsBinaryString works for both here.
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    if (uploadedFileContent) {
      try {
        const data = parseCsvData(uploadedFileContent);
        setEmployeeData(data);
      } catch (error) {
        console.error("Failed to parse data:", error);
        setEmployeeData({});
      }
    }
  }, [uploadedFileContent]);

  // Initialize checkboxes when employeeData is available
  useEffect(() => {
    if (employeeData) {
      const initialNames = {};
      const initialCodes = {};
      Object.values(employeeData).forEach(emp => {
        initialNames[emp.empName] = true;
        initialCodes[emp.empCode] = true;
      });
      setCheckedNames(initialNames);
      setCheckedCodes(initialCodes);
    }
  }, [employeeData]);

  // Toggle individual checks
  const toggleNameCheck = (empName) => {
    setCheckedNames(prev => ({ ...prev, [empName]: !prev[empName] }));
  };

  const toggleCodeCheck = (empCode) => {
    setCheckedCodes(prev => ({ ...prev, [empCode]: !prev[empCode] }));
  };

  // Select All / Clear All helpers for names and codes
  const setAllNamesChecked = (checked) => {
    const newState = {};
    allEmployeesList.forEach(emp => {
      newState[emp.empName] = checked;
    });
    setCheckedNames(newState);
  };

  const setAllCodesChecked = (checked) => {
    const newState = {};
    allEmployeesList.forEach(emp => {
      newState[emp.empCode] = checked;
    });
    setCheckedCodes(newState);
  };

  // Toggle expanded row
  const toggleRow = (empCode) => {
    setExpandedRows(prev => ({ ...prev, [empCode]: !prev[empCode] }));
  };

  // Save to DB
  const handleSaveToDB = useCallback(async () => {
    if (!employeeData) return;
    setLoading(true);

    // Deep clone the data to avoid mutating the state used by the UI
    const employeesList = JSON.parse(JSON.stringify(Object.values(employeeData)));

    // Transform the status 'H' to 'Holiday' before sending to the database
    const dataToSave = employeesList.map(employee => {
      employee.dailyRecords.forEach(record => {
        if (record.status === 'H') {
          record.status = 'Holiday';
        }
      });
      return employee;
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send the transformed data to the backend
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to save data to the database.' }));
        throw new Error(errorData.detail || 'Failed to save data to the database.');
      }

      const result = await response.json();
      alert(result.message || 'Saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
      // Display the specific error message from the backend if available
      if (error.message.includes('Error saving data')) {
        alert(error.message);
      } else {
        alert('Failed to save data. ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [employeeData]);

  const allEmployeesList = useMemo(() => {
    if (!employeeData) return [];
    return Object.values(employeeData);
  }, [employeeData]);

  // Filtering logic (applies search + checkbox filters + day/month computations)
  const getFilteredData = useCallback(() => {
    if (!employeeData) return { employees: [], summary: {}, hasData: false };

    let employeeList = Object.values(employeeData);
    const lowerCaseQuery = searchQuery.toLowerCase();

    // Filter by search query
    if (searchQuery) {
      employeeList = employeeList.filter(emp =>
        emp.empName.toLowerCase().includes(lowerCaseQuery) ||
        emp.empCode.toLowerCase().includes(lowerCaseQuery)
      );
    }

    // Apply checkbox filters (include only employees checked in both lists)
    employeeList = employeeList.filter(emp => checkedNames[emp.empName] && checkedCodes[emp.empCode]);

      const selectedMonth = selectedDate.getMonth();
      const selectedYear = selectedDate.getFullYear();

      const employeesWithData = employeeList.filter(emp =>
        emp.dailyRecords.some(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === selectedMonth && recordDate.getFullYear() === selectedYear;
        })
      );

      const employees = employeesWithData.map(emp => {
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;

        // Process daily records for the expansion view
        const processedDailyRecords = emp.dailyRecords
          .filter(record => {
            const recordDate = new Date(record.date);
            return recordDate.getMonth() === selectedMonth && recordDate.getFullYear() === selectedYear;
          })
          .map(record => {
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
            } else if (record.status === 'Holiday' || record.status === 'H' || record.status === 'WO' || record.status === 'S') {
                statusText = record.status === 'H' || record.status === 'Holiday' ? 'Holiday' : 'Week Off';
                statusColor = 'text-blue-500';
            }
            return { ...record, formattedDate: new Date(record.date).toLocaleDateString('en-CA'), statusText, statusColor };
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Get holidays for the selected year to exclude them from absent count
        const holidaysForYear = getHolidaysForYear(selectedYear);

        emp.dailyRecords
          .filter(record => {
            const recordDate = new Date(record.date);
            return recordDate.getMonth() === selectedMonth && recordDate.getFullYear() === selectedYear;
          })
          .forEach(record => {
            const recordDate = new Date(record.date);
            const dateString = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
            const isHoliday = holidaysForYear.some(h => h.date === dateString);

            if (record.status === 'P') presentCount++;
            if (record.status === 'A' && !isHoliday) absentCount++; // Only count absent if not a holiday
            if (record.lateBy !== '00:00' && record.status === 'P') lateCount++;
          });

        return {
          empName: emp.empName,
          empCode: emp.empCode,
          presentDays: presentCount,
          absentDays: absentCount,
          lateDays: lateCount,
          dailyRecords: processedDailyRecords,
        };
      });

      // total working days (Mon-Sat)
      let calculatedWorkingDays = 0;
      const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      for (let day = 1; day <= totalDaysInMonth; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        // Count as a working day if it's not a Sunday
        if (date.getDay() !== 0) calculatedWorkingDays++;
      }

      let totalWeekOffs = 0;
      for (let day = 1; day <= totalDaysInMonth; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        if (date.getDay() === 0) totalWeekOffs++;
      }

      // Get holidays for the selected month
      const allHolidaysForYear = getHolidaysForYear(selectedYear);
      const monthHolidays = allHolidaysForYear.filter(holiday => {
        const holidayDate = new Date(holiday.date + 'T00:00:00');
        return holidayDate.getMonth() === selectedMonth && holidayDate.getFullYear() === selectedYear;
      });
      
      // Subtract holidays from the calculated working days
      const finalTotalWorkingDays = calculatedWorkingDays - monthHolidays.length;

      const selectedMonthName = selectedDate.toLocaleString('default', { month: 'long' });

      return {
        employees,
        summary: {
          totalEmployees: employees.length > 0 ? employees.length : '-',
          totalWeekOffs, // This is just Sundays
          totalWorkingDays: finalTotalWorkingDays, // This is (Total Days - Sundays - Holidays)
          monthHolidays, // Add holidays to summary
          selectedMonthName, // Add month name for the card title
        }
      };

  }, [employeeData, selectedDate, searchQuery, checkedNames, checkedCodes]);

  const filteredData = getFilteredData();
  const employeesToDisplay = filteredData.employees;
  const summaryData = filteredData.summary;
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-48">
          <div className="text-lg text-slate-600">Parsing file...</div>
        </div>
      );
    }

    if (!uploadedFileContent) return null;

    // Month-wise
      return (
        <div className="p-6 rounded-xl overflow-x-auto">
         <div className="text-right text-sm text-[#225F8B] mb-2 pr-2">
            Note: All time values are in HH:MM format.
          </div>
          <table className="w-full table-auto text-left">
            <thead>
              <tr className="bg-sky-100">
                <th className="px-4 py-3 font-semibold text-slate-700 rounded-tl-lg">
                  Emp Name
                  {/* Names dropdown (month header) */}
                  <div className="inline-block relative ml-2">
                    <button
                      type="button"
                      onClick={() => setShowNameDropdown(prev => !prev)}
                      className="px-2 py-1 border rounded-lg border-[#225F8B]/80 "
                    >
                        ↴
                    </button>
                    {showNameDropdown && (
                      <div className="absolute z-10 mt-1 left-0 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto w-56">
                        <label className="flex items-center px-3 py-1 font-semibold border-b">
                          <input
                            type="checkbox"
                            checked={allEmployeesList.length > 0 && allEmployeesList.every(emp => checkedNames[emp.empName])}
                            onChange={(e) => setAllNamesChecked(e.target.checked)}
                            className="mr-2"
                          />
                          Select All
                        </label>
                        {allEmployeesList.map((emp) => (
                          <label key={emp.empName} className="flex items-center px-3 py-1">
                            <input
                              type="checkbox"
                              checked={!!checkedNames[emp.empName]}
                              onChange={() => toggleNameCheck(emp.empName)}
                              className="mr-2"
                            />
                            {emp.empName}
                          </label>
                        ))}
                      </div>
                    )}
                </div>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Emp Code
                  {/* Codes dropdown (month header) */}
                  <div className="inline-block relative ml-2">
                    <button
                      type="button"
                      onClick={() => setShowCodeDropdown(prev => !prev)}
                      className="px-2 py-1 border rounded-lg border-[#225F8B]/80 "
                    >
                        ↴
                    </button>
                    {showCodeDropdown && (
                      <div className="absolute z-10 mt-1 left-0 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto w-40">
                        <label className="flex items-center px-3 py-1 font-semibold border-b">
                          <input
                            type="checkbox"
                            checked={allEmployeesList.length > 0 && allEmployeesList.every(emp => checkedCodes[emp.empCode])}
                            onChange={(e) => setAllCodesChecked(e.target.checked)}
                            className="mr-2"
                          />
                          Select All
                        </label>
                        {allEmployeesList.map((emp) => (
                          <label key={emp.empCode} className="flex items-center px-3 py-1">
                            <input
                              type="checkbox"
                              checked={!!checkedCodes[emp.empCode]}
                              onChange={() => toggleCodeCheck(emp.empCode)}
                              className="mr-2"
                            />
                            {emp.empCode}
                          </label>
                        ))}
                      </div>
                    )}
                </div>
                </th>

                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Present Days</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Absent Days</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center rounded-tr-lg">Late Days</th>
              </tr>
            </thead>
            <tbody>
              {allEmployeesList.length > 0 ? (
                employeesToDisplay.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-slate-600">
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                employeesToDisplay.map((employee, index) => (
                  <React.Fragment key={index}>
                    <tr className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center">
                          <button onClick={() => toggleRow(employee.empCode)} className="mr-2 p-1 rounded-full hover:bg-slate-200">
                            {expandedRows[employee.empCode] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          {employee.empName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{employee.empCode}</td>
                      <td className="px-4 py-3 text-slate-600 font-bold text-center">{employee.presentDays}</td>
                      <td className="px-4 py-3 text-slate-600 font-bold text-center">{employee.absentDays}</td>
                      <td className="px-4 py-3 text-red-500 font-bold text-center">{employee.lateDays}</td>
                    </tr>
                    {expandedRows[employee.empCode] && (
                      <tr>
                        <td colSpan="5" className="p-4 bg-slate-50">
                          <h4 className="font-semibold text-slate-800 mb-2">Detailed Report for {employee.empName}</h4>
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
                              {employee.dailyRecords.map(record => (
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
              )) : (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-slate-600">
                    No attendance data available for the selected month.
                  </td>
                </tr>
              ) }
            </tbody>
          </table>
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4 font-sans">
      <div className="w-full mx-auto">
        <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">
          Employee Attendance Report
        </h1>

        <div className="flex flex-col items-center justify-center p-8 rounded-xl">
          <p className="text-xl text-slate-700 mb-4">
            Please upload a CSV file to view the attendance report.
          </p>
          <label htmlFor="file-upload" className="cursor-pointer bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-200">
            Choose File
          </label>
          <input id="file-upload" type="file" accept=".csv, .xls, .xlsx" onChange={handleFileChange} className="hidden" />
        </div>

        {uploadedFileContent && (
          <>
            {/* Save to DB */}
            <div className="flex justify-center mb-5">
              <button
                onClick={handleSaveToDB}
                disabled={loading}
                className="py-2 px-6 rounded-lg font-semibold transition-colors bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white"
              >
                {loading ? 'Saving...' : 'Save Report to Database'}
              </button>
            </div>

            {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700">Total Employees</h3>
                  <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.totalEmployees}</p>
                </div>
                <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700">Total Working Days</h3>
                  <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.totalWorkingDays}</p>
                </div>
                <div className="p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700">Total Week Offs</h3>
                  <p className="text-3xl font-bold text-[#225F8B] mt-2">{summaryData?.totalWeekOffs}</p>
                </div>
                {/* Holidays Card */}
                <div className="p-4 rounded-xl shadow-lg border border-slate-200 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-slate-700">
                    {summaryData?.selectedMonthName} Holidays
                  </h3>
                  {summaryData?.monthHolidays?.length > 0 ? (
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

            {/* Controls */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start space-x-2">
                  <input
                    type="month"
                    value={selectedDate.toISOString().substring(0,7)}
                    onChange={(e) => setSelectedDate(new Date(e.target.value + '-01'))}
                    className="p-2 border border-slate-300 rounded-lg shadow-sm"
                  />
              </div>

              <div className="flex justify-center ">
                <div className="relative ">
                  <input
                    type="text"
                    placeholder="Search by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="p-2 pl-10 border border-slate-300 rounded-lg shadow-sm"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {renderContent()}
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceReport;
