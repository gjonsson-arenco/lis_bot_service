import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LisClientService } from '../src/lis-client/lis-client.service';
import axios from 'axios';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LisClientService', () => {
  let service: LisClientService;

  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LisClientService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                LIS_BACKEND_URL: 'https://lis.example.com',
                LIS_API_KEY: 'test-api-key',
              };
              return config[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(LisClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('calls POST /orders with input and returns data', async () => {
      const orderData = { orderId: 'ORD-001', status: 'pending' };
      mockAxiosInstance.post.mockResolvedValue({ data: orderData });

      const result = await service.createOrder({
        patientName: 'Carlos',
        examType: 'hemograma',
        requestingDoctor: 'Dr. López',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/orders', {
        patientName: 'Carlos',
        examType: 'hemograma',
        requestingDoctor: 'Dr. López',
      });
      expect(result).toEqual(orderData);
    });
  });

  describe('queryOrder', () => {
    it('calls GET /orders/:id and returns data', async () => {
      const orderData = { orderId: 'ORD-002', status: 'completed' };
      mockAxiosInstance.get.mockResolvedValue({ data: orderData });

      const result = await service.queryOrder({ orderId: 'ORD-002' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/orders/ORD-002');
      expect(result).toEqual(orderData);
    });
  });

  describe('listPatientOrders', () => {
    it('calls GET /patients/:id/orders with optional filters', async () => {
      const ordersData = [{ orderId: 'ORD-003' }];
      mockAxiosInstance.get.mockResolvedValue({ data: ordersData });

      const result = await service.listPatientOrders({
        patientId: 'PAT-001',
        status: 'completed',
        limit: 5,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/patients/PAT-001/orders',
        { params: { status: 'completed', limit: 5 } },
      );
      expect(result).toEqual(ordersData);
    });

    it('calls without params when only patientId provided', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      await service.listPatientOrders({ patientId: 'PAT-001' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/patients/PAT-001/orders',
        { params: {} },
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('calls PATCH /orders/:id/status and returns data', async () => {
      const updatedOrder = { orderId: 'ORD-001', status: 'in_progress' };
      mockAxiosInstance.patch.mockResolvedValue({ data: updatedOrder });

      const result = await service.updateOrderStatus({
        orderId: 'ORD-001',
        status: 'in_progress',
        notes: 'Procesando muestra',
      });

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/orders/ORD-001/status',
        { status: 'in_progress', notes: 'Procesando muestra' },
      );
      expect(result).toEqual(updatedOrder);
    });
  });
});
