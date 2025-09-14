import React from 'react';
import {
  Box,
  Chip,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Refresh,
  Person,
  AccessTime,
} from '@mui/icons-material';
import { WebSocketState } from '../hooks/useWebSocket';

interface ConnectionStatusProps {
  state: WebSocketState;
  onReconnect: () => void;
  onPing: () => void;
  lastPing?: Date;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  onReconnect,
  onPing,
  lastPing,
}) => {
  const getStatusColor = () => {
    if (state.connecting) return 'info';
    if (state.connected) return 'success';
    if (state.error) return 'error';
    return 'default';
  };

  const getStatusIcon = () => {
    if (state.connecting) return <CircularProgress size={16} />;
    if (state.connected) return <CheckCircle />;
    if (state.error) return <Error />;
    return <Warning />;
  };

  const getStatusText = () => {
    if (state.connecting) return 'Connecting...';
    if (state.connected) return 'Connected';
    if (state.error) return 'Disconnected';
    return 'Not Connected';
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="h2">
            WebSocket Connection
          </Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="Ping Server">
              <IconButton 
                onClick={onPing} 
                disabled={!state.connected}
                size="small"
              >
                <AccessTime />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reconnect">
              <IconButton 
                onClick={onReconnect} 
                disabled={state.connecting || state.connected}
                size="small"
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Chip
            icon={getStatusIcon()}
            label={getStatusText()}
            color={getStatusColor() as any}
            variant="filled"
          />
          
          {state.userId && (
            <Chip
              icon={<Person />}
              label={`User: ${state.userId}`}
              variant="outlined"
              size="small"
            />
          )}
          
          {state.userRole && (
            <Chip
              label={`Role: ${state.userRole}`}
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {state.error && (
          <Box mb={2}>
            <Typography variant="body2" color="error" sx={{ wordBreak: 'break-word' }}>
              <strong>Error:</strong> {state.error}
            </Typography>
          </Box>
        )}

        {lastPing && (
          <Typography variant="caption" color="text.secondary">
            Last ping: {lastPing.toLocaleTimeString()}
          </Typography>
        )}

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary" display="block">
            Endpoint: ws://localhost:3000/events
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Protocol: Socket.IO WebSocket
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};