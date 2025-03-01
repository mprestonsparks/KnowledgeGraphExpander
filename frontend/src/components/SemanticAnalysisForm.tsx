import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  text: z.string().min(1, "Text is required"),
  images: z.array(z.object({
    data: z.string(),
    type: z.string()
  })).optional()
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  onSuccess: (result: any) => void;
}

export function SemanticAnalysisForm({ onSuccess }: Props) {
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: "",
      images: []
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const result = await apiRequest<FormData>('/api/graph/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      onSuccess(result);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze content",
        variant: "destructive"
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Textarea
          {...form.register("text")}
          placeholder="Enter text to analyze..."
          className="min-h-[100px]"
        />
        {form.formState.errors.text && (
          <p className="text-red-500">{form.formState.errors.text.message}</p>
        )}
        <Button 
          type="submit" 
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Analyzing..." : "Analyze"}
        </Button>
      </form>
    </Form>
  );
}