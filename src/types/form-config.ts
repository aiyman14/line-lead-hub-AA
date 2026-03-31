export type FormType = "sewing_target" | "sewing_actual" | "cutting_target" | "cutting_actual" | "finishing_target" | "finishing_actual";

export interface FormFieldDataSource {
  type: "dropdown_list" | "static";
  list_id?: string;
  table?: string;
  value_column?: string;
  label_column?: string;
}

export interface FormFieldConfig {
  key: string;
  label: string;
  label_key?: string;
  type: "text" | "number" | "dropdown" | "date" | "textarea";
  section?: string;
  required?: boolean;
  is_custom?: boolean;
  dropdownListId?: string;
  defaultValue?: string | number;
  data_source?: FormFieldDataSource;
}

export interface FormSectionConfig {
  key: string;
  label: string;
  fields: FormFieldConfig[];
}

export interface FormConfig {
  sections: FormSectionConfig[];
  fields: FormFieldConfig[];
}
