import React from 'react';

const DataTable = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No data to display</p>;
  }

  const tableStyle = {
    borderCollapse: 'collapse',
    width: '100%',
    textAlign: 'center',
  };

  const thStyle = {
    border: '1px solid black',
    padding: '8px',
    backgroundColor: '#89bff8',
  };

  const tdStyle = {
    border: '1px solid black',
    padding: '8px',
  };

  const headers = Object.keys(data[0]);

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {headers.map(header => (
            <th key={header} style={thStyle}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {headers.map(header => (
              <td key={header} style={tdStyle}>{row[header]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DataTable;
