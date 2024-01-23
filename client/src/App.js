import React, { useState } from 'react';
import { Button, CircularProgress, Box, Typography, Stack, TextField } from '@mui/material';
import AceEditor from "react-ace";
import { DataGrid } from '@mui/x-data-grid';

// Import the necessary themes and modes from Ace
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/theme-monokai";

function App() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [maxPageSize, setMaxPageSize] = useState(10); 
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('http://localhost:3001/submit-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxPageSize }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        if (data.length > 0) {
          setHeaders(Object.keys(data[0]));
        }

        const formattedRows = data.map((item, index) => ({ id: index, ...item }));
        setRows(formattedRows);
      } else {
        if (response?.headers?.get('Content-Type')?.includes('application/json')) {
          const error = await response.json();

          setErrorMessage(error?.message);
        } else {
          setErrorMessage('An unexpected error occurred.');
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setIsLoading(false);
  };

  // Create columns based on row data
  const createColumns = (rows) => {
    if (rows.length === 0) {
      return [];
    }
    return Object.keys(rows[0]).map((key) => ({
      field: key,
      headerName: key.charAt(0).toUpperCase() + key.slice(1),
      flex: 1,
      minWidth: 150,
    }));
  };

  const columns = createColumns(rows);

  return (
    <div className="App">
      <Box sx={{ width: '80%', height: '50px', margin: 'auto' }}>
        <Typography variant="h4" align="center">
          DynamoDB Query Executor
        </Typography>
      </Box>
      <Box sx={{ width: '80%', height: '300px', margin: 'auto' }}>
        <AceEditor
          mode="sql"
          theme="monokai"
          value={query}
          onChange={setQuery}
          name="SQL_EDITOR"
          editorProps={{ $blockScrolling: true }}
          fontSize={14}
          showPrintMargin={true}
          showGutter={true}
          highlightActiveLine={true}
          setOptions={{
            enableBasicAutocompletion: false,
            enableLiveAutocompletion: false,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 2,
          }}
          style={{ width: '100%', height: '100%' }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Max Page Size" type="number" value={maxPageSize} onChange={e => setMaxPageSize(e.target.value)} disabled={isLoading} size='small' />
            <Button variant="contained" color="primary" onClick={handleSubmit} disabled={isLoading}>
              Submit Query
            </Button>
            {isLoading && <CircularProgress />}
          </Stack>
        </Box>
        <Box sx={{ width: '80%', height: '50px', margin: 'auto' }}>
          <Typography variant="caption" align="center" color={'red'}>
            {errorMessage}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ height: '600px', width: '80%', margin: '80px auto' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10]}
          checkboxSelection={false}
          disableSelectionOnClick
        />
      </Box>
      {/* <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((item, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header, colIndex) => (
                <td key={colIndex}>{item[header]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table> */}
    </div>
  );
}

export default App;
