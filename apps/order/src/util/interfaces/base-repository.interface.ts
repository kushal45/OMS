import { EntityManager } from "typeorm";

export interface BaseRepository<T> {
    getRepository(entityManager: EntityManager): T;
}