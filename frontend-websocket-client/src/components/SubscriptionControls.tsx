import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Chip,
  Alert,
} from '@mui/material';
import {
  ShoppingCart,
  Inventory,
  Refresh,
  Clear,
  Notifications,
} from '@mui/icons-material';

interface SubscriptionControlsProps {
  connected: boolean;
  onSubscribeOrders: () => void;
  onSubscribeInventory: () => void;
  onUnsubscribeOrders: () => void;
  onUnsubscribeInventory: () => void;
  onClearNotifications: () => void;
  onClearOrderUpdates: () => void;
  onClearInventoryUpdates: () => void;
  notificationCount: number;
  orderUpdateCount: number;
  inventoryUpdateCount: number;
}

export const SubscriptionControls: React.FC<SubscriptionControlsProps> = ({
  connected,
  onSubscribeOrders,
  onSubscribeInventory,
  onUnsubscribeOrders,
  onUnsubscribeInventory,
  onClearNotifications,
  onClearOrderUpdates,
  onClearInventoryUpdates,
  notificationCount,
  orderUpdateCount,
  inventoryUpdateCount,
}) => {
  const [orderSubscribed, setOrderSubscribed] = useState(false);
  const [inventorySubscribed, setInventorySubscribed] = useState(false);

  const handleOrderSubscription = (subscribed: boolean) => {
    if (subscribed) {
      onSubscribeOrders();
    } else {
      onUnsubscribeOrders();
    }
    setOrderSubscribed(subscribed);
  };

  const handleInventorySubscription = (subscribed: boolean) => {
    if (subscribed) {
      onSubscribeInventory();
    } else {
      onUnsubscribeInventory();
    }
    setInventorySubscribed(subscribed);
  };

  if (!connected) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" component="h2" mb={2}>
            Event Subscriptions
          </Typography>
          <Alert severity="warning">
            Connect to WebSocket to manage subscriptions
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" component="h2" mb={2}>
          Event Subscriptions
        </Typography>

        <Box mb={3}>
          <FormControlLabel
            control={
              <Switch
                checked={orderSubscribed}
                onChange={(e) => handleOrderSubscription(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <ShoppingCart fontSize="small" />
                <span>Order Updates</span>
                {orderUpdateCount > 0 && (
                  <Chip size="small" label={orderUpdateCount} color="primary" />
                )}
              </Box>
            }
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
            Receive real-time order status updates, creation notifications, and cancellations
          </Typography>
        </Box>

        <Box mb={3}>
          <FormControlLabel
            control={
              <Switch
                checked={inventorySubscribed}
                onChange={(e) => handleInventorySubscription(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <Inventory fontSize="small" />
                <span>Inventory Alerts</span>
                {inventoryUpdateCount > 0 && (
                  <Chip size="small" label={inventoryUpdateCount} color="secondary" />
                )}
              </Box>
            }
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
            Get notified about low stock, out of stock, and restocking events
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="subtitle2" component="h3" mb={2}>
            Data Management
          </Typography>
          
          <Box display="flex" flexWrap="wrap" gap={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Clear />}
              onClick={onClearNotifications}
              disabled={notificationCount === 0}
            >
              Clear Notifications
              {notificationCount > 0 && ` (${notificationCount})`}
            </Button>
            
            <Button
              size="small"
              variant="outlined"
              startIcon={<Clear />}
              onClick={onClearOrderUpdates}
              disabled={orderUpdateCount === 0}
            >
              Clear Orders
              {orderUpdateCount > 0 && ` (${orderUpdateCount})`}
            </Button>
            
            <Button
              size="small"
              variant="outlined"
              startIcon={<Clear />}
              onClick={onClearInventoryUpdates}
              disabled={inventoryUpdateCount === 0}
            >
              Clear Inventory
              {inventoryUpdateCount > 0 && ` (${inventoryUpdateCount})`}
            </Button>
          </Box>
        </Box>

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            💡 <strong>Tip:</strong> Enable subscriptions to receive real-time events from the OMS system.
            You'll automatically receive user-specific notifications and system announcements.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};