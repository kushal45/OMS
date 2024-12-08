import { CustomLoggerService } from "@lib/logger/src";
import { ModuleRef } from "@nestjs/core";
import { Kafka, KafkaConfig, Producer, RecordMetadata } from "kafkajs";
import { KafkaAdminClient } from "./KafKaAdminClient";


export class KafkaProducer {
    private producer: Producer;
    private kafka: Kafka;
    private context: string = 'KafkaProducer';
    
    constructor(config: KafkaConfig, private moduleRef: ModuleRef) {
        this.kafka = new Kafka(config);
        this.producer = this.kafka.producer(
            {
                idempotent: true,
            }
        );
    }
    
    async send(topic: string,messageObj:{
        key:string,
        value:string
    }): Promise<RecordMetadata[]> {
        this.producer.connect();
        
        const kafkaAdminClient = this.moduleRef.get<KafkaAdminClient>('KafkaAdminInstance', { strict: true });
        const numPartitions = await kafkaAdminClient.getNumberOfPartitions(topic);
        const assignedPartition = numPartitions%2;
        return await this.producer.send({
            topic,
            messages: [{
                ...messageObj,
                partition: assignedPartition
            }],
            
        });
        // this.producer.on('producer.network.request_timeout', (event) => {
        //     const logger = this.moduleRef.get(CustomLoggerService, { strict: false });
        //     logger.error(
        //         {
        //             message: `Failed to send message to topic: ${topic}`,
        //             error: JSON.stringify(event.payload),
        //         },
        //         this.context,
        //     );
        // });
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }
}