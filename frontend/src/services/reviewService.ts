import axios from "axios";
import { authHeaders } from "./authService";

const API_URL = "http://localhost:5000/api/reviews";

export interface Review {
  _id: string;
  productId: string | {
    _id: string;
    name: string;
    image?: string;
  };
  userId: string | {
    _id: string;
    name: string;
    email?: string;
  };
  comment: string;
  images: string[];
  adminReply?: {
    text: string;
    repliedBy: string | {
      _id: string;
      name: string;
    };
    repliedAt: string;
  };
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListResponse {
  success: boolean;
  data: Review[];
}

export interface ReviewResponse {
  success: boolean;
  data: Review;
  message?: string;
}

export interface ProductReviewsResponse {
  success: boolean;
  data: {
    reviews: Review[];
    averageRating: string;
    totalReviews: number;
  };
}

export const getReviewsByProduct = async (
  productId: string
): Promise<ProductReviewsResponse> => {
  const response = await axios.get<ProductReviewsResponse>(
    `${API_URL}/product/${productId}`
  );
  return response.data;
};

export const getReviewsByUser = async (): Promise<ReviewListResponse> => {
  const response = await axios.get<ReviewListResponse>(
    `${API_URL}/user/my-reviews`,
    { headers: authHeaders() }
  );
  return response.data;
};

export const getAllReviews = async (params?: {
  productId?: string;
  userId?: string;
  isVisible?: boolean;
}): Promise<ReviewListResponse> => {
  const response = await axios.get<ReviewListResponse>(API_URL, {
    headers: authHeaders(),
    params,
  });
  return response.data;
};

export const createReview = async (reviewData: {
  productId: string;
  comment?: string;
  images?: string[];
}): Promise<ReviewResponse> => {
  const response = await axios.post<ReviewResponse>(API_URL, reviewData, {
    headers: authHeaders(),
  });
  return response.data;
};

export const updateReview = async (
  id: string,
  reviewData: {
    rating?: number;
    comment?: string;
    images?: string[];
  }
): Promise<ReviewResponse> => {
  const response = await axios.put<ReviewResponse>(
    `${API_URL}/${id}`,
    reviewData,
    { headers: authHeaders() }
  );
  return response.data;
};

export const deleteReview = async (id: string): Promise<ReviewResponse> => {
  const response = await axios.delete<ReviewResponse>(`${API_URL}/${id}`, {
    headers: authHeaders(),
  });
  return response.data;
};

export const replyToReview = async (
  id: string,
  text: string
): Promise<ReviewResponse> => {
  const response = await axios.post<ReviewResponse>(
    `${API_URL}/${id}/reply`,
    { text },
    { headers: authHeaders() }
  );
  return response.data;
};

export const adminDeleteReview = async (
  id: string
): Promise<ReviewResponse> => {
  const response = await axios.delete<ReviewResponse>(
    `${API_URL}/${id}/admin`,
    { headers: authHeaders() }
  );
  return response.data;
};

export const toggleReviewVisibility = async (
  id: string
): Promise<ReviewResponse> => {
  const response = await axios.patch<ReviewResponse>(
    `${API_URL}/${id}/visibility`,
    {},
    { headers: authHeaders() }
  );
  return response.data;
};

export const adminUpdateReview = async (
  id: string,
  comment: string
): Promise<ReviewResponse> => {
  const response = await axios.put<ReviewResponse>(
    `${API_URL}/${id}/comment`,
    { comment },
    { headers: authHeaders() }
  );
  return response.data;
};