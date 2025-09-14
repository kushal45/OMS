import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailNotificationService, OrderNotificationEmailData } from '@lib/notifications';

interface SentryWebhookPayload {
  action: string;
  data: {
    event: {
      id: string;
      message: string;
      level: string;
      tags: Record<string, string>;
      contexts: Record<string, any>;
      timestamp: string;
    };
  };
}

@Controller('webhooks/sentry')
export class SentryWebhookController {
  private readonly logger = new Logger(SentryWebhookController.name);
  private readonly webhookSecret: string;
  private readonly notificationRecipients: string[];

  constructor(
    private readonly emailService: EmailNotificationService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('SENTRY_WEBHOOK_SECRET', '');
    this.notificationRecipients = this.configService
      .get<string>('ORDER_NOTIFICATION_RECIPIENTS', '')
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (this.notificationRecipients.length === 0) {
      this.logger.warn('No notification recipients configured. Email notifications will not be sent.');
    }
  }

  @Post('order-alerts')
  @HttpCode(HttpStatus.OK)
  async handleSentryOrderAlert(
    @Body() payload: SentryWebhookPayload,
    @Headers('x-sentry-signature') signature: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate webhook signature if configured
      if (this.webhookSecret && signature) {
        // In production, you should validate the signature
        // This is a simplified example
        this.logger.log('Webhook signature validation would be performed here');
      }

      this.logger.log(`Received Sentry webhook: ${JSON.stringify(payload, null, 2)}`);

      // Check if this is an order creation event
      if (!this.isOrderCreationEvent(payload)) {
        this.logger.log('Webhook payload is not an order creation event, ignoring');
        return { success: true, message: 'Event ignored - not an order creation event' };
      }

      // Extract order information from the Sentry event
      const orderData = this.extractOrderDataFromSentryEvent(payload);

      if (!orderData) {
        this.logger.error('Could not extract order data from Sentry event');
        return { success: false, message: 'Could not extract order data from event' };
      }

      // Send email notification
      if (this.notificationRecipients.length > 0) {
        const emailData: OrderNotificationEmailData = {
          to: this.notificationRecipients,
          orderData,
          timestamp: new Date(payload.data.event.timestamp),
        };

        await this.emailService.sendOrderCreationNotification(emailData);
        this.logger.log(`Order creation notification email sent for order ${orderData.aliasId}`);
      }

      return { success: true, message: 'Notification processed successfully' };
    } catch (error) {
      this.logger.error(`Error processing Sentry webhook: ${error.message}`, error.stack);
      return { success: false, message: 'Internal server error' };
    }
  }

  private isOrderCreationEvent(payload: SentryWebhookPayload): boolean {
    const tags = payload.data.event.tags || {};
    return (
      tags.event_type === 'order_created' &&
      payload.data.event.level === 'info' &&
      payload.data.event.message.includes('created successfully')
    );
  }

  private extractOrderDataFromSentryEvent(payload: SentryWebhookPayload): any | null {
    try {
      const contexts = payload.data.event.contexts || {};
      const tags = payload.data.event.tags || {};

      const orderDetails = contexts.order_details;
      const orderItems = contexts.order_items?.items || [];

      if (!orderDetails || !orderDetails.orderId || !orderDetails.aliasId) {
        this.logger.error('Missing required order data in Sentry event');
        return null;
      }

      return {
        orderId: orderDetails.orderId,
        aliasId: orderDetails.aliasId,
        userId: orderDetails.userId,
        totalAmount: orderDetails.totalAmount,
        userEmail: orderDetails.userEmail,
        customerName: orderDetails.customerName,
        orderItems: orderItems,
      };
    } catch (error) {
      this.logger.error(`Error extracting order data from Sentry event: ${error.message}`);
      return null;
    }
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testWebhook(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.notificationRecipients.length === 0) {
        return { success: false, message: 'No notification recipients configured' };
      }

      // Send a test email to verify the webhook system is working
      await this.emailService.sendTestEmail(this.notificationRecipients[0]);
      
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      this.logger.error(`Error sending test email: ${error.message}`);
      return { success: false, message: 'Failed to send test email' };
    }
  }
}