import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Badge,
  Alert,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Notifications,
  ShoppingCart,
  Inventory,
  AccessTime,
  CheckCircle,
  Warning,
  Error,
  Info,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { OrderStatusUpdate, InventoryUpdate, UserNotification } from '../services/websocket.service';

interface EventDisplayProps {
  notifications: UserNotification[];
  orderUpdates: OrderStatusUpdate[];
  inventoryUpdates: InventoryUpdate[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`event-tabpanel-${index}`}
      aria-labelledby={`event-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
};

export const EventDisplay: React.FC<EventDisplayProps> = ({
  notifications,
  orderUpdates,
  inventoryUpdates,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'created':
        return <Info color="info" />;
      case 'confirmed':
        return <CheckCircle color="success" />;
      case 'shipped':
        return <CheckCircle color="primary" />;
      case 'delivered':
        return <CheckCircle color="success" />;
      case 'cancelled':
        return <Error color="error" />;
      default:
        return <Info />;
    }
  };

  const getInventoryStatusIcon = (status: string) => {
    switch (status) {
      case 'low_stock':
        return <Warning color="warning" />;
      case 'out_of_stock':
        return <Error color="error" />;
      case 'restocked':
        return <CheckCircle color="success" />;
      default:
        return <Info />;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_created':
        return <ShoppingCart color="primary" />;
      case 'order_status_update':
        return <ShoppingCart color="info" />;
      case 'system':
        return <Info color="info" />;
      case 'role':
        return <Notifications color="secondary" />;
      default:
        return <Notifications />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return format(date, 'HH:mm:ss MMM dd');
    } catch {
      return 'Invalid date';
    }
  };

  const renderNotifications = () => {
    if (notifications.length === 0) {
      return (
        <Alert severity="info">
          No notifications received yet. Connect and subscribe to start receiving events.
        </Alert>
      );
    }

    return (
      <List>
        {notifications.map((notification, index) => {
          const itemId = `notification-${index}`;
          const isExpanded = expandedItems.has(itemId);
          
          return (
            <Paper key={index} elevation={1} sx={{ mb: 1 }}>
              <ListItem>
                <ListItemIcon>
                  {getNotificationIcon(notification.type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2">
                        {notification.title}
                      </Typography>
                      <Chip 
                        label={notification.type} 
                        size="small" 
                        variant="outlined" 
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <AccessTime fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'text-bottom' }} />
                        {formatTimestamp(notification.timestamp)}
                      </Typography>
                    </Box>
                  }
                />
                {notification.data && (
                  <Tooltip title={isExpanded ? "Collapse details" : "Expand details"}>
                    <IconButton onClick={() => toggleExpanded(itemId)} size="small">
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Tooltip>
                )}
              </ListItem>
              {isExpanded && notification.data && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Event Data:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mt: 0.5, backgroundColor: 'grey.50' }}>
                    <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(notification.data, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Paper>
          );
        })}
      </List>
    );
  };

  const renderOrderUpdates = () => {
    if (orderUpdates.length === 0) {
      return (
        <Alert severity="info">
          No order updates received yet. Subscribe to order updates to see them here.
        </Alert>
      );
    }

    return (
      <List>
        {orderUpdates.map((update, index) => {
          const itemId = `order-${index}`;
          const isExpanded = expandedItems.has(itemId);
          
          return (
            <Paper key={index} elevation={1} sx={{ mb: 1 }}>
              <ListItem>
                <ListItemIcon>
                  {getOrderStatusIcon(update.status)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2">
                        Order {update.aliasId}
                      </Typography>
                      <Chip 
                        label={update.status.toUpperCase()} 
                        size="small" 
                        color={update.status === 'delivered' ? 'success' : update.status === 'cancelled' ? 'error' : 'primary'}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      {update.message && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {update.message}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        <AccessTime fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'text-bottom' }} />
                        {formatTimestamp(update.timestamp)} • User ID: {update.userId}
                      </Typography>
                    </Box>
                  }
                />
                <Tooltip title={isExpanded ? "Collapse details" : "Expand details"}>
                  <IconButton onClick={() => toggleExpanded(itemId)} size="small">
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Tooltip>
              </ListItem>
              {isExpanded && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Order Details:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mt: 0.5, backgroundColor: 'grey.50' }}>
                    <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(update, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Paper>
          );
        })}
      </List>
    );
  };

  const renderInventoryUpdates = () => {
    if (inventoryUpdates.length === 0) {
      return (
        <Alert severity="info">
          No inventory updates received yet. Subscribe to inventory updates to see them here.
        </Alert>
      );
    }

    return (
      <List>
        {inventoryUpdates.map((update, index) => {
          const itemId = `inventory-${index}`;
          const isExpanded = expandedItems.has(itemId);
          
          return (
            <Paper key={index} elevation={1} sx={{ mb: 1 }}>
              <ListItem>
                <ListItemIcon>
                  {getInventoryStatusIcon(update.status)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle2">
                        Product {update.productId}
                      </Typography>
                      <Chip 
                        label={update.status.replace('_', ' ').toUpperCase()} 
                        size="small" 
                        color={update.status === 'restocked' ? 'success' : update.status === 'out_of_stock' ? 'error' : 'warning'}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        Quantity: {update.quantity}
                        {update.threshold && ` (Threshold: ${update.threshold})`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <AccessTime fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'text-bottom' }} />
                        {formatTimestamp(update.timestamp)}
                      </Typography>
                    </Box>
                  }
                />
                <Tooltip title={isExpanded ? "Collapse details" : "Expand details"}>
                  <IconButton onClick={() => toggleExpanded(itemId)} size="small">
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Tooltip>
              </ListItem>
              {isExpanded && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Inventory Details:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mt: 0.5, backgroundColor: 'grey.50' }}>
                    <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(update, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Paper>
          );
        })}
      </List>
    );
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" component="h2" mb={2}>
          Real-Time Events
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="event tabs">
            <Tab
              label={
                <Badge badgeContent={notifications.length} color="primary" max={99}>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Notifications fontSize="small" />
                    Notifications
                  </Box>
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={orderUpdates.length} color="primary" max={99}>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ShoppingCart fontSize="small" />
                    Orders
                  </Box>
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={inventoryUpdates.length} color="primary" max={99}>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Inventory fontSize="small" />
                    Inventory
                  </Box>
                </Badge>
              }
            />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {renderNotifications()}
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          {renderOrderUpdates()}
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          {renderInventoryUpdates()}
        </TabPanel>
      </CardContent>
    </Card>
  );
};