import React, { useState, useEffect, useCallback } from 'react';
import DataTable from '../components/DataTable';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { uploadAPMapping, fetchAPMappingData } from '../api'; // Import new API functions
import { useToast } from '../hooks/use-toast'; // Import the useToast hook

const ExcelDataViewer = () => {
  const { user } = useAuth();
  const { toast } = useToast(); // Initialize the toast hook
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    Zone: '',
    District: '',
    'Parliament Constituency': '',
    'Assembly Constituency': '',
  });
  const [allData, setAllData] = useState([]); // Store the complete dataset for filters
  const [dropdownOptions, setDropdownOptions] = useState({
    Zone: [],
    District: [],
    'Parliament Constituency': [],
    'Assembly Constituency': [],
  });

  const fetchData = useCallback(async (currentFilters = filters) => {
    setIsLoading(true);
    try {
      const result = await fetchAPMappingData(currentFilters);
      setData(result);

      // If this is the initial fetch, store the complete dataset
      if (Object.values(currentFilters).every(f => f === '')) {
        setAllData(result);
      }
    } catch (error) {
      console.error("Failed to fetch AP mapping data:", error);
      toast({
        title: "Error",
        description: "Failed to load data from the server.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Fetch initial data only once on component mount

  // Effect to update dropdown options only when the complete dataset changes
  useEffect(() => {
    if (allData.length > 0) {
      const options = {
        Zone: [...new Set(allData.map(item => item.Zone))].sort(),
        District: [...new Set(allData.map(item => item.District))].sort(),
        'Parliament Constituency': [...new Set(allData.map(item => item['Parliament Constituency']))].sort(),
        'Assembly Constituency': [...new Set(allData.map(item => item['Assembly Constituency']))].sort(),
      };
      setDropdownOptions(options);
    }
  }, [allData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setIsLoading(true);
        const response = await uploadAPMapping(file);
        toast({
          title: "Success",
          description: response.message,
        });
        fetchData(); // Refresh data after successful upload
      } catch (error) {
        console.error("File upload failed:", error);
        toast({
          title: "Error",
          description: "File upload failed. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleGetData = () => {
    fetchData(filters);
  };

  const handleClearFilter = () => {
    const clearedFilters = {
      Zone: '',
      District: '',
      'Parliament Constituency': '',
      'Assembly Constituency': '',
    };
    setFilters(clearedFilters);
    // Reset to the full dataset without a new API call
    setData(allData);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Andhra Pradesh Zone to Booth Mapping</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
        {user && user.email === 'pardhasaradhi@showtimeconsulting.in' && (
          <div className="flex items-center gap-2">
            <label htmlFor="excel-upload" className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
              Upload New Excel File
            </label>
            <input
              id="excel-upload"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

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
              {dropdownOptions[key].map((option, index) => (
                <SelectItem key={`${option}-${index}`} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <Button onClick={handleGetData} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Get Data'}
        </Button>
        <Button variant="outline" onClick={handleClearFilter}>Clear Filter</Button>
      </div>

      {isLoading ? <p>Loading data...</p> : <DataTable data={data} />}
    </div>
  );
};

export default ExcelDataViewer;
