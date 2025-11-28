import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import DataTable from '../components/DataTable';

const ExcelDataViewer = () => {
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
    <div>
      <h1>Excel Data Viewer</h1>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
      {fileName && <p>Uploaded file: {fileName}</p>}

      {data.length > 0 && (
        <div>
          {Object.keys(dropdownOptions).map(key => (
            <select key={key} name={key} value={filters[key]} onChange={handleFilterChange}>
              <option value="">All {key}</option>
              {dropdownOptions[key].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ))}
          <button onClick={handleGetData}>Get Data</button>
          <button onClick={handleClearFilter}>Clear Filter</button>
        </div>
      )}

      <DataTable data={filteredData} />
    </div>
  );
};

export default ExcelDataViewer;
