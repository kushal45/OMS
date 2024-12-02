import { Inject, Injectable, LoggerService } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";

@Injectable()
export class CustomLoggerService {
    constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService){}

    info(data: Record<string,unknown>,context) {
        this.logger.log(data,context);
    }

    error(data: Record<string,string>,context) {
        this.logger.error(data,context);
    }

    debug(data: Record<string,string>,context,metadata) {
        this.logger.debug(data,context,metadata);
    }

}