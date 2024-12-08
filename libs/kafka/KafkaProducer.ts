import { CustomLoggerService } from "@lib/logger/src";
import { Kafka, KafkaConfig, Producer } from "kafkajs";


export class KafkaProducer {
    private producer: Producer;
    private kafka: Kafka;
    private context: string = 'KafkaProducer';
    
    constructor(config: KafkaConfig,private logger:CustomLoggerService) {
        this.kafka = new Kafka(config);
        this.producer = this.kafka.producer();
       
    }
    
    async send(topic: string, message: string): Promise<void> {
        this.producer.connect();
        this.producer.on('producer.connect', async () => {
        // validate if the topic exists in the kafka cluster, if not create the topic
        const topicMetaData=await this.kafka.admin().fetchTopicMetadata({ topics: [topic] });
        this.logger.info(`Topics: ${JSON.stringify(topicMetaData)}`, this.context);
        if(topicMetaData.topics.length===0){
            this.logger.error(`Topic ${topic} does not exist, creating the topic`,this.context);
            await this.kafka.admin().createTopics({
                topics: [{ topic }],
            });
        }
        await this.producer.send({
            topic,
            messages: [{ value: message }],
        })
        });
        this.producer.on('producer.network.request_timeout', (event) => {
            console.error(event);
        });
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }
}