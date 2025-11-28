import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import DataTable from '../components/DataTable';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';

const ExcelDataViewer = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [filters, setFilters] = useState({
    Zone: '',
    District: '',
    'Parliament Constituency': '',
    'Assembly Constituency': '',
  });
  const [dropdownOptions, setDropdownOptions] = useState({
    Zone: [],
    District: [],
    'Parliament Constituency': [],
    'Assembly Constituency': [],
  });

  useEffect(() => {
    if (data.length > 0) {
      const options = {
        Zone: [...new Set(data.map(item => item.Zone))],
        District: [...new Set(data.map(item => item.District))],
        'Parliament Constituency': [...new Set(data.map(item => item['Parliament Constituency']))],
        'Assembly Constituency': [...new Set(data.map(item => item['Assembly Constituency']))],
      };
      setDropdownOptions(options);
      setFilteredData(data);
    }
  }, [data]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setData(data);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleGetData = () => {
    let filtered = data;
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        filtered = filtered.filter(item => item[key] === filters[key]);
      }
    });
    setFilteredData(filtered);
  };

  const handleClearFilter = () => {
    setFilters({
      Zone: '',
      District: '',
      'Parliament Constituency': '',
      'Assembly Constituency': '',
    });
    setFilteredData(data);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Excel Data Viewer</h1>
      {user && user.email === 'pardhasaradhi@showtimeconsulting.in' && (
        <div className="mb-4">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {fileName && <p className="text-sm text-gray-600 mt-2">Uploaded file: {fileName}</p>}
        </div>
      )}

      {data.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.keys(dropdownOptions).map(key => (
            <select
              key={key}
              name={key}
              value={filters[key]}
              onChange={handleFilterChange}
              className="block w-full md:w-auto px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">All {key}</option>
              {dropdownOptions[key].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ))}
          <Button onClick={handleGetData}>Get Data</Button>
          <Button variant="outline" onClick={handleClearFilter}>Clear Filter</Button>
        </div>
      )}

      <DataTable data={filteredData} />
    </div>
  );
};

export default ExcelDataViewer;
