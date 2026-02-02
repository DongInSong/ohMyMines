import { Redis } from 'ioredis';
import { createSubscriber } from './client.js';

type MessageHandler = (message: unknown) => void;

export class PubSubManager {
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  constructor(publisher: Redis | null) {
    this.publisher = publisher;
  }

  async initialize(): Promise<void> {
    if (!this.publisher) {
      console.log('PubSub: Running without Redis');
      return;
    }

    this.subscriber = createSubscriber();

    try {
      await this.subscriber.connect();

      this.subscriber.on('message', (channel, message) => {
        this.handleMessage(channel, message);
      });

      console.log('PubSub initialized');
    } catch (error) {
      console.warn('PubSub initialization failed:', error);
      this.subscriber = null;
    }
  }

  private handleMessage(channel: string, message: string): void {
    const handlers = this.handlers.get(channel);
    if (!handlers) return;

    try {
      const parsed = JSON.parse(message);
      for (const handler of handlers) {
        handler(parsed);
      }
    } catch (error) {
      console.error('Error handling pubsub message:', error);
    }
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());

      if (this.subscriber) {
        await this.subscriber.subscribe(channel);
      }
    }

    this.handlers.get(channel)!.add(handler);
  }

  unsubscribe(channel: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.delete(handler);

      if (handlers.size === 0) {
        this.handlers.delete(channel);
        if (this.subscriber) {
          this.subscriber.unsubscribe(channel);
        }
      }
    }
  }

  async publish(channel: string, message: object): Promise<void> {
    if (this.publisher) {
      await this.publisher.publish(channel, JSON.stringify(message));
    } else {
      // Local mode: directly call handlers
      const handlers = this.handlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.handlers.clear();
  }
}

// Predefined channels
export const CHANNELS = {
  GAME_EVENTS: 'game:events',
  PLAYER_UPDATES: 'game:players',
  CHAT: 'game:chat',
  NOTIFICATIONS: 'game:notifications',
  SESSION: 'game:session',
} as const;
