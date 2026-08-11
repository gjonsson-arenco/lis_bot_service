// Tool definitions for Claude's tool_use feature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CLAUDE_TOOLS: any[] = [
  {
    name: 'create_order',
    description:
      'Crea una nueva orden de laboratorio en el sistema LIS. Usar cuando el usuario solicite crear, registrar o agregar una nueva orden.',
    input_schema: {
      type: 'object',
      properties: {
        patientId: {
          type: 'string',
          description: 'ID del paciente en el sistema',
        },
        patientName: {
          type: 'string',
          description: 'Nombre completo del paciente',
        },
        examType: {
          type: 'string',
          description:
            'Tipo de examen de laboratorio (ej: hemograma, glucosa, orina)',
        },
        requestingDoctor: {
          type: 'string',
          description: 'Nombre del médico solicitante',
        },
        priority: {
          type: 'string',
          enum: ['normal', 'urgente', 'stat'],
          description: 'Prioridad de la orden',
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales o indicaciones clínicas',
        },
      },
      required: ['patientName', 'examType', 'requestingDoctor'],
    },
  },
  {
    name: 'query_order',
    description:
      'Consulta los detalles y estado de una orden de laboratorio específica.',
    input_schema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'ID único de la orden de laboratorio',
        },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'list_patient_orders',
    description:
      'Lista todas las órdenes de laboratorio de un paciente específico.',
    input_schema: {
      type: 'object',
      properties: {
        patientId: {
          type: 'string',
          description: 'ID del paciente en el sistema',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
          description: 'Filtrar por estado (opcional)',
        },
        limit: {
          type: 'number',
          description: 'Número máximo de órdenes a retornar (default: 10)',
        },
      },
      required: ['patientId'],
    },
  },
  {
    name: 'update_order_status',
    description: 'Actualiza el estado de una orden de laboratorio existente.',
    input_schema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'ID único de la orden',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
          description: 'Nuevo estado de la orden',
        },
        notes: {
          type: 'string',
          description: 'Notas sobre el cambio de estado',
        },
      },
      required: ['orderId', 'status'],
    },
  },
];
