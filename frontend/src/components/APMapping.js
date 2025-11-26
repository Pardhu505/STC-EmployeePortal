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
    setError(null); // Reset error state on new fetch
    try {
      const response = await fetch(`${API_BASE_URL}/api/sheets/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, sheet_name: sheetName }),
      });

      // Always try to parse the JSON body to get backend error details
      const data = await response.json();

      if (!response.ok) {
        // Use the detailed error message from the backend if available
        throw new Error(data.detail || `Failed to fetch data. Status: ${response.status}`);
      }

      // If response is OK, set the data
      setDataCallback(data);
      setFilteredDataCallback(data);

    } catch (error) {
      console.error("Error fetching sheet data:", error);
      // Set the error state with the detailed message
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Pass null for sheetName to allow the backend to parse the GID from the URL
    fetchData(rlbSheetUrl, null, setRlbData, setFilteredRlbData);
    fetchData(ulbSheetUrl, null, setUlbData, setFilteredUlbData);
  }, []);

  const handleRlbFilter = () => {
    let data = rlbData;
    if (rlbDistrict) {
      data = data.filter(row => row.District === rlbDistrict);
    }
    if (rlbParliament) {
      data = data.filter(row => row['Parliament Constituency'] === rlbParliament);
    }
    if (rlbAssembly) {
      data = data.filter(row => row['Assembly Constituency'] === rlbAssembly);
    }
    setFilteredRlbData(data);
  };

  const clearRlbFilters = () => {
    setRlbDistrict('');
    setRlbParliament('');
    setRlbAssembly('');
    setFilteredRlbData(rlbData);
  };

  const handleUlbFilter = () => {
    let data = ulbData;
    if (ulbDistrict) {
      data = data.filter(row => row.District === ulbDistrict);
    }
    if (ulbName) {
      data = data.filter(row => row['Urban Local Body Name'] === ulbName);
    }
    setFilteredUlbData(data);
  };

  const clearUlbFilters = () => {
    setUlbDistrict('');
    setUlbName('');
    setFilteredUlbData(ulbData);
  };

  const renderTable = (data) => {
    if (loading) return <p>Loading...</p>;
    if (error) return <p className="text-red-500">Error: {error}</p>;
    if (!data.length) return <p>No data available.</p>;

    const headers = Object.keys(data[0]);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              {headers.map(header => <th key={header} className="py-2 px-4 border-b">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {headers.map(header => <td key={header} className="py-2 px-4 border-b">{row[header]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Get unique values for dropdowns
  const getUniqueValues = (data, key) => {
    return [...new Set(data.map(item => item[key]))].filter(Boolean);
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
                    <Button onClick={handleRlbFilter}>Get Data</Button>
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
                    <Button onClick={handleUlbFilter}>Get Data</Button>
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
