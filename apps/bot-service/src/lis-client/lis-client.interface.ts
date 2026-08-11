export interface CreateOrderInput {
  patientId?: string;
  patientName: string;
  examType: string;
  requestingDoctor: string;
  priority?: 'normal' | 'urgente' | 'stat';
  notes?: string;
}

export interface QueryOrderInput {
  orderId: string;
}

export interface ListPatientOrdersInput {
  patientId: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  limit?: number;
}

export interface UpdateOrderStatusInput {
  orderId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface ILisClient {
  createOrder(input: CreateOrderInput): Promise<Record<string, any>>;
  queryOrder(input: QueryOrderInput): Promise<Record<string, any>>;
  listPatientOrders(input: ListPatientOrdersInput): Promise<Record<string, any>[]>;
  updateOrderStatus(input: UpdateOrderStatusInput): Promise<Record<string, any>>;
}
