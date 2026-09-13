declare module 'redlock' {
  export interface Lock {
    release(): Promise<unknown>;
  }
  export default class Redlock {
    constructor(clients: unknown[], options?: Record<string, unknown>);
    acquire(resources: string[], ttl: number): Promise<Lock>;
  }
}

declare module 'arweave' {
  const Arweave: {
    init(config: Record<string, unknown>): {
      createTransaction(
        input: { data: Buffer | string },
        jwk: unknown,
      ): Promise<{
        id: string;
        addTag(name: string, value: string): void;
      }>;
      transactions: {
        sign(tx: unknown, jwk: unknown): Promise<void>;
        post(tx: unknown): Promise<unknown>;
      };
    };
  };
  export default Arweave;
}
