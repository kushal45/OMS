import React, { useState, useCallback, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Typography,
  Box,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  DarkMode,
  LightMode,
  Refresh,
  Hub,
} from '@mui/icons-material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useWebSocket } from './hooks/useWebSocket';
import { LoginForm } from './components/LoginForm';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SubscriptionControls } from './components/SubscriptionControls';
import { EventDisplay } from './components/EventDisplay';

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [lastPing, setLastPing] = useState<Date>();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const {
    state,
    connect,
    disconnect,
    subscribeToOrders,
    subscribeToInventory,
    unsubscribeFromOrders,
    unsubscribeFromInventory,
    ping,
    notifications,
    orderUpdates,
    inventoryUpdates,
    clearNotifications,
    clearOrderUpdates,
    clearInventoryUpdates,
  } = useWebSocket();

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
    },
  });

  // Handle ping with timestamp
  const handlePing = useCallback(() => {
    ping();
    setLastPing(new Date());
    showSnackbar('Ping sent to server', 'info');
  }, [ping]);

  // Handle reconnection
  const handleReconnect = useCallback(async () => {
    disconnect();
    // Wait a moment before reconnecting
    setTimeout(() => {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        connect(token);
      }
    }, 1000);
  }, [connect, disconnect]);

  // Handle login
  const handleLogin = useCallback(async (token: string) => {
    try {
      localStorage.setItem('jwt_token', token);
      await connect(token);
      showSnackbar('Successfully connected to WebSocket!', 'success');
    } catch (error) {
      showSnackbar('Failed to connect. Please check your token.', 'error');
      throw error;
    }
  }, [connect]);

  // Handle logout
  const handleLogout = useCallback(() => {
    disconnect();
    localStorage.removeItem('jwt_token');
    showSnackbar('Disconnected from WebSocket', 'info');
  }, [disconnect]);

  // Show snackbar notification
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Auto-connect on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token && !state.connected && !state.connecting) {
      connect(token).catch(() => {
        localStorage.removeItem('jwt_token');
      });
    }
  }, [connect, state.connected, state.connecting]);

  // Toast notifications for real-time events
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      toast.info(`${latestNotification.title}: ${latestNotification.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [notifications]);

  useEffect(() => {
    if (orderUpdates.length > 0) {
      const latestOrder = orderUpdates[0];
      toast.success(`Order ${latestOrder.aliasId}: ${latestOrder.status}`, {
        position: "top-right",
        autoClose: 4000,
      });
    }
  }, [orderUpdates]);

  useEffect(() => {
    if (inventoryUpdates.length > 0) {
      const latestInventory = inventoryUpdates[0];
      const severity = latestInventory.status === 'out_of_stock' ? 'error' : 
                      latestInventory.status === 'low_stock' ? 'warn' : 'success';
      
      if (severity === 'error') {
        toast.error(`Product ${latestInventory.productId} is out of stock!`);
      } else if (severity === 'warn') {
        toast.warn(`Product ${latestInventory.productId} is low in stock (${latestInventory.quantity})`);
      } else {
        toast.success(`Product ${latestInventory.productId} has been restocked!`);
      }
    }
  }, [inventoryUpdates]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Hub sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            OMS WebSocket Client
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                color="default"
              />
            }
            label={darkMode ? <DarkMode /> : <LightMode />}
            sx={{ mr: 2 }}
          />
          
          {state.connected && (
            <IconButton color="inherit" onClick={handleLogout}>
              <Refresh />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box mb={4} textAlign="center">
          <Typography variant="h4" component="h1" gutterBottom>
            WebSocket Real-Time Communication
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Connect to the OMS WebSocket server to receive real-time order and inventory updates
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Connection and Login */}
          <Grid item xs={12} lg={6}>
            {!state.connected ? (
              <LoginForm 
                onLogin={handleLogin} 
                isConnecting={state.connecting}
              />
            ) : (
              <ConnectionStatus
                state={state}
                onReconnect={handleReconnect}
                onPing={handlePing}
                lastPing={lastPing}
              />
            )}
          </Grid>

          {/* Subscription Controls */}
          <Grid item xs={12} lg={6}>
            <SubscriptionControls
              connected={state.connected}
              onSubscribeOrders={subscribeToOrders}
              onSubscribeInventory={subscribeToInventory}
              onUnsubscribeOrders={unsubscribeFromOrders}
              onUnsubscribeInventory={unsubscribeFromInventory}
              onClearNotifications={clearNotifications}
              onClearOrderUpdates={clearOrderUpdates}
              onClearInventoryUpdates={clearInventoryUpdates}
              notificationCount={notifications.length}
              orderUpdateCount={orderUpdates.length}
              inventoryUpdateCount={inventoryUpdates.length}
            />
          </Grid>

          {/* Real-Time Events Display */}
          <Grid item xs={12}>
            <EventDisplay
              notifications={notifications}
              orderUpdates={orderUpdates}
              inventoryUpdates={inventoryUpdates}
            />
          </Grid>
        </Grid>

        {/* Usage Instructions */}
        <Box mt={6} p={3} sx={{ backgroundColor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            📋 How to Use This Client
          </Typography>
          
          <Typography variant="body2" component="div" color="text.secondary">
            <ol>
              <li><strong>Connect:</strong> Use one of the sample JWT tokens or provide your own to authenticate</li>
              <li><strong>Subscribe:</strong> Toggle the switches to subscribe to order updates and inventory alerts</li>
              <li><strong>Monitor:</strong> Watch real-time events appear in the tabs below</li>
              <li><strong>Test:</strong> Use the ping button to test the connection</li>
              <li><strong>Interact:</strong> Click on event items to expand and see detailed JSON data</li>
            </ol>
          </Typography>
          
          <Box mt={2}>
            <Typography variant="caption" color="text.secondary">
              💡 <strong>Pro Tip:</strong> Open the browser's developer console to see detailed WebSocket logs and events.
              Enable notifications in your browser to get desktop alerts for important events.
            </Typography>
          </Box>
        </Box>

        {/* Footer */}
        <Box mt={4} pt={2} borderTop={1} borderColor="divider" textAlign="center">
          <Typography variant="caption" color="text.secondary">
            OMS WebSocket Client • Built with React, TypeScript, Material-UI & Socket.IO
            <br />
            Server: ws://localhost:3000/events
          </Typography>
        </Box>
      </Container>

      {/* Snackbar for system notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* React Toastify Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={darkMode ? 'dark' : 'light'}
      />
    </ThemeProvider>
  );
};

export default App;