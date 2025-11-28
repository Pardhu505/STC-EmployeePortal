import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { uploadAPMapping, fetchAPMappingData } from '../api';

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

  const fetchData = async () => {
    try {
      const response = await fetchAPMappingData({});
      setData(response);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (data.length > 0) {
      const options = {
        Zone: [...new Set(data.map(item => item.Zone))].sort(),
        District: [...new Set(data.map(item => item.District))].sort(),
        'Parliament Constituency': [...new Set(data.map(item => item['Parliament Constituency']))].sort(),
        'Assembly Constituency': [...new Set(data.map(item => item['Assembly Constituency']))].sort(),
      };
      setDropdownOptions(options);
      setFilteredData(data);
    }
  }, [data]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      try {
        await uploadAPMapping(file);
        fetchData(); // Refresh data after upload
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleGetData = async () => {
    try {
      const response = await fetchAPMappingData(filters);
      setFilteredData(response);
    } catch (error) {
      console.error('Error fetching filtered data:', error);
    }
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
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Excel Data Viewer</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
        {user && user.email === 'pardhasaradhi@showtimeconsulting.in' && (
          <div className="flex items-center gap-2">
            <label htmlFor="excel-upload" className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
              Choose File
            </label>
            <input
              id="excel-upload"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            {fileName && <span className="text-sm text-gray-600">{fileName}</span>}
          </div>
        )}

        {data.length > 0 && (
          <>
            {Object.keys(dropdownOptions).map(key => (
              <Select
                key={key}
                onValueChange={(value) => handleFilterChange(key, value)}
                value={filters[key]}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder={`All ${key}`} />
                </SelectTrigger>
                <SelectContent>
                  {dropdownOptions[key].map(option => (
                    <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            <Button onClick={handleGetData}>Get Data</Button>
            <Button variant="outline" onClick={handleClearFilter}>Clear Filter</Button>
          </>
        )}
      </div>

      {fileName && <p className="text-sm text-gray-500 mb-4">Uploaded file: {fileName}</p>}

      <DataTable data={filteredData} />
    </div>
  );
};

export default ExcelDataViewer;
