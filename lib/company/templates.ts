export const COMPANY_TEMPLATES = [
  {
    id: "distribution",
    label: "Distribution",
    depth: "full",
    companyName: "Atlas Medical Distribution",
    suggestion:
      "Create a medical equipment distribution company in Algiers with 3 suppliers, 12 customers, active orders, invoices and customer commitments.",
  },
  {
    id: "saas",
    label: "SaaS",
    depth: "demo",
    companyName: "SaaS demo",
    suggestion: "SaaS recurring revenue — demo template only.",
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    depth: "demo",
    companyName: "E-commerce demo",
    suggestion: "E-commerce storefront — demo template only.",
  },
  {
    id: "agency",
    label: "Agency",
    depth: "demo",
    companyName: "Agency demo",
    suggestion: "Services agency — demo template only.",
  },
  {
    id: "healthcare",
    label: "Healthcare",
    depth: "demo",
    companyName: "Healthcare demo",
    suggestion: "Care operations — demo template only.",
  },
] as const;

export type CompanyTemplateId = (typeof COMPANY_TEMPLATES)[number]["id"];
export type CompanyTemplate = (typeof COMPANY_TEMPLATES)[number];

export const DISTRIBUTION_TEMPLATE = COMPANY_TEMPLATES[0];

export const CREATE_COMPANY_PREFILL = DISTRIBUTION_TEMPLATE.suggestion;

export const GENERATION_STEPS = [
  "Understanding business...",
  "Creating customers...",
  "Creating suppliers...",
  "Creating orders...",
  "Creating invoices...",
  "Mapping dependencies...",
  "Creating commitments...",
  "Starting monitoring...",
] as const;

const DISTRIBUTION_HINTS = [
  "distribution",
  "distributor",
  "medical",
  "equipment",
  "algiers",
  "supplier",
  "atlas",
];

export function templateById(id: string | undefined): CompanyTemplate | undefined {
  return COMPANY_TEMPLATES.find((item) => item.id === id);
}

export function resolveCompanyTemplate(prompt: string, requested?: string): CompanyTemplate {
  const explicit = templateById(requested);
  if (explicit) return explicit;
  const text = prompt.toLowerCase();
  if (DISTRIBUTION_HINTS.some((hint) => text.includes(hint))) return DISTRIBUTION_TEMPLATE;
  return DISTRIBUTION_TEMPLATE;
}

export function isDeepTemplate(id: string): id is "distribution" {
  return id === "distribution";
}
