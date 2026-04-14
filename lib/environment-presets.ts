import type { EnvironmentNetworking, EnvironmentPackages } from './api-types';

export interface EnvironmentPreset {
  key: string;
  label: string;
  description: string;
  networking: EnvironmentNetworking;
  packages: EnvironmentPackages;
}

const EMPTY_PACKAGES: EnvironmentPackages = {
  apt: [],
  npm: [],
  pip: [],
  cargo: [],
  gem: [],
  go: [],
};

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    key: 'blank',
    label: 'Blank',
    description: 'Unrestricted networking, no pre-installed packages',
    networking: { type: 'unrestricted' },
    packages: { ...EMPTY_PACKAGES },
  },
  {
    key: 'node-backend',
    label: 'Node.js Backend',
    description: 'TypeScript, Prisma, and common CLI tools',
    networking: { type: 'unrestricted' },
    packages: {
      ...EMPTY_PACKAGES,
      apt: ['git', 'curl', 'jq'],
      npm: ['typescript', 'tsx', 'prisma', '@prisma/client'],
    },
  },
  {
    key: 'python-ml',
    label: 'Python ML',
    description: 'NumPy, pandas, scikit-learn, Jupyter',
    networking: { type: 'unrestricted' },
    packages: {
      ...EMPTY_PACKAGES,
      apt: ['git', 'curl'],
      pip: ['numpy', 'pandas', 'scikit-learn', 'jupyter'],
    },
  },
  {
    key: 'fullstack',
    label: 'Full-stack',
    description: 'Node.js + Python + Playwright for end-to-end work',
    networking: { type: 'unrestricted' },
    packages: {
      ...EMPTY_PACKAGES,
      apt: ['git', 'curl', 'jq'],
      npm: ['typescript', 'tsx', 'prisma', '@prisma/client', 'playwright'],
      pip: ['requests'],
    },
  },
  {
    key: 'qa-testing',
    label: 'QA / Testing',
    description: 'Playwright and TypeScript for test automation',
    networking: { type: 'unrestricted' },
    packages: {
      ...EMPTY_PACKAGES,
      apt: ['git', 'curl'],
      npm: ['playwright', '@playwright/test', 'typescript'],
    },
  },
];
