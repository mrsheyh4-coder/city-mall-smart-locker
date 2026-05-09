import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
})
export class LockersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LockersGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Realtime client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Realtime client disconnected: ${client.id}`);
  }

  emitLockersUpdated(payload: unknown) {
    this.server?.emit('lockers:updated', payload);
  }

  emitBookingUpdated(payload: unknown) {
    this.server?.emit('booking:updated', payload);
  }
}
