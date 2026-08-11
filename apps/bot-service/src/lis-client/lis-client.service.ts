import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  CreateOrderInput,
  ILisClient,
  ListPatientOrdersInput,
  QueryOrderInput,
  UpdateOrderStatusInput,
} from './lis-client.interface';
import { Env } from '../config/env.schema';

@Injectable()
export class LisClientService implements ILisClient {
  private readonly logger = new Logger(LisClientService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService<Env>) {
    this.http = axios.create({
      baseURL: this.config.get('LIS_BACKEND_URL'),
      headers: {
        'X-API-Key': this.config.get('LIS_API_KEY'),
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Request interceptor for logging
    this.http.interceptors.request.use((req) => {
      this.logger.debug(`LIS → ${req.method?.toUpperCase()} ${req.url}`);
      return req;
    });

    // Response interceptor for logging
    this.http.interceptors.response.use(
      (res) => {
        this.logger.debug(`LIS ← ${res.status} ${res.config.url}`);
        return res;
      },
      (error) => {
        const status = error.response?.status;
        const url = error.config?.url;
        this.logger.error(`LIS error: ${status} ${url}`, error.message);
        throw error;
      },
    );
  }

  async createOrder(input: CreateOrderInput): Promise<Record<string, any>> {
    const res = await this.http.post('/orders', input);
    return res.data;
  }

  async queryOrder(input: QueryOrderInput): Promise<Record<string, any>> {
    const res = await this.http.get(`/orders/${input.orderId}`);
    return res.data;
  }

  async listPatientOrders(
    input: ListPatientOrdersInput,
  ): Promise<Record<string, any>[]> {
    const params: Record<string, any> = {};
    if (input.status) params.status = input.status;
    if (input.limit) params.limit = input.limit;

    const res = await this.http.get(`/patients/${input.patientId}/orders`, {
      params,
    });
    return res.data;
  }

  async updateOrderStatus(
    input: UpdateOrderStatusInput,
  ): Promise<Record<string, any>> {
    const res = await this.http.patch(`/orders/${input.orderId}/status`, {
      status: input.status,
      notes: input.notes,
    });
    return res.data;
  }
}
