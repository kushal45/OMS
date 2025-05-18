import { FindOptionsWhere ,In} from 'typeorm';

export function convertOptions<T>(options: T): FindOptionsWhere<T> {
  const where: FindOptionsWhere<T> = {};

  for (const key in options) {
    if (options[key] !== undefined) {
      if(options[key] instanceof Array){
        // add IN operator for array values
        where[key] = In(options[key]) as any;
      }else{
        where[key] = options[key] as any;
      }
    }
  }
  console.log("where options:::",where);
  return where;
}