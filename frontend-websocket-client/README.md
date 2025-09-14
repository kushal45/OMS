# OMS WebSocket Client

A comprehensive React TypeScript frontend client for testing and demonstrating the OMS WebSocket functionality.

## Features

### 🔐 **Authentication**
- JWT token-based authentication
- Sample tokens provided for quick testing
- Secure connection management
- Auto-reconnection with exponential backoff

### 📡 **Real-Time Communication**
- Order status updates
- Inventory alerts and notifications
- System-wide announcements
- User-specific notifications
- Role-based messaging

### 🎨 **User Interface**
- Modern Material-UI design
- Dark/light theme support
- Responsive layout for all devices
- Real-time event display with expandable details
- Toast notifications for immediate feedback

### 🛠️ **WebSocket Management**
- Connection status monitoring
- Subscription controls for different event types
- Ping/pong testing
- Event history with filtering
- Data persistence using localStorage

## Quick Start

### Prerequisites

- Node.js 16+ installed
- OMS WebSocket server running on `localhost:3000`

### Installation

```bash
# Navigate to the client directory
cd frontend-websocket-client

# Install dependencies
npm install

# Start the development server
npm start
```

The application will open at `http://localhost:3000` (the React dev server will use port 3001 if 3000 is taken by the WebSocket server).

### Using the Client

1. **Connect**: Use one of the sample JWT tokens or provide your own
2. **Subscribe**: Toggle switches to subscribe to order updates and inventory alerts
3. **Monitor**: Watch real-time events in the tabbed interface
4. **Interact**: Click on events to expand and see detailed JSON data
5. **Test**: Use the ping button to test server connectivity

## Sample JWT Tokens

The client includes three pre-configured JWT tokens for testing:

- **Admin User**: Full access to all events and admin notifications
- **Customer User**: Receives order updates for their user ID
- **Staff User**: Receives role-based staff notifications

> **Note**: These are demo tokens. In production, obtain tokens from your authentication service.

## Components Overview

### Core Components

- **`App.tsx`**: Main application component with state management
- **`useWebSocket`**: Custom React hook for WebSocket functionality
- **`WebSocketService`**: Core WebSocket communication service

### UI Components

- **`LoginForm`**: JWT authentication interface
- **`ConnectionStatus`**: Connection state and controls
- **`SubscriptionControls`**: Event subscription management
- **`EventDisplay`**: Real-time event visualization

## WebSocket Events

### Supported Event Types

1. **Order Updates**
   - Order creation notifications
   - Status change updates
   - Order cancellations

2. **Inventory Alerts**
   - Low stock warnings
   - Out of stock alerts
   - Restocking notifications

3. **User Notifications**
   - Personal user messages
   - Account updates

4. **System Notifications**
   - Maintenance announcements
   - System-wide alerts

## Configuration

### Environment Variables

Create a `.env` file in the client directory:

```bash
REACT_APP_WEBSOCKET_URL=ws://localhost:3000
```

### WebSocket Server Configuration

Ensure your OMS WebSocket server is configured with:

- CORS enabled for `http://localhost:3001` (or your client URL)
- JWT authentication working
- All event types properly implemented

## Development

### Available Scripts

- `npm start`: Start development server
- `npm build`: Build for production
- `npm test`: Run tests
- `npm eject`: Eject from Create React App (not recommended)

### Project Structure

```
src/
├── components/          # React UI components
│   ├── ConnectionStatus.tsx
│   ├── LoginForm.tsx
│   ├── SubscriptionControls.tsx
│   └── EventDisplay.tsx
├── hooks/              # Custom React hooks
│   └── useWebSocket.ts
├── services/           # Core services
│   └── websocket.service.ts
├── App.tsx            # Main application
└── index.tsx          # Application entry point
```

## Features in Detail

### 🔄 **Auto-Reconnection**
- Automatic reconnection on connection loss
- Exponential backoff strategy
- Visual connection status indicators

### 📊 **Event Management**
- Real-time event display with timestamps
- Event categorization (orders, inventory, notifications)
- Event count badges and clearing functionality
- Detailed JSON inspection for debugging

### 🎨 **Theme Support**
- Dark and light theme toggle
- Material-UI theming system
- Consistent design language

### 📱 **Responsive Design**
- Mobile-first approach
- Tablet and desktop optimized layouts
- Touch-friendly interactions

### 🔔 **Notification System**
- Toast notifications for real-time events
- System notifications for connection status
- Browser notification support (optional)

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify WebSocket server is running on `localhost:3000`
   - Check CORS configuration on server
   - Ensure JWT token is valid

2. **No Events Received**
   - Subscribe to appropriate event types
   - Check server logs for event generation
   - Verify user permissions and roles

3. **UI Issues**
   - Clear browser cache and localStorage
   - Check browser console for JavaScript errors
   - Ensure all dependencies are installed

### Debug Mode

Open browser developer tools to see:
- WebSocket connection logs
- Event payloads and responses
- Network activity
- Console errors and warnings

## Browser Support

- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

## Security Considerations

- JWT tokens are stored in localStorage (for demo purposes)
- HTTPS should be used in production
- Implement proper token refresh mechanisms
- Validate all server responses

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the OMS system and follows the same licensing terms.

---

For more information about the WebSocket server implementation, see the [WebSocket Integration Guide](../docs/WEBSOCKET_INTEGRATION_GUIDE.md).