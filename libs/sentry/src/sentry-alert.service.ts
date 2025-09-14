import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

export interface OrderCreatedAlert {
  orderId: string;
  aliasId: string;
  userId: number;
  totalAmount: number;
  userEmail?: string;
  customerName?: string;
  orderItems?: Array<{
    productId: number;
    quantity: number;
    price: number;
  }>;
}

@Injectable()
export class SentryAlertService {
  private readonly logger = new Logger(SentryAlertService.name);

  constructor(private readonly configService: ConfigService) {
    this.initializeSentry();
  }

  private initializeSentry(): void {
    const sentryDsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV', 'development');

    if (!sentryDsn) {
      this.logger.warn('Sentry DSN not configured. Sentry alerts will be disabled.');
      return;
    }

    Sentry.init({
      dsn: sentryDsn,
      environment,
      integrations: [
        // Add any additional integrations you need
      ],
      tracesSampleRate: 1.0,
    });

    this.logger.log('Sentry initialized successfully');
  }

  /**
   * Captures an order creation success event for alerting
   * This will trigger Sentry alerts that can be configured to send email notifications
   */
  async captureOrderCreatedAlert(orderData: OrderCreatedAlert): Promise<void> {
    try {
      // Create a Sentry event with custom data
      Sentry.withScope((scope) => {
        scope.setTag('event_type', 'order_created');
        scope.setTag('order_alias_id', orderData.aliasId);
        scope.setTag('user_id', orderData.userId.toString());
        
        scope.setContext('order_details', {
          orderId: orderData.orderId,
          aliasId: orderData.aliasId,
          userId: orderData.userId,
          totalAmount: orderData.totalAmount,
          userEmail: orderData.userEmail,
          customerName: orderData.customerName,
          itemCount: orderData.orderItems?.length || 0,
        });

        scope.setContext('order_items', {
          items: orderData.orderItems || [],
        });

        scope.setLevel('info');

        // Capture a message (not an error) for successful order creation
        // This will appear in Sentry and can trigger alert rules
        Sentry.captureMessage(
          `Order ${orderData.aliasId} created successfully for user ${orderData.userId}`,
          'info'
        );
      });

      this.logger.log(`Sentry alert captured for order ${orderData.aliasId}`);
    } catch (error) {
      this.logger.error(`Failed to capture Sentry alert for order ${orderData.aliasId}: ${error.message}`);
      // Don't throw the error - alerting failure shouldn't break order creation
    }
  }

  /**
   * Captures order creation errors for monitoring
   */
  async captureOrderCreationError(error: Error, orderData?: Partial<OrderCreatedAlert>): Promise<void> {
    try {
      Sentry.withScope((scope) => {
        scope.setTag('event_type', 'order_creation_failed');
        
        if (orderData) {
          scope.setTag('user_id', orderData.userId?.toString());
          scope.setContext('order_attempt', orderData);
        }

        scope.setLevel('error');
        
        Sentry.captureException(error);
      });

      this.logger.error(`Sentry error captured for order creation failure: ${error.message}`);
    } catch (captureError) {
      this.logger.error(`Failed to capture Sentry error: ${captureError.message}`);
    }
  }

  /**
   * Test method to verify Sentry is working correctly
   */
  async testSentryIntegration(): Promise<void> {
    try {
      Sentry.captureMessage('Sentry integration test - OMS Order Service', 'info');
      this.logger.log('Sentry test message sent successfully');
    } catch (error) {
      this.logger.error(`Sentry test failed: ${error.message}`);
    }
  }
}