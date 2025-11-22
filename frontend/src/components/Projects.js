import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const Projects = () => {
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [district, setDistrict] = useState('');
  const [parliament, setParliament] = useState('');
  const [assembly, setAssembly] = useState('');
  const [ulb, setUlb] = useState(false);
  const [rlb, setRlb] = useState(false);
  const [data, setData] = useState([]);
  const [allData, setAllData] = useState([]);

  const handleSaveUrl = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/projects/google-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ url: googleSheetUrl }),
      });
      alert('Google Sheet URL saved successfully!');
    } catch (error) {
      console.error('Failed to save Google Sheet URL', error);
      alert('Failed to save Google Sheet URL.');
    }
  };

  const handleGetData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/google-sheet/data`);
      const fetchedData = await response.json();
      setAllData(fetchedData);

      const filteredData = fetchedData.filter(item => {
        return (
          (district ? item.district === district : true) &&
          (parliament ? item.parliament === parliament : true) &&
          (assembly ? item.assembly === assembly : true) &&
          (ulb ? item.ulb : true) &&
          (rlb ? item.rlb : true)
        );
      });
      setData(filteredData);
    } catch (error) {
      console.error('Failed to fetch data', error);
    }
  };

  return (
    <div>
      <Card onClick={() => setShowFilters(!showFilters)} className="cursor-pointer">
        <CardHeader>
          <CardTitle>Andhra Pradesh State Administrative Mapping</CardTitle>
        </CardHeader>
      </Card>

      {user?.email === 'pardhasaradhi@showtimeconsulting.in' && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold">Upload Google Sheet</h3>
            <div className="flex gap-2 mt-2">
              <Input
                type="text"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="Enter Google Sheet URL"
              />
              <Button onClick={handleSaveUrl}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showFilters && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <Select onValueChange={setDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="District" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="District A">District A</SelectItem>
                  <SelectItem value="District B">District B</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={setParliament}>
                <SelectTrigger>
                  <SelectValue placeholder="Parliament Constituency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Parliament 1">Parliament 1</SelectItem>
                  <SelectItem value="Parliament 2">Parliament 2</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={setAssembly}>
                <SelectTrigger>
                  <SelectValue placeholder="Assembly Constituency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Assembly X">Assembly X</SelectItem>
                  <SelectItem value="Assembly Y">Assembly Y</SelectItem>
                  <SelectItem value="Assembly Z">Assembly Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox id="ulb" checked={ulb} onCheckedChange={setUlb} />
                <label htmlFor="ulb">ULB</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="rlb" checked={rlb} onCheckedChange={setRlb} />
                <label htmlFor="rlb">RLB</label>
              </div>
            </div>
            <Button onClick={handleGetData} className="mt-4">Get Data</Button>

            {data.length > 0 && (
              <table className="w-full mt-4">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>District</th>
                    <th>Parliament</th>
                    <th>Assembly</th>
                    <th>ULB</th>
                    <th>RLB</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.district}</td>
                      <td>{row.parliament}</td>
                      <td>{row.assembly}</td>
                      <td>{row.ulb}</td>
                      <td>{row.rlb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Projects;
