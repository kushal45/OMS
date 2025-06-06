import { IHeaders } from 'kafkajs';

/**
 * Interface for Kafka message handlers.
 * Implementers of this interface will contain the logic for processing messages
 * from specific Kafka topics.
 */
export interface IMessageHandler {
  /**
   * Handles an incoming Kafka message.
   * @param topic The topic from which the message was received.
   * @param partition The partition from which the message was received.
   * @param message The deserialized message payload.
   * @param headers Optional Kafka message headers.
   * @returns A promise that resolves when message processing is complete.
   * @throws An error if message processing fails.
   */
  handleMessage(topic: string, partition: number, message: any, headers?: IHeaders): Promise<void>;
}