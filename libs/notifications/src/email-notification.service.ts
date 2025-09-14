import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OrderCreatedAlert } from '@lib/sentry';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface OrderNotificationEmailData {
  to: string[];
  orderData: OrderCreatedAlert;
  timestamp: Date;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailConfig: EmailConfig;
  private readonly fromEmail: string;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.emailConfig = this.getEmailConfig();
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'oms@yourcompany.com');
    this.isEnabled = this.configService.get<boolean>('EMAIL_NOTIFICATIONS_ENABLED', false);
    
    if (this.isEnabled) {
      this.initializeTransporter();
    } else {
      this.logger.warn('Email notifications are disabled');
    }
  }

  private getEmailConfig(): EmailConfig {
    return {
      host: this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com'),
      port: 587, // Gmail recommended port for STARTTLS
      secure: false, // Must be false for port 587
      auth: {
        user: this.configService.get<string>('EMAIL_USER', ''),
        pass: this.configService.get<string>('EMAIL_PASSWORD', ''),
      },
    };
  }

  private async initializeTransporter(): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport(this.emailConfig);
      // Verify the connection
      await this.transporter.verify();
      this.logger.log('Email transporter initialized and verified successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize email transporter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sends order creation notification email
   * This method would typically be called by a webhook endpoint triggered by Sentry alerts
   */
  async sendOrderCreationNotification(emailData: OrderNotificationEmailData): Promise<void> {
    if (!this.isEnabled) {
      this.logger.log('Email notifications are disabled, skipping email send');
      return;
    }

    if (!this.transporter) {
      this.logger.error('Email transporter not initialized');
      return;
    }

    try {
      const subject = `🎉 New Order Created - ${emailData.orderData.aliasId}`;
      const htmlContent = this.generateOrderCreationEmailHtml(emailData.orderData, emailData.timestamp);
      const textContent = this.generateOrderCreationEmailText(emailData.orderData, emailData.timestamp);

      const mailOptions = {
        from: this.fromEmail,
        to: emailData.to.join(', '),
        subject,
        text: textContent,
        html: htmlContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Order creation notification email sent successfully for order ${emailData.orderData.aliasId}. Message ID: ${result.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send order creation notification email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test method to send a test email
   */
  async sendTestEmail(to: string): Promise<void> {
    if (!this.isEnabled || !this.transporter) {
      throw new Error('Email service not properly configured');
    }

    try {
      const mailOptions = {
        from: this.fromEmail,
        to,
        subject: 'Test Email - OMS Notification System',
        text: 'This is a test email from the OMS notification system.',
        html: '<p>This is a test email from the <strong>OMS notification system</strong>.</p>',
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Test email sent successfully. Message ID: ${result.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send test email: ${error.message}`);
      throw error;
    }
  }

  private generateOrderCreationEmailHtml(orderData: OrderCreatedAlert, timestamp: Date): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .order-details { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .order-items { margin-top: 15px; }
            .item { border-bottom: 1px solid #eee; padding: 10px 0; }
            .footer { background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 New Order Created!</h1>
            <p>Order ${orderData.aliasId} has been successfully processed</p>
          </div>
          
          <div class="content">
            <div class="order-details">
              <h2>Order Details</h2>
              <p><strong>Order ID:</strong> ${orderData.aliasId}</p>
              <p><strong>User ID:</strong> ${orderData.userId}</p>
              <p><strong>Total Amount:</strong> $${orderData.totalAmount.toFixed(2)}</p>
              ${orderData.customerName ? `<p><strong>Customer:</strong> ${orderData.customerName}</p>` : ''}
              ${orderData.userEmail ? `<p><strong>Email:</strong> ${orderData.userEmail}</p>` : ''}
              <p><strong>Created At:</strong> ${timestamp.toISOString()}</p>
            </div>

            ${orderData.orderItems && orderData.orderItems.length > 0 ? `
              <div class="order-items">
                <h3>Order Items (${orderData.orderItems.length} items)</h3>
                ${orderData.orderItems.map(item => `
                  <div class="item">
                    <p><strong>Product ID:</strong> ${item.productId} | <strong>Quantity:</strong> ${item.quantity} | <strong>Price:</strong> $${item.price.toFixed(2)}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>This notification was generated automatically by the OMS system.</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateOrderCreationEmailText(orderData: OrderCreatedAlert, timestamp: Date): string {
    let text = `🎉 NEW ORDER CREATED!\n\n`;
    text += `Order ${orderData.aliasId} has been successfully processed\n\n`;
    text += `ORDER DETAILS:\n`;
    text += `- Order ID: ${orderData.aliasId}\n`;
    text += `- User ID: ${orderData.userId}\n`;
    text += `- Total Amount: $${orderData.totalAmount.toFixed(2)}\n`;
    
    if (orderData.customerName) {
      text += `- Customer: ${orderData.customerName}\n`;
    }
    
    if (orderData.userEmail) {
      text += `- Email: ${orderData.userEmail}\n`;
    }
    
    text += `- Created At: ${timestamp.toISOString()}\n\n`;

    if (orderData.orderItems && orderData.orderItems.length > 0) {
      text += `ORDER ITEMS (${orderData.orderItems.length} items):\n`;
      orderData.orderItems.forEach((item, index) => {
        text += `${index + 1}. Product ID: ${item.productId}, Quantity: ${item.quantity}, Price: $${item.price.toFixed(2)}\n`;
      });
      text += `\n`;
    }

    text += `This notification was generated automatically by the OMS system.\n`;
    text += `Timestamp: ${new Date().toISOString()}`;

    return text;
  }
}