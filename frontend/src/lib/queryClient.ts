import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Get the base API URL
const API_BASE_URL = window.location.origin;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options?: RequestInit
): Promise<any> {
  // If the URL doesn't start with http, prepend the API base URL
  const fullUrl = url.startsWith('http') 
    ? url 
    : `${API_BASE_URL}${url}`;
  
  // Log the full request URL
  console.log(`Making API request to: ${fullUrl}`);
  
  try {
    const res = await fetch(fullUrl, {
      ...options,
      credentials: "include",
      // Add common headers
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options?.headers || {}),
      }
    });

    await throwIfResNotOk(res);
    
    const data = await res.json();
    console.log(`API response data:`, data);
    return data;
  } catch (error) {
    console.error(`API request failed: ${error}`);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey[0] as string;
    const fullUrl = path.startsWith('http') 
      ? path 
      : `${API_BASE_URL}${path}`;
      
    console.log(`Making query request to: ${fullUrl}`);

    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: {
        'Accept': 'application/json',
      }
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    console.log(`Query response data:`, data);
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});