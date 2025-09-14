import React, { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Person from '@mui/icons-material/Person';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Login from '@mui/icons-material/Login';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Typography from '@mui/material/Typography';

interface LoginFormProps {
  onLogin: (token: string) => Promise<void>;
  isConnecting: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin, isConnecting }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sample JWT tokens for testing
  const sampleTokens = [
    {
      label: 'Admin User',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJJZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjoxNjMwMDg2NDAwfQ.dummy',
    },
    {
      label: 'Customer User',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInVzZXJJZCI6MiwidXNlcm5hbWUiOiJjdXN0b21lciIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjoxNjMwMDg2NDAwfQ.dummy',
    },
    {
      label: 'Staff User',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInVzZXJJZCI6MywidXNlcm5hbWUiOiJzdGFmZiIsInJvbGUiOiJzdGFmZiIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjoxNjMwMDg2NDAwfQ.dummy',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Please enter a JWT token');
      return;
    }

    setError(null);
    
    try {
      await onLogin(token);
    } catch (err) {
      setError('Failed to connect. Please check your token and server.');
    }
  };

  const handleTokenSelect = (selectedToken: string) => {
    setToken(selectedToken);
    setError(null);
  };

   return (
    <Card elevation={2} sx={{ maxWidth: 600, mx: 'auto' }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Person sx={{ mr: 1 }} />
          <Typography variant="h6" component="h2">
            WebSocket Authentication
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem' }}>
              Quick Login (Sample Tokens)
            </FormLabel>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {sampleTokens.map((sample) => (
                <Chip
                  key={sample.label}
                  label={sample.label}
                  onClick={() => handleTokenSelect(sample.token)}
                  variant={token === sample.token ? 'filled' : 'outlined'}
                  color={token === sample.token ? 'primary' : 'default'}
                  clickable
                />
              ))}
            </Box>
          </FormControl>

          <TextField
            fullWidth
            label="JWT Token"
            variant="outlined"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isConnecting}
            multiline
            rows={4}
            placeholder="Enter your JWT token here..."
            sx={{ mb: 2 }}
            helperText="Enter a valid JWT token to authenticate with the WebSocket server"
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isConnecting || !token.trim()}
            startIcon={<Login />}
            size="large"
          >
            {isConnecting ? 'Connecting...' : 'Connect to WebSocket'}
          </Button>
        </form>

        <Box mt={3}>
          <Typography variant="body2" color="text.secondary">
            <strong>Note:</strong> In a real application, you would obtain this token from your authentication service.
            For testing, you can use one of the sample tokens above or provide your own JWT token.
          </Typography>
        </Box>

        <Box mt={2}>
          <ul style={{ paddingLeft: 16, marginTop: 4 }}>
            <li>Valid JWT format</li>
            <li>Must contain 'sub' or 'userId' claim</li>
            <li>Optional 'role' claim for role-based features</li>
            <li>Must be signed with the server's secret key</li>
          </ul>
        </Box>
      </CardContent>
    </Card>
  );
};