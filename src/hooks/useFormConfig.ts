import { useAuth } from "@/contexts/AuthContext";
import type { FormType, FormConfig } from "@/types/form-config";

export function useFormConfig(formType: FormType) {
  const { factory } = useAuth();
  // Stub — dynamic form config not yet implemented
  return {
    config: null as FormConfig | null,
    loading: false,
  };
}
