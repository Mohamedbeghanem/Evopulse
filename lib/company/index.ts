export {
  COMPANY_TEMPLATES,
  CREATE_COMPANY_PREFILL,
  DISTRIBUTION_TEMPLATE,
  GENERATION_STEPS,
  isDeepTemplate,
  resolveCompanyTemplate,
  templateById,
} from "./templates";
export type { CompanyTemplate, CompanyTemplateId } from "./templates";
export {
  COMPANY_NAME_KEY,
  COMPANY_PROMPT_KEY,
  COMPANY_TEMPLATE_KEY,
  WORKSPACE_MODE_KEY,
  companySnapshot,
  createCompany,
  generateDistributionCompany,
  markWorkspace,
  openDemoCompany,
  resetWorkspace,
  returnToCreateSurface,
  workspaceMode,
} from "./generate";
export type { CompanySnapshot, WorkspaceMode } from "./generate";
export { WORLD, companyCensus, countEntities, expandDistributionWorld } from "./world";
export { PULSE_AVATAR_STATES, avatarLabel, avatarStateFromAgent } from "./avatar";
export type { PulseAvatarState } from "./avatar";
