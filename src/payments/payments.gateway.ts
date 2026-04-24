import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://splendid-starlink-frontend.onrender.com',
      'https://splendid-starlink.vercel.app',
      'https://splendidstarlink.netlify.app',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/payments',
})
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('PaymentsGateway');

  constructor() {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-payment-room')
  handleJoinPaymentRoom(
    @MessageBody() data: { transactionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `payment-${data.transactionId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    return { event: 'joined-room', data: { room } };
  }

  @SubscribeMessage('leave-payment-room')
  handleLeavePaymentRoom(
    @MessageBody() data: { transactionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `payment-${data.transactionId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
    return { event: 'left-room', data: { room } };
  }

  // Method to emit payment status updates
  emitPaymentStatus(transactionId: string, status: string, data?: any) {
    const room = `payment-${transactionId}`;
    this.server.to(room).emit('payment-status-update', {
      transactionId,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Emitted payment status update: ${status} for transaction ${transactionId}`);
  }
}