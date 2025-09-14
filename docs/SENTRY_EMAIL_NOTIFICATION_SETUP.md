# Sentry Alerting and Email Notification Setup

This document provides comprehensive instructions for setting up Sentry alerting integrated with email notifications for order creation events in the OMS system.

## Overview

The system integrates Sentry alerting with email notifications to automatically send emails when orders are successfully created. The flow works as follows:

1. When an order is successfully created, the OrderService triggers a Sentry alert
2. Sentry captures the alert with order details and metadata
3. Sentry webhook sends the alert to the OMS webhook endpoint
4. The webhook controller processes the alert and triggers email notifications
5. Emails are sent to configured recipients with order details

## Prerequisites

1. **Sentry Account**: You need a Sentry account and project set up
2. **Email Provider**: SMTP access (Gmail, SendGrid, etc.)
3. **Environment Variables**: Properly configured environment variables

## Step 1: Sentry Setup

### 1.1 Create Sentry Project

1. Go to [Sentry.io](https://sentry.io) and create an account
2. Create a new project for your OMS application
3. Choose "Node.js" as the platform
4. Copy the DSN from the project settings

### 1.2 Configure Alert Rules

1. Go to your Sentry project dashboard
2. Navigate to **Alerts** > **Alert Rules**
3. Click **Create Alert Rule**
4. Configure the alert rule for order creation:
   - **Environment**: Choose your environment (e.g., production, staging)
   - **Event Type**: Message
   - **Conditions**: 
     - `event.tags.event_type` equals `order_created`
     - `event.level` equals `info`
   - **Actions**: Webhook
   - **Webhook URL**: `https://your-domain.com/webhooks/sentry/order-alerts`

### 1.3 Set Up Webhook

1. In Sentry project settings, go to **Developer Settings** > **Webhooks**
2. Add a new webhook with:
   - **URL**: `https://your-domain.com/webhooks/sentry/order-alerts`
   - **Events**: Select "Issue" events
   - **Secret**: Generate a secret key for webhook validation

## Step 2: Environment Configuration

### 2.1 Update Environment Variables

Copy `.env.example` to `.env` and update the following variables:

```bash
# Sentry Configuration
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NODE_ENV=production

# Sentry Webhook Configuration
SENTRY_WEBHOOK_SECRET=your_generated_webhook_secret

# Email Configuration
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=oms@yourcompany.com

# Order Notification Recipients (comma-separated)
ORDER_NOTIFICATION_RECIPIENTS=admin@yourcompany.com,orders@yourcompany.com
```

### 2.2 Gmail App Password Setup (if using Gmail)

1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account settings
3. Navigate to Security > 2-Step Verification > App passwords
4. Generate an app password for "Mail"
5. Use this app password in `EMAIL_PASSWORD`

## Step 3: Testing the Integration

### 3.1 Test Sentry Connection

1. Start your application
2. Check the logs for "Sentry initialized successfully"
3. Use the test endpoint: `POST /webhooks/sentry/test`

### 3.2 Test Email Service

```bash
curl -X POST https://your-domain.com/webhooks/sentry/test
```

This should send a test email to the first configured recipient.

### 3.3 Test Order Creation Flow

1. Create an order through the normal API flow
2. Check Sentry dashboard for the captured event
3. Check if the webhook was triggered
4. Verify that the email notification was sent

## Step 4: Webhook Endpoint Configuration

The webhook endpoint is automatically configured at:
- **URL**: `/webhooks/sentry/order-alerts`
- **Method**: POST
- **Authentication**: Optional webhook secret validation

### Sample Webhook Payload

```json
{
  "action": "created",
  "data": {
    "event": {
      "id": "event-id",
      "message": "Order ORDER-123 created successfully for user 456",
      "level": "info",
      "tags": {
        "event_type": "order_created",
        "order_alias_id": "ORDER-123",
        "user_id": "456"
      },
      "contexts": {
        "order_details": {
          "orderId": "1",
          "aliasId": "ORDER-123",
          "userId": 456,
          "totalAmount": 99.99,
          "userEmail": "customer@example.com",
          "customerName": "John Doe"
        },
        "order_items": {
          "items": [
            {
              "productId": 101,
              "quantity": 2,
              "price": 49.99
            }
          ]
        }
      },
      "timestamp": "2023-12-01T12:00:00Z"
    }
  }
}
```

## Step 5: Email Template Customization

The email templates are defined in `EmailNotificationService`. To customize:

1. Modify the `generateOrderCreationEmailHtml` method for HTML content
2. Modify the `generateOrderCreationEmailText` method for plain text content
3. Update the subject line in the `sendOrderCreationNotification` method

### Sample Email Content

The system sends rich HTML emails with:
- Order details (ID, amount, customer info)
- List of order items
- Styling for professional appearance
- Automatic timestamp

## Step 6: Monitoring and Troubleshooting

### 6.1 Application Logs

Monitor the following log messages:
- "Sentry initialized successfully"
- "Sentry alert captured for order {aliasId}"
- "Order creation notification email sent successfully"

### 6.2 Error Handling

The system includes comprehensive error handling:
- Sentry failures won't break order creation
- Email failures won't break the notification flow
- All errors are logged for debugging

### 6.3 Common Issues

1. **Sentry events not appearing**: Check DSN configuration and network connectivity
2. **Webhook not triggered**: Verify Sentry alert rules and webhook URL
3. **Emails not sending**: Check SMTP credentials and network access
4. **Missing order data**: Verify order creation flow captures all required fields

## Step 7: Security Considerations

1. **Webhook Security**: Implement signature validation using `SENTRY_WEBHOOK_SECRET`
2. **Email Security**: Use app-specific passwords, not account passwords
3. **Environment Variables**: Never commit sensitive values to version control
4. **Rate Limiting**: Consider implementing rate limiting on webhook endpoints

## Step 8: Scaling Considerations

For high-volume environments:

1. **Async Processing**: Consider using a queue system for email processing
2. **Email Service**: Use dedicated email services like SendGrid or AWS SES
3. **Webhook Reliability**: Implement retry mechanisms and dead letter queues
4. **Monitoring**: Set up monitoring for email delivery rates and failures

## Example Configuration Files

### Docker Compose Addition

```yaml
environment:
  - SENTRY_DSN=https://your-dsn@sentry.io/project-id
  - EMAIL_NOTIFICATIONS_ENABLED=true
  - EMAIL_HOST=smtp.sendgrid.net
  - EMAIL_USER=apikey
  - EMAIL_PASSWORD=your-sendgrid-api-key
  - ORDER_NOTIFICATION_RECIPIENTS=alerts@yourcompany.com
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: oms-config
data:
  SENTRY_DSN: "https://your-dsn@sentry.io/project-id"
  EMAIL_NOTIFICATIONS_ENABLED: "true"
  EMAIL_HOST: "smtp.sendgrid.net"
  ORDER_NOTIFICATION_RECIPIENTS: "alerts@yourcompany.com"
```

## Support

If you encounter issues:

1. Check the application logs
2. Verify environment variables are set correctly
3. Test each component individually (Sentry, email, webhook)
4. Review Sentry dashboard for captured events
5. Check email service logs/dashboard for delivery status