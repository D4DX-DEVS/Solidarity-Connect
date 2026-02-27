import { api } from '@/lib/api';

export interface NotificationAttachment {
  filename?: string;
  originalName?: string;
  mimetype?: string;
  size?: number;
  url: string;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  targetAudience: string;
  status: string;
  attachments?: NotificationAttachment[];
  deliveryStats?: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    read: number;
  };
  createdBy: {
    _id: string;
    name: string;
    phone: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  completedAt?: string;
}

export interface CreateNotificationData {
  title: string;
  message: string;
  targetAudience?: string;
}

export interface UpdateNotificationData {
  title?: string;
  message?: string;
  targetAudience?: string;
}

export interface NotificationStats {
  totalNotifications: number;
  draftNotifications: number;
  sentNotifications: number;
  sendingNotifications: number;
  failedNotifications: number;
  totalRecipients: number;
  totalDelivered: number;
  totalFailed: number;
}

export interface PaginatedNotifications {
  data: Notification[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalDocs: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

class NotificationService {
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    priority?: string;
  }): Promise<PaginatedNotifications> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.priority) queryParams.append('priority', params.priority);

    const response = await api.get<Notification[]>(`/notifications?${queryParams.toString()}`);
    return {
      data: response.data,
      pagination: response.pagination!
    };
  }

  async getNotificationById(id: string): Promise<Notification> {
    const response = await api.get<Notification>(`/notifications/${id}`);
    return response.data;
  }

  async createNotification(data: CreateNotificationData): Promise<Notification> {
    const response = await api.post<Notification>('/notifications', data);
    return response.data;
  }

  async updateNotification(id: string, data: UpdateNotificationData): Promise<Notification> {
    const response = await api.put<Notification>(`/notifications/${id}`, data);
    return response.data;
  }

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  }

  async sendNotification(id: string): Promise<void> {
    await api.post(`/notifications/${id}/send`);
  }

  async getNotificationStats(): Promise<NotificationStats> {
    const response = await api.get<{ statistics: NotificationStats }>('/notifications/stats');
    return response.data.statistics;
  }

  async getNotificationStatus(id: string) {
    const response = await api.get(`/notifications/${id}/status`);
    return response.data;
  }
}

export const notificationService = new NotificationService();