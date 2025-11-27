import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const APMapping = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('rlb');
  const [rlbData, setRlbData] = useState([]);
  const [ulbData, setUlbData] = useState([]);
  const [filteredRlbData, setFilteredRlbData] = useState([]);
  const [filteredUlbData, setFilteredUlbData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // RLB Filters
  const [rlbDistrict, setRlbDistrict] = useState('');
  const [rlbParliament, setRlbParliament] = useState('');
  const [rlbAssembly, setRlbAssembly] = useState('');

  // ULB Filters
  const [ulbDistrict, setUlbDistrict] = useState('');
  const [ulbName, setUlbName] = useState('');

  const rlbSheetUrl = "https://docs.google.com/spreadsheets/d/1nHT_7GwWg5WsPT89xzpCfMFBw3bxjGaTagrP2FLz-_Y/edit?gid=2026344191#gid=2026344191";
  const ulbSheetUrl = "https://docs.google.com/spreadsheets/d/1gVxO92Rh1b9s1FcRYiTAB3W0GaCWJ7XkT6nYoJjz6lA/edit?gid=2088390302#gid=2088390302";

  const fetchData = async (url, sheetName, setDataCallback, setFilteredDataCallback) => {
    setLoading(true);
    setError(null);

    // Resolve base URL safely
    const base = (typeof API_BASE_URL === 'string' && API_BASE_URL.trim()) ? API_BASE_URL.replace(/\/$/, '') : window?.location?.origin || '';

    if (!base) {
      console.error('API base URL is not defined. Check frontend/src/config/api.js');
      setError('Frontend configuration error: API base URL is not defined.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        // send both keys to be compatible with different backend implementations
        url,
        sheet_url: url,
        sheet_name: sheetName,
      };

      const response = await fetch(`${base}/api/sheets/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Try parsing JSON safely
      let json = null;
      try {
        json = await response.json();
      } catch (parseErr) {
        // response had no JSON body
        console.error('Failed to parse JSON from response', parseErr);
        json = null;
      }

      if (!response.ok) {
        const backendMsg = json && (json.detail || json.error || json.message);
        throw new Error(backendMsg || `Failed to fetch data. Status: ${response.status}`);
      }

      // Normalize response shape: prefer direct array, otherwise json.data or json.rows
      let rows = [];
      if (Array.isArray(json)) {
        rows = json;
      } else if (json && Array.isArray(json.data)) {
        rows = json.data;
      } else if (json && Array.isArray(json.rows)) {
        rows = json.rows;
      } else if (json && typeof json === 'object') {
        // try to find the first array property
        const arrProp = Object.values(json).find(v => Array.isArray(v));
        if (Array.isArray(arrProp)) rows = arrProp;
      }

      if (!Array.isArray(rows)) rows = [];

      setDataCallback(rows);
      setFilteredDataCallback(rows);
    } catch (err) {
      console.error("Error fetching sheet data:", err);
      setError(err.message || 'Unknown error fetching sheet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rlb') {
      fetchData(rlbSheetUrl, null, setRlbData, setFilteredRlbData);
    } else if (activeTab === 'ulb') {
      fetchData(ulbSheetUrl, null, setUlbData, setFilteredUlbData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRlbFilter = () => {
    let data = Array.isArray(rlbData) ? rlbData : [];
    if (rlbDistrict) {
      data = data.filter(row => row && row.District === rlbDistrict);
    }
    if (rlbParliament) {
      data = data.filter(row => row && row['Parliament Constituency'] === rlbParliament);
    }
    if (rlbAssembly) {
      data = data.filter(row => row && row['Assembly Constituency'] === rlbAssembly);
    }
    setFilteredRlbData(data);
  };

  const clearRlbFilters = () => {
    setRlbDistrict('');
    setRlbParliament('');
    setRlbAssembly('');
    setFilteredRlbData(Array.isArray(rlbData) ? rlbData : []);
  };

  const handleUlbFilter = () => {
    let data = Array.isArray(ulbData) ? ulbData : [];
    if (ulbDistrict) {
      data = data.filter(row => row && row.District === ulbDistrict);
    }
    if (ulbName) {
      data = data.filter(row => row && row['Urban Local Body Name'] === ulbName);
    }
    setFilteredUlbData(data);
  };

  const clearUlbFilters = () => {
    setUlbDistrict('');
    setUlbName('');
    setFilteredUlbData(Array.isArray(ulbData) ? ulbData : []);
  };

  useEffect(() => {
    handleRlbFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rlbDistrict, rlbParliament, rlbAssembly, rlbData]);

  useEffect(() => {
    handleUlbFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ulbDistrict, ulbName, ulbData]);

  const renderTable = (data) => {
    if (loading) return <p>Loading...</p>;
    if (error) return <p className="text-red-500">Error: {error}</p>;
    if (!Array.isArray(data) || data.length === 0) return <p>No data available.</p>;

    const headers = Object.keys(data[0] || {});
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 text-center">
          <thead>
            <tr style={{ backgroundColor: '#89bff8' }}>
              {headers.map(header => <th key={header} className="py-2 px-4 border-b border-gray-300">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {headers.map(header => <td key={header} className="py-2 px-4 border-b border-gray-300">{row ? row[header] : ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Get unique values for dropdowns
  const getUniqueValues = (data, key) => {
    if (!Array.isArray(data)) return [];
    return [...new Set(data.map(item => item && item[key]).filter(Boolean))];
  };

  return (
    <div className="p-8">
        <Button onClick={() => navigate('/dashboard')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Andhra Pradesh Urban / Rural Administrative Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="rlb">RLB</TabsTrigger>
              <TabsTrigger value="ulb">ULB</TabsTrigger>
            </TabsList>
            <TabsContent value="rlb">
              <div className="space-y-4">
                <div className="flex gap-4">
                    <Select onValueChange={setRlbDistrict} value={rlbDistrict}>
                        <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
                        <SelectContent>
                        {getUniqueValues(rlbData, 'District').map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setRlbParliament} value={rlbParliament}>
                        <SelectTrigger><SelectValue placeholder="Parliament Constituency" /></SelectTrigger>
                        <SelectContent>
                        {getUniqueValues(rlbData, 'Parliament Constituency').map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setRlbAssembly} value={rlbAssembly}>
                        <SelectTrigger><SelectValue placeholder="Assembly Constituency" /></SelectTrigger>
                        <SelectContent>
                        {getUniqueValues(rlbData, 'Assembly Constituency').map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={clearRlbFilters}>Clear Filter</Button>
                </div>
                {renderTable(filteredRlbData)}
              </div>
            </TabsContent>
            <TabsContent value="ulb">
            <div className="space-y-4">
                <div className="flex gap-4">
                    <Select onValueChange={setUlbDistrict} value={ulbDistrict}>
                        <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
                        <SelectContent>
                        {getUniqueValues(ulbData, 'District').map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setUlbName} value={ulbName}>
                        <SelectTrigger><SelectValue placeholder="Urban Local Body Name" /></SelectTrigger>
                        <SelectContent>
                        {getUniqueValues(ulbData, 'Urban Local Body Name').map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={clearUlbFilters}>Clear Filter</Button>
                </div>
                {renderTable(filteredUlbData)}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default APMapping;
