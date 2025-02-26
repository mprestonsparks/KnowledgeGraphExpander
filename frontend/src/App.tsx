import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoadingSpinner } from "@components/ui/loading";

const queryClient = new QueryClient();

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Knowledge Graph System
        </h1>
        <p className="text-lg text-gray-600 mb-4">
          Welcome to your intelligent knowledge mapping system
        </p>
        <LoadingSpinner className="text-blue-500" />
      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}